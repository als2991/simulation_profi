from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Profession, Scenario, Task, Package, Promocode
from app.schemas import (
    ProfessionCreate, ProfessionResponse,
    ScenarioCreate, ScenarioResponse,
    TaskCreate, TaskResponse,
    PackageCreate, PackageResponse,
    PromocodeCreate, PromocodeResponse
)
from app.auth import get_current_active_user

router = APIRouter()


# Проверка прав администратора
async def get_admin_user(current_user: User = Depends(get_current_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# Управление профессиями
@router.post("/professions", response_model=ProfessionResponse)
async def create_profession(
    profession_data: ProfessionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    profession = Profession(**profession_data.dict())
    db.add(profession)
    db.commit()
    db.refresh(profession)
    return profession


@router.put("/professions/{profession_id}", response_model=ProfessionResponse)
async def update_profession(
    profession_id: int,
    profession_data: ProfessionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    profession = db.query(Profession).filter(Profession.id == profession_id).first()
    if not profession:
        raise HTTPException(status_code=404, detail="Profession not found")
    
    for key, value in profession_data.dict().items():
        setattr(profession, key, value)
    
    db.commit()
    db.refresh(profession)
    return profession


# Управление сценариями
@router.post("/scenarios", response_model=ScenarioResponse)
async def create_scenario(
    scenario_data: ScenarioCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    scenario = Scenario(**scenario_data.dict())
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: int,
    scenario_data: ScenarioCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    for key, value in scenario_data.dict().items():
        setattr(scenario, key, value)
    
    db.commit()
    db.refresh(scenario)
    return scenario


# Управление заданиями
@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    task = Task(**task_data.dict())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for key, value in task_data.dict().items():
        setattr(task, key, value)
    
    db.commit()
    db.refresh(task)
    return task


# Управление пакетами
@router.post("/packages", response_model=PackageResponse)
async def create_package(
    package_data: PackageCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    package = Package(**package_data.dict())
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@router.get("/packages", response_model=List[PackageResponse])
async def get_packages(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    return db.query(Package).filter(Package.is_active == True).all()


# Управление промокодами
@router.post("/promocodes", response_model=PromocodeResponse)
async def create_promocode(
    promocode_data: PromocodeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    promocode = Promocode(**promocode_data.dict())
    db.add(promocode)
    db.commit()
    db.refresh(promocode)
    return promocode


@router.get("/promocodes", response_model=List[PromocodeResponse])
async def get_promocodes(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    return db.query(Promocode).all()
