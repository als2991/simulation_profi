-- Миграция: Добавление поддержки множественных попыток прохождения профессий
-- Дата: 2026-01-15

BEGIN;

-- ============================================================
-- 1. Обновление таблицы user_progress
-- ============================================================

-- Удаляем старый первичный ключ
ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_pkey;

-- Добавляем id как первичный ключ
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS id SERIAL;
UPDATE user_progress SET id = DEFAULT WHERE id IS NULL;
ALTER TABLE user_progress ADD PRIMARY KEY (id);

-- Добавляем attempt_number
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

-- Для существующих записей устанавливаем attempt_number = 1
UPDATE user_progress SET attempt_number = 1 WHERE attempt_number IS NULL OR attempt_number = 0;

-- Создаем уникальный индекс для (user_id, profession_id, attempt_number)
DROP INDEX IF EXISTS idx_user_profession_attempt;
CREATE UNIQUE INDEX idx_user_profession_attempt 
ON user_progress(user_id, profession_id, attempt_number);

-- Создаем индекс для быстрого поиска последней попытки
DROP INDEX IF EXISTS idx_user_progress_latest;
CREATE INDEX idx_user_progress_latest 
ON user_progress(user_id, profession_id, completed_at DESC NULLS LAST);

-- ============================================================
-- 2. Обновление таблицы user_tasks
-- ============================================================

-- Добавляем attempt_number
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

-- Добавляем progress_id для связи с конкретной попыткой
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS progress_id INTEGER;

-- Создаем foreign key
ALTER TABLE user_tasks DROP CONSTRAINT IF EXISTS fk_user_tasks_progress;
ALTER TABLE user_tasks ADD CONSTRAINT fk_user_tasks_progress 
FOREIGN KEY (progress_id) REFERENCES user_progress(id) ON DELETE CASCADE;

-- Обновляем существующие записи: связываем с соответствующим progress
-- Находим progress_id для каждого user_task на основе user_id и profession_id задания
UPDATE user_tasks ut
SET progress_id = up.id,
    attempt_number = 1
FROM user_progress up, tasks t, scenarios s
WHERE t.id = ut.task_id
  AND s.id = t.scenario_id
  AND up.user_id = ut.user_id 
  AND up.profession_id = s.profession_id
  AND up.attempt_number = 1
  AND ut.progress_id IS NULL;

-- Создаем индекс для быстрого поиска заданий конкретной попытки
DROP INDEX IF EXISTS idx_user_tasks_progress;
CREATE INDEX idx_user_tasks_progress ON user_tasks(progress_id, task_id);

COMMIT;

-- ============================================================
-- Проверка миграции
-- ============================================================

-- Проверить структуру user_progress
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'user_progress'
ORDER BY ordinal_position;

-- Проверить индексы
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('user_progress', 'user_tasks')
ORDER BY tablename, indexname;

-- Проверить данные
SELECT 
    COUNT(*) as total_progress,
    COUNT(DISTINCT (user_id, profession_id)) as unique_combinations,
    MAX(attempt_number) as max_attempts
FROM user_progress;
