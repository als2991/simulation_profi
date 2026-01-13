from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager

from app.database import engine, Base
from app.routers import auth, professions, tasks, admin, payments, users

security = HTTPBearer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Создание таблиц лучше делать через миграции Alembic
    # Раскомментируйте следующую строку только для разработки
    # Base.metadata.create_all(bind=engine)
    try:
        # Проверяем подключение к БД
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.commit()
        print("✓ Database connection successful")
    except Exception as e:
        print(f"⚠ Warning: Could not connect to database: {e}")
        print("  Make sure PostgreSQL is running and DATABASE_URL is correct")
        print("  The server will start, but database operations will fail")
    yield
    # Shutdown
    pass


app = FastAPI(
    title="Симулятор профессий API",
    description="API для платформы симуляции профессий",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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
