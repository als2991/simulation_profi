from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Profession, UserProgress
from app.schemas import ProfessionResponse, UserProgressResponse
from app.auth import get_current_active_user

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
    """Получить прогресс пользователя по профессии"""
    progress = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).first()
    
    if not progress:
        # Создаём начальный прогресс
        progress = UserProgress(
            user_id=current_user.id,
            profession_id=profession_id,
            status="not_started"
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)
    
    return progress
