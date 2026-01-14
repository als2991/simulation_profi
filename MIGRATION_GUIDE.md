# Руководство по миграции на новую версию (без метрик)

## Что изменилось

Система полностью переработана для использования диалоговой логики с OpenAI:

### Удалено:
- ❌ Метрики AI (ai_metrics, overall_metrics)
- ❌ AI feedback
- ❌ Промежуточные оценки заданий

### Добавлено:
- ✅ История диалога с AI (conversation_history)
- ✅ Таблица шаблонов отчетов (report_templates)
- ✅ Поле question в user_tasks
- ✅ Диалоговая генерация заданий

## Миграция базы данных

### 1. Создайте резервную копию

```bash
pg_dump profession_simulator > backup_before_migration_$(date +%Y%m%d).sql
```

### 2. Примените миграцию

```bash
psql -U your_user -d profession_simulator -f database/migration_remove_metrics.sql
```

### 3. Проверьте структуру

```bash
psql -U your_user -d profession_simulator -c "\d user_tasks"
psql -U your_user -d profession_simulator -c "\d user_progress"
psql -U your_user -d profession_simulator -c "\d report_templates"
```

## Обновление Backend

```bash
cd backend
source venv/bin/activate
git pull  # или скопируйте обновленные файлы
sudo systemctl restart profession-simulator
```

## Обновление Frontend

```bash
cd frontend
npm run build
# Перезапустите frontend сервер
```

## Новая логика работы

### 1. Первое задание
- Пользователь выбирает профессию
- Система берет `system_prompt` из таблицы `scenarios`
- Берет `description_template` из первого задания
- OpenAI генерирует вопрос
- Вопрос показывается пользователю

### 2. Следующие задания
- Пользователь отвечает
- Формируется промпт: "Пользователь ответил на задание №X: [ответ]. [description_template следующего задания]"
- OpenAI генерирует следующий вопрос
- Цикл повторяется

### 3. Финальный отчет
- После последнего задания
- Берется шаблон из `report_templates`
- Добавляются все вопросы и ответы
- OpenAI генерирует полный отчет
- Отчет сохраняется в `user_progress.final_report`

## Настройка для новых профессий

### 1. Создайте profession
```sql
INSERT INTO professions (name, description, price) VALUES
('Ваша профессия', 'Описание', 990.00);
```

### 2. Создайте scenario с system_prompt
```sql
INSERT INTO scenarios (profession_id, system_prompt) VALUES
(2, 'Ты — интерактивная симуляция профессии X. Твоя задача: задавать сценарии...');
```

### 3. Создайте задания
```sql
INSERT INTO tasks (scenario_id, description_template, "order", type, time_limit_minutes) VALUES
(2, 'Этап 0. Вводные:
Профессия: X
...
Задание №1: [описание]', 1, 'type1', 15),
(2, 'Теперь давай Задание №2 — [описание]', 2, 'type2', 15),
(2, 'Теперь дай Задание №3 — [описание]', 3, 'type3', 15);
```

### 4. Создайте шаблон отчета
```sql
INSERT INTO report_templates (profession_id, template_text) VALUES
(2, 'Теперь на основании вопросов и ответов сформируй подробный отчёт:
1. Пункт 1
2. Пункт 2
...');
```

## Тестирование

1. Запустите backend и проверьте логи
2. Зайдите на frontend
3. Выберите профессию
4. Пройдите симуляцию
5. Проверьте финальный отчет

## Откат (если нужно)

```bash
# Восстановите из резервной копии
dropdb profession_simulator
createdb profession_simulator
psql -U your_user -d profession_simulator < backup_before_migration_YYYYMMDD.sql

# Откатите код на предыдущую версию
git checkout previous_commit
```

## Важные замечания

- ⚠️ Старые прогрессы пользователей будут несовместимы с новой версией
- ⚠️ Рекомендуется либо очистить user_tasks и user_progress, либо уведомить пользователей о необходимости пройти симуляции заново
- ✅ Новая система более гибкая и естественная
- ✅ OpenAI полностью контролирует диалог
