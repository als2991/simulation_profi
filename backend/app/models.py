from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    user_tasks = relationship("UserTask", back_populates="user")
    user_progress = relationship("UserProgress", back_populates="user")
    payments = relationship("Payment", back_populates="user")


class Profession(Base):
    __tablename__ = "professions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    name_en = Column(String)
    description = Column(Text)
    description_en = Column(Text)
    language = Column(String, default="RUS")  # RUS, ENG
    category = Column(String)
    is_active = Column(Boolean, default=True)
    price = Column(Numeric(10, 2), default=990.00)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    scenarios = relationship("Scenario", back_populates="profession")
    user_progress = relationship("UserProgress", back_populates="profession")


class Scenario(Base):
    __tablename__ = "scenarios"
    
    id = Column(Integer, primary_key=True, index=True)
    profession_id = Column(Integer, ForeignKey("professions.id"), nullable=False)
    system_prompt = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    profession = relationship("Profession", back_populates="scenarios")
    tasks = relationship("Task", back_populates="scenario")


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    description_template = Column(Text, nullable=False)
    order = Column(Integer, nullable=False)
    type = Column(String)  # prioritization, conflict, deadline, risk, communication
    time_limit_minutes = Column(Integer, default=15)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    scenario = relationship("Scenario", back_populates="tasks")
    user_tasks = relationship("UserTask", back_populates="task")


class UserTask(Base):
    __tablename__ = "user_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    answer = Column(Text)
    ai_feedback = Column(Text)
    ai_metrics = Column(JSON)  # {systematicity: 8, stress_resistance: 7, ...}
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="user_tasks")
    task = relationship("Task", back_populates="user_tasks")


class UserProgress(Base):
    __tablename__ = "user_progress"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    profession_id = Column(Integer, ForeignKey("professions.id"), primary_key=True)
    status = Column(String, default="not_started")  # not_started, in_progress, completed
    current_task_order = Column(Integer, default=0)
    overall_metrics = Column(JSON)  # Итоговые метрики AI
    final_report = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="user_progress")
    profession = relationship("Profession", back_populates="user_progress")


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=True)
    profession_id = Column(Integer, ForeignKey("professions.id"), nullable=True)
    promocode = Column(String)
    discount_amount = Column(Numeric(10, 2), default=0)
    status = Column(String, default="pending")  # pending, completed, failed, refunded
    yukassa_payment_id = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="payments")
    package = relationship("Package", back_populates="payments")


class Package(Base):
    __tablename__ = "packages"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    profession_ids = Column(JSON)  # [1, 2, 3]
    price = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    payments = relationship("Payment", back_populates="package")


class Promocode(Base):
    __tablename__ = "promocodes"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    discount_percent = Column(Integer, default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    max_uses = Column(Integer)
    current_uses = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    valid_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_type = Column(String, nullable=False)  # task_started, task_completed, payment_completed, etc.
    event_metadata = Column(JSON)  # Переименовано из metadata, т.к. metadata зарезервировано в SQLAlchemy
    created_at = Column(DateTime(timezone=True), server_default=func.now())
