-- Создание базы данных и таблиц для Симулятора профессий

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Таблица профессий
CREATE TABLE IF NOT EXISTS professions (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    name_en VARCHAR,
    description TEXT,
    description_en TEXT,
    language VARCHAR DEFAULT 'RUS',
    category VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    price NUMERIC(10, 2) DEFAULT 990.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Таблица сценариев
CREATE TABLE IF NOT EXISTS scenarios (
    id SERIAL PRIMARY KEY,
    profession_id INTEGER NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Таблица заданий
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    description_template TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    type VARCHAR,
    time_limit_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ответов пользователей на задания
CREATE TABLE IF NOT EXISTS user_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    question TEXT,
    answer TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Таблица прогресса пользователя по профессиям
CREATE TABLE IF NOT EXISTS user_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profession_id INTEGER NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
    status VARCHAR DEFAULT 'not_started',
    current_task_order INTEGER DEFAULT 0,
    conversation_history JSONB,
    final_report TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, profession_id)
);

-- Таблица пакетов
CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    profession_ids JSONB,
    price NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица платежей
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
    profession_id INTEGER REFERENCES professions(id) ON DELETE SET NULL,
    promocode VARCHAR,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR DEFAULT 'pending',
    yukassa_payment_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Таблица промокодов
CREATE TABLE IF NOT EXISTS promocodes (
    id SERIAL PRIMARY KEY,
    code VARCHAR UNIQUE NOT NULL,
    discount_percent INTEGER DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица шаблонов для финальных отчетов
CREATE TABLE IF NOT EXISTS report_templates (
    id SERIAL PRIMARY KEY,
    profession_id INTEGER NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
    template_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Таблица событий для аналитики
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR NOT NULL,
    event_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_professions_active ON professions(is_active);
CREATE INDEX IF NOT EXISTS idx_scenarios_profession ON scenarios(profession_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scenario_order ON tasks(scenario_id, "order");
CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task ON user_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_profession ON user_progress(profession_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_promocodes_code ON promocodes(code);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- Вставка тестовых данных (опционально)
-- Пример профессии Project Manager
INSERT INTO professions (name, name_en, description, language, category, price) VALUES
('Project Manager', 'Project Manager', 'Сценарии для оценки системности, принятия решений и работы с конфликтами', 'RUS', 'Management', 990.00)
ON CONFLICT DO NOTHING;

-- Пример сценария для Project Manager
INSERT INTO scenarios (profession_id, system_prompt) VALUES
(1, 'Ты — интерактивная симуляция Project Manager. Давай пользователю реальные задания по приоритизации, конфликтам и дедлайнам. Не объясняй, не исправляй ответы, оцени решения по метрикам: системность, логика, стрессоустойчивость, принятие решений, эмпатия.')
ON CONFLICT DO NOTHING;

-- Примеры заданий
INSERT INTO tasks (scenario_id, description_template, "order", type, time_limit_minutes) VALUES
(1, 'Этап 0. Вводные:\nПрофессия: Project Manager\nФормат: интерактивная симуляция\nВремя: ~60–90 минут\nПравило: отвечай как на работе, без подсказок.\n\nПроект: B2B-сервис мониторинга для среднего бизнеса\nКоманда: 5 разработчиков, 1 дизайнер\nКлиент платит за результат, сроки критичны\nБюджет фиксированный, требования меняются\n\nЭтап 1. Приоритизация:\nПеред тобой список требований (10 пунктов) — все поступили одновременно.\nЗадание №1:\n1. Выбери ТОП-3 задачи, которые пойдут в работу прямо сейчас\n2. Кратко объясни почему именно они\n3. Укажи что откладываешь и какие риски принимаешь\nОтвечай структурировано, без лишнего.', 1, 'prioritization', 15),
(1, 'Теперь давай Задание №2 — конфликт команды и клиента.', 2, 'conflict', 15),
(1, 'Теперь дай Задание №3 — нужно принять решение по релизу с учётом риска 40%, ограничений сроков и требований.', 3, 'deadline', 15)
ON CONFLICT DO NOTHING;

-- Пример шаблона отчета
INSERT INTO report_templates (profession_id, template_text) VALUES
(1, 'Теперь на основании вопросов и ответов сформируй подробный отчёт по симуляции:\n1. Общая картина\n2. Приоритизация\n3. Работа с конфликтом\n4. Ключевое решение\n5. Профиль PM\n6. Где сильнее\n7. Честный вердикт')
ON CONFLICT DO NOTHING;

-- Пример пакета
INSERT INTO packages (name, description, profession_ids, price) VALUES
('Пакет из 3 профессий', 'Доступ к 3 профессиям по выгодной цене', '[1]', 2490.00),
('Пакет из 5 профессий', 'Доступ к 5 профессиям по максимальной выгоде', '[1]', 3990.00)
ON CONFLICT DO NOTHING;
