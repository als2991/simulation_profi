from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import time
import logging
from app.database import get_db
from app.models import User, Task, UserTask, UserProgress, Scenario, Profession, ReportTemplate
from app.schemas import TaskResponse, UserTaskAnswer, UserTaskResponse
from app.auth import get_current_active_user
from app.ai_service import generate_task_question, generate_next_task_prompt, generate_final_report

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/profession/{profession_id}/current")
async def get_current_task(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить текущее задание для профессии и сгенерировать вопрос через AI"""
    request_start = time.time()
    logger.info(f"[TIMING] get_current_task START for user {current_user.id}, profession {profession_id}")
    
    # Получаем последнюю попытку
    db_start = time.time()
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).order_by(desc(UserProgress.attempt_number)).first()
    
    if not progress:
        # Создаем новую попытку (attempt_number = 1)
        progress = UserProgress(
            user_id=current_user.id,
            profession_id=profession_id,
            attempt_number=1,
            status="in_progress",
            current_task_order=0,
            conversation_history=[],
            started_at=datetime.utcnow()
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)
    
    # Получаем сценарий профессии
    scenario = db.query(Scenario).filter(Scenario.profession_id == profession_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Получаем задание по порядку
    next_order = progress.current_task_order + 1
    task = db.query(Task).filter(
        Task.scenario_id == scenario.id,
        Task.order == next_order
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="No more tasks")
    
    db_end = time.time()
    logger.info(f"[TIMING] Database queries completed in {db_end - db_start:.3f} seconds")
    
    # Генерируем вопрос через AI
    conversation_history = progress.conversation_history or []
    
    ai_start = time.time()
    logger.info(f"[TIMING] Calling AI service...")
    ai_question = generate_task_question(
        system_prompt=scenario.system_prompt,
        task_description=task.description_template,
        conversation_history=conversation_history
    )
    ai_end = time.time()
    logger.info(f"[TIMING] AI service completed in {ai_end - ai_start:.3f} seconds")
    
    request_end = time.time()
    logger.info(f"[TIMING] get_current_task TOTAL: {request_end - request_start:.3f} seconds")
    
    return {
        "id": task.id,
        "order": task.order,
        "type": task.type,
        "time_limit_minutes": task.time_limit_minutes,
        "question": ai_question
    }


@router.post("/{task_id}/submit")
async def submit_task_answer(
    task_id: int,
    answer_data: UserTaskAnswer,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Отправить ответ на задание и получить следующий вопрос или завершить"""
    request_start = time.time()
    logger.info(f"[TIMING] submit_task_answer START for user {current_user.id}, task {task_id}")
    
    db_start = time.time()
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    scenario = db.query(Scenario).filter(Scenario.id == task.scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Получаем прогресс (последнюю попытку)
    profession_id = scenario.profession_id
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).order_by(desc(UserProgress.attempt_number)).first()
    
    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")
    
    # Проверяем, не отвечал ли уже пользователь в этой попытке
    existing_user_task = db.query(UserTask).filter(
        UserTask.user_id == current_user.id,
        UserTask.task_id == task_id,
        UserTask.attempt_number == progress.attempt_number
    ).first()
    
    if existing_user_task:
        raise HTTPException(status_code=400, detail="Task already completed")
    
    # Получаем вопрос, который был задан (из последнего элемента conversation_history)
    conversation_history = progress.conversation_history or []
    last_ai_message = ""
    if conversation_history:
        # Ищем последнее сообщение от assistant
        for msg in reversed(conversation_history):
            if msg.get("role") == "assistant":
                last_ai_message = msg.get("content", "")
                break
    
    # Если не нашли в истории, генерируем заново (fallback)
    if not last_ai_message:
        last_ai_message = generate_task_question(
            system_prompt=scenario.system_prompt,
            task_description=task.description_template,
            conversation_history=[]
        )
    
    # Сохраняем ответ пользователя с привязкой к попытке
    user_task = UserTask(
        user_id=current_user.id,
        task_id=task_id,
        progress_id=progress.id,
        attempt_number=progress.attempt_number,
        question=last_ai_message,
        answer=answer_data.answer,
        completed_at=datetime.utcnow()
    )
    db.add(user_task)
    
    # Добавляем ответ пользователя в историю диалога
    conversation_history.append({
        "role": "user",
        "content": f"Пользователь ответил на задание №{task.order}: {answer_data.answer}"
    })
    
    # Обновляем прогресс
    progress.current_task_order = task.order
    progress.conversation_history = conversation_history
    
    # Проверяем, есть ли еще задания
    total_tasks = db.query(Task).filter(Task.scenario_id == scenario.id).count()
    
    db_end = time.time()
    logger.info(f"[TIMING] Database queries completed in {db_end - db_start:.3f} seconds")
    
    if task.order >= total_tasks:
        # Это было последнее задание - генерируем финальный отчёт
        profession = db.query(Profession).filter(Profession.id == profession_id).first()
        
        # Получаем шаблон отчета
        report_template_obj = db.query(ReportTemplate).filter(
            ReportTemplate.profession_id == profession_id
        ).first()
        
        if not report_template_obj:
            raise HTTPException(status_code=404, detail="Report template not found")
        
        # Собираем все задания и ответы
        all_user_tasks = db.query(UserTask).join(Task).filter(
            UserTask.user_id == current_user.id,
            Task.scenario_id == scenario.id
        ).order_by(Task.order).all()
        
        all_tasks = [
            {"question": ut.question, "answer": ut.answer}
            for ut in all_user_tasks if ut.question and ut.answer
        ]
        
        # Генерируем финальный отчёт
        ai_start = time.time()
        logger.info(f"[TIMING] Calling AI service for final report...")
        final_report = generate_final_report(
            system_prompt=scenario.system_prompt,
            report_template=report_template_obj.template_text,
            all_tasks=all_tasks
        )
        ai_end = time.time()
        logger.info(f"[TIMING] AI service (final report) completed in {ai_end - ai_start:.3f} seconds")
        
        progress.status = "completed"
        progress.completed_at = datetime.utcnow()
        progress.final_report = final_report
        
        db.commit()
        
        request_end = time.time()
        logger.info(f"[TIMING] submit_task_answer TOTAL (with final report): {request_end - request_start:.3f} seconds")
        
        return {
            "completed": True,
            "final_report": final_report
        }
    else:
        # Есть еще задания - генерируем следующий вопрос
        next_task = db.query(Task).filter(
            Task.scenario_id == scenario.id,
            Task.order == task.order + 1
        ).first()
        
        if next_task:
            # Формируем промпт для следующего задания
            next_prompt = generate_next_task_prompt(
                current_task_order=task.order,
                user_answer=answer_data.answer,
                next_task_description=next_task.description_template
            )
            
            # Добавляем промпт в историю как user message
            conversation_history.append({
                "role": "user",
                "content": next_prompt
            })
            
            # Генерируем следующий вопрос
            ai_start = time.time()
            logger.info(f"[TIMING] Calling AI service for next question...")
            next_question = generate_task_question(
                system_prompt=scenario.system_prompt,
                task_description=next_prompt,
                conversation_history=[]  # Не передаем историю, т.к. она уже в промпте
            )
            ai_end = time.time()
            logger.info(f"[TIMING] AI service (next question) completed in {ai_end - ai_start:.3f} seconds")
            
            # Сохраняем вопрос AI в истории
            conversation_history.append({
                "role": "assistant",
                "content": next_question
            })
            
            progress.conversation_history = conversation_history
            
            db.commit()
            
            request_end = time.time()
            logger.info(f"[TIMING] submit_task_answer TOTAL (with next question): {request_end - request_start:.3f} seconds")
            
            return {
                "completed": False,
                "next_task": {
                    "id": next_task.id,
                    "order": next_task.order,
                    "type": next_task.type,
                    "time_limit_minutes": next_task.time_limit_minutes,
                    "question": next_question
                }
            }
        
        db.commit()
        
        request_end = time.time()
        logger.info(f"[TIMING] submit_task_answer TOTAL (no next question): {request_end - request_start:.3f} seconds")
        
        return {
            "completed": False,
            "message": "Task submitted successfully"
        }


@router.get("/profession/{profession_id}/report")
async def get_final_report(
    profession_id: int,
    attempt_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить финальный отчёт по профессии (по умолчанию - последняя попытка)"""
    query = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    )
    
    if attempt_number:
        # Конкретная попытка
        progress = query.filter(UserProgress.attempt_number == attempt_number).first()
    else:
        # Последняя попытка
        progress = query.order_by(desc(UserProgress.attempt_number)).first()
    
    if not progress or progress.status != "completed":
        raise HTTPException(status_code=404, detail="Report not available")
    
    return {
        "final_report": progress.final_report,
        "attempt_number": progress.attempt_number,
        "completed_at": progress.completed_at
    }
