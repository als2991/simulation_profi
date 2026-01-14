from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    is_verified: bool
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Profession schemas
class ProfessionBase(BaseModel):
    name: str
    name_en: Optional[str] = None
    description: Optional[str] = None
    description_en: Optional[str] = None
    language: str = "RUS"
    category: Optional[str] = None
    price: float = 990.00


class ProfessionCreate(ProfessionBase):
    pass


class ProfessionResponse(ProfessionBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Scenario schemas
class ScenarioBase(BaseModel):
    profession_id: int
    system_prompt: str


class ScenarioCreate(ScenarioBase):
    pass


class ScenarioResponse(ScenarioBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Task schemas
class TaskBase(BaseModel):
    scenario_id: int
    description_template: str
    order: int
    type: str
    time_limit_minutes: int = 15


class TaskCreate(TaskBase):
    pass


class TaskResponse(BaseModel):
    id: int
    order: int
    type: str
    time_limit_minutes: int
    question: str  # Сгенерированный вопрос от AI
    
    class Config:
        from_attributes = True


# User Task schemas
class UserTaskAnswer(BaseModel):
    answer: str


class UserTaskResponse(BaseModel):
    id: int
    task_id: int
    question: Optional[str]
    answer: Optional[str]
    timestamp: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# User Progress schemas
class UserProgressResponse(BaseModel):
    profession_id: int
    status: str
    current_task_order: int
    conversation_history: Optional[List[Dict[str, str]]]
    final_report: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Report Template schemas
class ReportTemplateBase(BaseModel):
    profession_id: int
    template_text: str


class ReportTemplateCreate(ReportTemplateBase):
    pass


class ReportTemplateResponse(ReportTemplateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Payment schemas
class PaymentCreate(BaseModel):
    profession_id: Optional[int] = None
    package_id: Optional[int] = None
    promocode: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    amount: float
    status: str
    yukassa_payment_id: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Package schemas
class PackageBase(BaseModel):
    name: str
    description: Optional[str] = None
    profession_ids: List[int]
    price: float


class PackageCreate(PackageBase):
    pass


class PackageResponse(PackageBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Promocode schemas
class PromocodeCreate(BaseModel):
    code: str
    discount_percent: Optional[int] = 0
    discount_amount: Optional[float] = 0
    max_uses: Optional[int] = None
    valid_until: Optional[datetime] = None


class PromocodeResponse(BaseModel):
    id: int
    code: str
    discount_percent: int
    discount_amount: float
    max_uses: Optional[int]
    current_uses: int
    is_active: bool
    
    class Config:
        from_attributes = True
