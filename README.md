# Симулятор профессий

WEB-платформа для интерактивного прохождения симуляций профессий с оценкой AI.

## Структура проекта

```
├── frontend/          # Next.js приложение
├── backend/           # FastAPI приложение
├── database/          # SQL схемы и миграции
└── README.md
```

## Технологии

- **Frontend**: Next.js 14, React, TailwindCSS, TypeScript
- **Backend**: FastAPI, Python 3.11+
- **Database**: PostgreSQL 15+
- **AI**: OpenAI GPT-4 / GPT-4 Turbo
- **Payments**: ЮKassa

## Быстрый старт

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### База данных

```bash
# Создать базу данных PostgreSQL
createdb profession_simulator

# Применить миграции
psql -d profession_simulator -f database/schema.sql
```

## Переменные окружения

Создайте файлы `.env` в `backend/` и `frontend/`:

### backend/.env
```
DATABASE_URL=postgresql://user:password@localhost:5432/profession_simulator
OPENAI_API_KEY=your_openai_api_key
SECRET_KEY=your_secret_key_for_jwt
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
YUKASSA_SHOP_ID=your_shop_id
YUKASSA_SECRET_KEY=your_secret_key
```

### frontend/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
