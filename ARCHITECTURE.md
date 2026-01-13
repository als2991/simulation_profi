# Архитектура проекта "Симулятор профессий"

## Обзор

Платформа состоит из трёх основных компонентов:
1. **Frontend** (Next.js) - пользовательский интерфейс
2. **Backend** (FastAPI) - API и бизнес-логика
3. **Database** (PostgreSQL) - хранение данных

## Backend архитектура

### Структура

```
backend/
├── app/
│   ├── routers/          # API endpoints
│   │   ├── auth.py       # Авторизация и регистрация
│   │   ├── professions.py # Управление профессиями
│   │   ├── tasks.py      # Задания и AI оценка
│   │   ├── admin.py      # Админ-панель API
│   │   ├── payments.py   # Платежи и промокоды
│   │   └── users.py      # Профиль пользователя
│   ├── payments/
│   │   └── yukassa.py    # Интеграция с ЮKassa
│   ├── models.py         # SQLAlchemy модели
│   ├── schemas.py        # Pydantic схемы
│   ├── auth.py           # JWT аутентификация
│   ├── ai_service.py     # Интеграция с OpenAI
│   ├── database.py       # Подключение к БД
│   └── config.py         # Конфигурация
└── main.py               # Точка входа FastAPI
```

### API Endpoints

#### Авторизация (`/api/auth`)
- `POST /register` - Регистрация нового пользователя
- `POST /login` - Вход в систему
- `GET /me` - Получить информацию о текущем пользователе

#### Профессии (`/api/professions`)
- `GET /` - Список всех активных профессий
- `GET /{id}` - Информация о профессии
- `GET /{id}/progress` - Прогресс пользователя по профессии

#### Задания (`/api/tasks`)
- `GET /profession/{id}/current` - Получить текущее задание
- `POST /{id}/generate` - Сгенерировать конкретное задание через AI
- `POST /{id}/submit` - Отправить ответ и получить оценку AI
- `GET /profession/{id}/report` - Получить финальный отчёт

#### Платежи (`/api/payments`)
- `GET /packages` - Список доступных пакетов
- `POST /create` - Создать платёж
- `POST /webhook` - Webhook от ЮKassa
- `POST /{id}/confirm` - Подтвердить платёж
- `GET /history` - История платежей

#### Админ (`/api/admin`)
- `POST /professions` - Создать профессию
- `PUT /professions/{id}` - Обновить профессию
- `POST /scenarios` - Создать сценарий
- `POST /tasks` - Создать задание
- `POST /packages` - Создать пакет
- `POST /promocodes` - Создать промокод

## Frontend архитектура

### Структура

```
frontend/
├── app/
│   ├── page.tsx              # Главная страница (редирект)
│   ├── login/
│   │   └── page.tsx          # Страница входа/регистрации
│   ├── dashboard/
│   │   └── page.tsx          # Дашборд с профессиями
│   ├── profession/
│   │   └── [id]/
│   │       └── page.tsx      # Страница прохождения профессии
│   └── admin/
│       └── page.tsx          # Админ-панель
├── lib/
│   └── api.ts                # API клиент
└── store/
    └── authStore.ts           # Zustand store для авторизации
```

### Компоненты

- **Login Page** - Авторизация и регистрация
- **Dashboard** - Список профессий с прогрессом
- **Profession Page** - Прохождение заданий, таймер, отправка ответов
- **Admin Panel** - Управление профессиями, сценариями, пакетами

## База данных

### Основные таблицы

1. **users** - Пользователи системы
2. **professions** - Профессии для симуляции
3. **scenarios** - Сценарии с system prompts
4. **tasks** - Шаблоны заданий
5. **user_tasks** - Ответы пользователей и оценки AI
6. **user_progress** - Прогресс по профессиям
7. **packages** - Пакеты профессий
8. **payments** - Платежи
9. **promocodes** - Промокоды
10. **events** - События для аналитики

### Связи

- `professions` → `scenarios` (1:N)
- `scenarios` → `tasks` (1:N)
- `users` → `user_tasks` (1:N)
- `users` → `user_progress` (1:N)
- `users` → `payments` (1:N)

## AI интеграция

### OpenAI GPT-4

Используется для трёх задач:

1. **Генерация заданий** (`generate_task`)
   - Вход: system_prompt, task_template, user_history
   - Выход: конкретное задание для пользователя

2. **Оценка ответов** (`evaluate_answer`)
   - Вход: system_prompt, task_description, user_answer, task_type
   - Выход: метрики (systematicity, stress_resistance, decision_making, empathy, logic) и обратная связь

3. **Финальный отчёт** (`generate_final_report`)
   - Вход: system_prompt, profession_name, all_metrics, all_answers
   - Выход: подробный отчёт с анализом и рекомендациями

### Метрики оценки

- **systematicity** (системность) - способность структурировать подход
- **stress_resistance** (стрессоустойчивость) - работа под давлением
- **decision_making** (принятие решений) - качество решений
- **empathy** (эмпатия) - понимание других людей
- **logic** (логика) - логическое мышление

## Платежи

### ЮKassa интеграция

1. Создание платежа через API ЮKassa
2. Получение confirmation_url для редиректа
3. Webhook для обработки успешных платежей
4. Автоматическое предоставление доступа к профессиям

### Промокоды

- Процентная скидка или фиксированная сумма
- Ограничение по количеству использований
- Срок действия

## Безопасность

- JWT токены для аутентификации
- Хеширование паролей (bcrypt)
- Проверка прав администратора
- Валидация данных через Pydantic
- CORS настройки для фронтенда

## Масштабируемость

### Горизонтальное масштабирование

- Stateless backend (можно запускать несколько инстансов)
- База данных с репликацией
- Кэширование часто запрашиваемых данных
- Очереди для AI запросов (опционально)

### Вертикальное масштабирование

- Увеличение ресурсов сервера
- Оптимизация запросов к БД
- Индексы на часто используемых полях

## Развёртывание

### Рекомендуемая инфраструктура

- **Backend**: Docker контейнер на Linux сервере (AWS EC2, DigitalOcean, etc.)
- **Frontend**: Vercel или аналогичный сервис для Next.js
- **Database**: Managed PostgreSQL (AWS RDS, DigitalOcean Managed DB)
- **AI**: OpenAI API (внешний сервис)

### Переменные окружения

Все чувствительные данные хранятся в переменных окружения:
- `DATABASE_URL`
- `SECRET_KEY`
- `OPENAI_API_KEY`
- `YUKASSA_SHOP_ID` и `YUKASSA_SECRET_KEY`
