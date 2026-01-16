from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import User, Profession, UserProgress
from app.schemas import ProfessionResponse, UserProgressResponse, ProgressHistoryResponse, AttemptSummary
from app.auth import get_current_active_user
from app.config import settings

router = APIRouter()


@router.get("/", response_model=List[ProfessionResponse])
async def get_professions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить список всех активных профессий"""
    professions = db.query(Profession).filter(Profession.is_active == True).all()
    return professions


@router.get("/{profession_id}", response_model=ProfessionResponse)
async def get_profession(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить информацию о профессии"""
    profession = db.query(Profession).filter(Profession.id == profession_id).first()
    if not profession:
        raise HTTPException(status_code=404, detail="Profession not found")
    return profession


@router.get("/{profession_id}/progress", response_model=UserProgressResponse)
async def get_profession_progress(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить последнюю попытку прохождения профессии"""
    # Ищем последнюю попытку
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).order_by(desc(UserProgress.attempt_number)).first()
    
    if not progress:
        # Создаём начальную попытку (attempt_number = 1)
        progress = UserProgress(
            user_id=current_user.id,
            profession_id=profession_id,
            attempt_number=1,
            status="not_started"
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)
    
    return progress


@router.get("/{profession_id}/progress/history", response_model=ProgressHistoryResponse)
async def get_progress_history(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить историю всех попыток прохождения профессии"""
    attempts = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).order_by(desc(UserProgress.attempt_number)).all()
    
    return ProgressHistoryResponse(
        profession_id=profession_id,
        total_attempts=len(attempts),
        attempts=[AttemptSummary.model_validate(a) for a in attempts]
    )


@router.get("/{profession_id}/progress/{attempt_number}", response_model=UserProgressResponse)
async def get_specific_attempt(
    profession_id: int,
    attempt_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить конкретную попытку прохождения"""
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id,
        UserProgress.attempt_number == attempt_number
    ).first()
    
    if not progress:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    return progress


@router.post("/{profession_id}/progress/restart", response_model=UserProgressResponse)
async def restart_profession(
    profession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Начать новую попытку прохождения профессии"""
    # Проверяем существование профессии
    profession = db.query(Profession).filter(Profession.id == profession_id).first()
    if not profession:
        raise HTTPException(status_code=404, detail="Profession not found")
    
    # Находим максимальный номер попытки
    max_attempt = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).order_by(desc(UserProgress.attempt_number)).first()
    
    next_attempt = (max_attempt.attempt_number + 1) if max_attempt else 1
    
    # Проверяем лимит попыток
    if next_attempt > settings.MAX_PROFESSION_ATTEMPTS:
        raise HTTPException(
            status_code=400,
            detail=f"Достигнут лимит попыток прохождения профессии ({settings.MAX_PROFESSION_ATTEMPTS})"
        )
    
    # Создаём новую попытку
    new_progress = UserProgress(
        user_id=current_user.id,
        profession_id=profession_id,
        attempt_number=next_attempt,
        status="in_progress",
        current_task_order=0,
        conversation_history=[],
        started_at=datetime.utcnow()
    )
    db.add(new_progress)
    db.commit()
    db.refresh(new_progress)
    
    return new_progress
