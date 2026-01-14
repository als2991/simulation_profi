-- Миграция для перехода на новую логику без метрик
-- Дата: 2026-01-14

-- Добавляем новые поля и таблицы
ALTER TABLE user_tasks 
  ADD COLUMN IF NOT EXISTS question TEXT,
  DROP COLUMN IF EXISTS ai_feedback,
  DROP COLUMN IF EXISTS ai_metrics;

ALTER TABLE user_progress 
  ADD COLUMN IF NOT EXISTS conversation_history JSONB,
  DROP COLUMN IF EXISTS overall_metrics;

-- Создаем таблицу для шаблонов отчетов
CREATE TABLE IF NOT EXISTS report_templates (
    id SERIAL PRIMARY KEY,
    profession_id INTEGER NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
    template_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Вставляем дефолтный шаблон для первой профессии
INSERT INTO report_templates (profession_id, template_text) VALUES
(1, 'Теперь на основании вопросов и ответов сформируй подробный отчёт по симуляции:
1. Общая картина
2. Приоритизация
3. Работа с конфликтом
4. Ключевое решение
5. Профиль PM
6. Где сильнее
7. Честный вердикт')
ON CONFLICT DO NOTHING;

-- Обновляем примеры заданий для первой профессии
UPDATE tasks SET description_template = 
'Этап 0. Вводные:
Профессия: Project Manager
Формат: интерактивная симуляция
Время: ~60–90 минут
Правило: отвечай как на работе, без подсказок.

Проект: B2B-сервис мониторинга для среднего бизнеса
Команда: 5 разработчиков, 1 дизайнер
Клиент платит за результат, сроки критичны
Бюджет фиксированный, требования меняются

Этап 1. Приоритизация:
Перед тобой список требований (10 пунктов) — все поступили одновременно.
Задание №1:
1. Выбери ТОП-3 задачи, которые пойдут в работу прямо сейчас
2. Кратко объясни почему именно они
3. Укажи что откладываешь и какие риски принимаешь
Отвечай структурировано, без лишнего.'
WHERE "order" = 1 AND scenario_id = 1;

UPDATE tasks SET description_template = 'Теперь давай Задание №2 — конфликт команды и клиента.'
WHERE "order" = 2 AND scenario_id = 1;

UPDATE tasks SET description_template = 'Теперь дай Задание №3 — нужно принять решение по релизу с учётом риска 40%, ограничений сроков и требований.'
WHERE "order" = 3 AND scenario_id = 1;

-- Очищаем старые данные пользователей (опционально)
-- TRUNCATE user_tasks, user_progress CASCADE;

COMMIT;
