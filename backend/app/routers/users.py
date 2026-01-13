from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserProgress, Profession
from app.schemas import UserResponse, UserProgressResponse
from app.auth import get_current_active_user
from typing import List

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: User = Depends(get_current_active_user)
):
    return current_user


@router.get("/progress", response_model=List[UserProgressResponse])
async def get_user_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить весь прогресс пользователя"""
    progress_list = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id
    ).all()
    return progress_list
