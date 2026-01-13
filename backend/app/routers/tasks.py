from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import User, Task, UserTask, UserProgress, Scenario, Profession
from app.schemas import TaskResponse, UserTaskAnswer, UserTaskResponse
from app.auth import get_current_active_user
from app.ai_service import generate_task, evaluate_answer, generate_final_report

router = APIRouter()


@router.get("/profession/{profession_id}/current", response_model=TaskResponse)
async def get_current_task(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить текущее задание для профессии"""
    # Проверяем прогресс
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).first()
    
    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")
    
    # Получаем сценарий профессии
    scenario = db.query(Scenario).filter(Scenario.profession_id == profession_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Получаем задание по порядку
    task = db.query(Task).filter(
        Task.scenario_id == scenario.id,
        Task.order == progress.current_task_order + 1
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="No more tasks")
    
    return task


@router.post("/{task_id}/generate")
async def generate_task_content(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Генерирует конкретное задание на основе шаблона"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    scenario = db.query(Scenario).filter(Scenario.id == task.scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Получаем историю ответов пользователя
    user_tasks = db.query(UserTask).filter(
        UserTask.user_id == current_user.id,
        UserTask.task_id.in_(
            db.query(Task.id).filter(Task.scenario_id == scenario.id)
        )
    ).all()
    
    user_history = [
        {"answer": ut.answer, "metrics": ut.ai_metrics}
        for ut in user_tasks if ut.answer
    ]
    
    # Генерируем задание
    generated_task = generate_task(
        system_prompt=scenario.system_prompt,
        task_template=task.description_template,
        user_history=user_history if user_history else None
    )
    
    return {"task_description": generated_task}


@router.post("/{task_id}/submit", response_model=UserTaskResponse)
async def submit_task_answer(
    task_id: int,
    answer_data: UserTaskAnswer,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Отправить ответ на задание и получить оценку AI"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    scenario = db.query(Scenario).filter(Scenario.id == task.scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Проверяем, не отвечал ли уже пользователь
    existing_user_task = db.query(UserTask).filter(
        UserTask.user_id == current_user.id,
        UserTask.task_id == task_id
    ).first()
    
    if existing_user_task:
        raise HTTPException(status_code=400, detail="Task already completed")
    
    # Оцениваем ответ через AI
    evaluation = evaluate_answer(
        system_prompt=scenario.system_prompt,
        task_description=task.description_template,
        user_answer=answer_data.answer,
        task_type=task.type
    )
    
    # Сохраняем ответ пользователя
    user_task = UserTask(
        user_id=current_user.id,
        task_id=task_id,
        answer=answer_data.answer,
        ai_feedback=evaluation.get("feedback", ""),
        ai_metrics=evaluation.get("metrics", {}),
        completed_at=datetime.utcnow()
    )
    db.add(user_task)
    
    # Обновляем прогресс
    profession_id = scenario.profession_id
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).first()
    
    if not progress:
        progress = UserProgress(
            user_id=current_user.id,
            profession_id=profession_id,
            status="in_progress",
            current_task_order=task.order,
            started_at=datetime.utcnow()
        )
        db.add(progress)
    else:
        progress.current_task_order = task.order
        progress.status = "in_progress"
    
    # Проверяем, завершены ли все задания
    total_tasks = db.query(Task).filter(Task.scenario_id == scenario.id).count()
    if task.order >= total_tasks:
        # Получаем профессию для финального отчёта
        profession = db.query(Profession).filter(Profession.id == profession_id).first()
        
        # Генерируем финальный отчёт
        all_user_tasks = db.query(UserTask).join(Task).filter(
            UserTask.user_id == current_user.id,
            Task.scenario_id == scenario.id
        ).all()
        
        all_metrics = [ut.ai_metrics for ut in all_user_tasks if ut.ai_metrics]
        all_answers = [ut.answer for ut in all_user_tasks if ut.answer]
        
        final_report = generate_final_report(
            system_prompt=scenario.system_prompt,
            profession_name=profession.name if profession else "Профессия",
            all_metrics=all_metrics,
            all_answers=all_answers
        )
        
        progress.status = "completed"
        progress.completed_at = datetime.utcnow()
        progress.final_report = final_report
        
        # Вычисляем общие метрики
        if all_metrics:
            overall_metrics = {}
            metric_keys = ["systematicity", "stress_resistance", "decision_making", "empathy", "logic"]
            for key in metric_keys:
                values = [m.get(key, 0) for m in all_metrics if m and key in m]
                if values:
                    overall_metrics[key] = sum(values) / len(values)
            progress.overall_metrics = overall_metrics
    
    db.commit()
    db.refresh(user_task)
    
    return user_task


@router.get("/profession/{profession_id}/report")
async def get_final_report(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить финальный отчёт по профессии"""
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).first()
    
    if not progress or progress.status != "completed":
        raise HTTPException(status_code=404, detail="Report not available")
    
    return {
        "final_report": progress.final_report,
        "overall_metrics": progress.overall_metrics,
        "completed_at": progress.completed_at
    }
