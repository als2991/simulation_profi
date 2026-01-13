# Инструкция по установке и запуску

## Предварительные требования

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- OpenAI API ключ

## Установка Backend

1. Перейдите в директорию backend:
```bash
cd backend
```

2. Создайте виртуальное окружение:
```bash
python -m venv venv
```

3. Активируйте виртуальное окружение:
- Windows:
```bash
venv\Scripts\activate
```
- Linux/Mac:
```bash
source venv/bin/activate
```

4. Установите зависимости:
```bash
pip install -r requirements.txt
```

5. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

6. Настройте переменные окружения в `.env`:
- `DATABASE_URL` - строка подключения к PostgreSQL
- `OPENAI_API_KEY` - ваш API ключ OpenAI
- `SECRET_KEY` - секретный ключ для JWT (сгенерируйте через `openssl rand -hex 32`)

## Установка Frontend

1. Перейдите в директорию frontend:
```bash
cd frontend
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env.local` на основе `.env.example`:
```bash
cp .env.example .env.local
```

4. Настройте переменные окружения в `.env.local`:
- `NEXT_PUBLIC_API_URL` - URL бэкенда (по умолчанию http://localhost:8000)

## Настройка базы данных

1. Создайте базу данных PostgreSQL:
```bash
createdb profession_simulator
```

2. Примените схему:
```bash
psql -d profession_simulator -f ../database/schema.sql
```

Или через psql:
```bash
psql -d profession_simulator
\i database/schema.sql
```

## Запуск приложения

### Backend

В директории `backend`:
```bash
uvicorn main:app --reload
```

Backend будет доступен по адресу: http://localhost:8000

API документация: http://localhost:8000/docs

### Frontend

В директории `frontend`:
```bash
npm run dev
```

Frontend будет доступен по адресу: http://localhost:3000

## Первый запуск

1. Запустите backend и frontend
2. Откройте http://localhost:3000
3. Зарегистрируйте нового пользователя
4. Для создания администратора выполните SQL запрос:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

## Тестовые данные

В файле `database/schema.sql` уже есть примеры:
- Профессия "Project Manager"
- Сценарий с системным промптом
- 3 задания для симуляции

## Структура проекта

```
├── backend/              # FastAPI приложение
│   ├── app/
│   │   ├── routers/     # API роутеры
│   │   ├── models.py    # SQLAlchemy модели
│   │   ├── schemas.py   # Pydantic схемы
│   │   ├── auth.py      # Аутентификация
│   │   └── ai_service.py # Интеграция с OpenAI
│   └── main.py          # Точка входа
├── frontend/            # Next.js приложение
│   ├── app/             # Страницы и компоненты
│   ├── lib/             # Утилиты и API клиент
│   └── store/           # Zustand store
└── database/            # SQL схемы
```

## Решение проблем

### Ошибка подключения к базе данных
- Проверьте, что PostgreSQL запущен
- Проверьте правильность `DATABASE_URL` в `.env`
- Убедитесь, что база данных создана

### Ошибка CORS
- Проверьте настройки CORS в `backend/main.py`
- Убедитесь, что URL фронтенда добавлен в `allow_origins`

### Ошибка OpenAI API
- Проверьте правильность `OPENAI_API_KEY`
- Убедитесь, что у вас есть доступ к GPT-4

## Дальнейшая разработка

- Интеграция с ЮKassa для платежей
- Расширение админ-панели
- Добавление новых профессий через админку
- Улучшение UI/UX
- Добавление аналитики
