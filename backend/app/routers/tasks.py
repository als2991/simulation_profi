from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import json
import logging
from app.database import get_db
from app.models import User, Task, UserTask, UserProgress, Scenario, Profession, ReportTemplate
from app.schemas import TaskResponse, UserTaskAnswer, UserTaskResponse
from app.auth import get_current_active_user
from app.ai_service import generate_task_question, generate_next_task_prompt, generate_final_report, generate_task_question_stream, generate_final_report_stream

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/profession/{profession_id}/current")
async def get_current_task(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить текущее задание для профессии и сгенерировать вопрос через AI (STREAMING)"""
    # Проверяем или создаем прогресс (берем последнюю попытку)
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).order_by(desc(UserProgress.attempt_number)).first()
    
    if not progress:
        # Создаем новый прогресс
        progress = UserProgress(
            user_id=current_user.id,
            profession_id=profession_id,
            status="in_progress",
            current_task_order=0,
            conversation_history=[],
            started_at=datetime.utcnow()
        )
        db.add(progress)
        db.commit()
    
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
    
    # Генерируем вопрос через AI (STREAMING)
    conversation_history = progress.conversation_history or []
    
    async def event_generator():
        try:
            import time
            import asyncio
            generator_start_time = time.time()
            logger.info(f"[STREAMING] event_generator START for user {current_user.id}, profession {profession_id}")
            
            # Проверяем, есть ли уже закешированный вопрос в истории
            existing_question = None
            if conversation_history:
                # Последний ассистент ответ - это наш текущий вопрос
                for msg in reversed(conversation_history):
                    if msg.get("role") == "assistant":
                        existing_question = msg.get("content")
                        break
            
            if existing_question:
                # Вопрос уже есть в кеше - отправляем сразу
                logger.info(f"[STREAMING] Using cached question for user {current_user.id}, profession {profession_id}")
                metadata = {
                    "type": "metadata",
                    "data": {
                        "id": task.id,
                        "order": task.order,
                        "task_type": task.type,
                        "time_limit_minutes": task.time_limit_minutes
                    }
                }
                yield f"data: {json.dumps(metadata, ensure_ascii=False)}\n\n"
                
                done_data = {
                    "type": "done",
                    "data": {
                        "full_text": existing_question,
                        "task_id": task.id
                    }
                }
                yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"
                return
            
            # Вопроса нет - стримим от OpenAI
            import time
            stream_start_time = time.time()
            logger.info(f"[STREAMING] get_current_task_stream START for user {current_user.id}, profession {profession_id}")
            
            # 1. Сразу отправляем metadata (чтобы UI мог подготовиться)
            metadata = {
                "type": "metadata",
                "data": {
                    "id": task.id,
                    "order": task.order,
                    "task_type": task.type,
                    "time_limit_minutes": task.time_limit_minutes
                }
            }
            logger.info(f"[STREAMING] Sending metadata immediately (before OpenAI)")
            yield f"data: {json.dumps(metadata, ensure_ascii=False)}\n\n"
            logger.info(f"[STREAMING] Metadata sent, starting OpenAI streaming...")
            
            # 2. Стримим токены от OpenAI
            full_text = ""
            for token in generate_task_question_stream(
                system_prompt=scenario.system_prompt,
                task_description=task.description_template,
                conversation_history=conversation_history
            ):
                full_text += token
                token_data = {
                    "type": "token",
                    "data": {"token": token}
                }
                yield f"data: {json.dumps(token_data, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0)  # Force flush after each token
            
            # 3. Сохраняем полный вопрос в историю
            conversation_history.append({
                "role": "assistant",
                "content": full_text
            })
            progress.conversation_history = conversation_history
            db.commit()
            
            # 4. Отправляем завершающий сигнал
            done_data = {
                "type": "done",
                "data": {
                    "full_text": full_text,
                    "task_id": task.id
                }
            }
            yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"
            
            logger.info(f"[STREAMING] Stream completed for user {current_user.id}, profession {profession_id}")
            
        except Exception as e:
            logger.error(f"[STREAMING] Error in stream: {e}", exc_info=True)
            error_data = {
                "type": "error",
                "data": {"message": str(e)}
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Отключаем буферизацию в Nginx
        }
    )


@router.post("/{task_id}/submit")
async def submit_task_answer(
    task_id: int,
    answer_data: UserTaskAnswer,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Отправить ответ на задание и получить следующий вопрос или завершить (STREAMING)"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    scenario = db.query(Scenario).filter(Scenario.id == task.scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Получаем прогресс (берем последнюю попытку) - СНАЧАЛА!
    profession_id = scenario.profession_id
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).order_by(desc(UserProgress.attempt_number)).first()
    
    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")
    
    # Проверяем, не отвечал ли уже пользователь в ТЕКУЩЕЙ попытке
    existing_user_task = db.query(UserTask).filter(
        UserTask.progress_id == progress.id,
        UserTask.task_id == task_id
    ).first()
    
    if existing_user_task:
        raise HTTPException(status_code=400, detail="Task already completed in this attempt")
    
    async def process_and_stream():
        try:
            import time
            start_time = time.time()
            logger.info(f"[TIMING] submit_task_answer START for task {task_id}")
            
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
            
            # ВАЖНО: Сначала делаем ВСЕ DB операции!
            # Сохраняем ответ пользователя
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
            
            db_time = time.time()
            logger.info(f"[TIMING] DB operations completed in {db_time - start_time:.3f} seconds")
            
            if task.order >= total_tasks:
                # Это было последнее задание - генерируем финальный отчёт
                
                # ВАЖНО: Сразу отправляем metadata, чтобы скрыть прогресс-бар!
                report_metadata_time = time.time()
                logger.info(f"[TIMING] Sending report metadata after {report_metadata_time - start_time:.3f} seconds")
                
                report_metadata = {
                    "type": "metadata",
                    "data": {
                        "completed": True,
                        "generating_report": True
                    }
                }
                yield f"data: {json.dumps(report_metadata, ensure_ascii=False)}\n\n"
                import asyncio
                await asyncio.sleep(0)  # Force flush to network
                logger.info(f"[TIMING] Report metadata sent (flushed), generating final report...")
                
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
                
                # Генерируем финальный отчёт (STREAMING!)
                full_report = ""
                token_count = 0
                for token in generate_final_report_stream(
                    system_prompt=scenario.system_prompt,
                    report_template=report_template_obj.template_text,
                    all_tasks=all_tasks
                ):
                    token_count += 1
                    full_report += token
                    token_data = {
                        "type": "report_token",
                        "data": {"token": token}
                    }
                    yield f"data: {json.dumps(token_data, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0)  # Force flush after each token
                
                progress.status = "completed"
                progress.completed_at = datetime.utcnow()
                progress.final_report = full_report
                progress.conversation_history = []  # Очищаем историю после завершения
                logger.info(f"[OPTIMIZATION] Cleared conversation_history after report generation (stream)")
                
                db.commit()
                
                done_data = {
                    "type": "completed",
                    "data": {"final_report": full_report}
                }
                yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"
            else:
                # Есть еще задания - генерируем следующий вопрос (STREAMING!)
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
                    
                    # ВАЖНО: СРАЗУ отправляем metadata (до OpenAI streaming!)
                    # Это позволит UI скрыть прогресс-бар немедленно!
                    metadata_time = time.time()
                    logger.info(f"[TIMING] Sending metadata after {metadata_time - start_time:.3f} seconds")
                    
                    metadata = {
                        "type": "metadata",
                        "data": {
                            "id": next_task.id,
                            "order": next_task.order,
                            "task_type": next_task.type,
                            "time_limit_minutes": next_task.time_limit_minutes,
                            "completed": False
                        }
                    }
                    yield f"data: {json.dumps(metadata, ensure_ascii=False)}\n\n"
                    import asyncio
                    await asyncio.sleep(0)  # Force flush to network
                    logger.info(f"[TIMING] Metadata sent (flushed), starting OpenAI streaming...")
                    
                    # Теперь стримим следующий вопрос от OpenAI
                    full_text = ""
                    for token in generate_task_question_stream(
                        system_prompt=scenario.system_prompt,
                        task_description=next_prompt,
                        conversation_history=[]  # Не передаем историю, т.к. она уже в промпте
                    ):
                        full_text += token
                        token_data = {
                            "type": "token",
                            "data": {"token": token}
                        }
                        yield f"data: {json.dumps(token_data, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0)  # Force flush after each token
                    
                    # Сохраняем вопрос AI в истории
                    conversation_history.append({
                        "role": "assistant",
                        "content": full_text
                    })
                    
                    progress.conversation_history = conversation_history
                    db.commit()
                    
                    done_data = {
                        "type": "done",
                        "data": {
                            "full_text": full_text,
                            "task_id": next_task.id,
                            "completed": False
                        }
                    }
                    yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"
                    
                    logger.info(f"[STREAMING] Stream completed for next task {next_task.id}")
                else:
                    # Нет следующего задания (не должно происходить)
                    db.commit()
                    done_data = {
                        "type": "done",
                        "data": {
                            "message": "Task submitted successfully",
                            "completed": False
                        }
                    }
                    yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"
        
        except Exception as e:
            logger.error(f"[STREAMING] Error in submit stream: {e}", exc_info=True)
            error_data = {
                "type": "error",
                "data": {"message": str(e)}
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        process_and_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Отключаем буферизацию в Nginx
        }
    )


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
        "completed_at": progress.completed_at
    }
