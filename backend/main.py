from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
import logging

from app.database import engine, Base
from app.routers import auth, professions, tasks, admin, payments, users
from app.config import settings

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

security = HTTPBearer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting application...")
    
    # Валидация критических переменных окружения
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "":
        logger.warning("⚠ OPENAI_API_KEY is not set! AI features will not work.")
    
    if settings.SECRET_KEY == "your-secret-key-change-in-production":
        logger.warning("⚠ SECRET_KEY is using default value! Change it in production!")
    
    # Создание таблиц лучше делать через миграции Alembic
    # Раскомментируйте следующую строку только для разработки
    # Base.metadata.create_all(bind=engine)
    try:
        # Проверяем подключение к БД
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.commit()
        logger.info("✓ Database connection successful")
    except Exception as e:
        logger.error(f"⚠ Warning: Could not connect to database: {e}")
        logger.error("  Make sure PostgreSQL is running and DATABASE_URL is correct")
        logger.error("  The server will start, but database operations will fail")
    
    yield
    # Shutdown
    logger.info("Shutting down application...")


app = FastAPI(
    title="Симулятор профессий API",
    description="API для платформы симуляции профессий",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
from app.config import settings

# Получаем список разрешённых origins из настроек
cors_origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(professions.router, prefix="/api/professions", tags=["professions"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])


@app.get("/")
async def root():
    return {"message": "Симулятор профессий API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
