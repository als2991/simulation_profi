# 🔍 Логирование времени выполнения (Performance Timing)

## 📋 Что добавлено

Добавлено детальное логирование времени выполнения для диагностики проблемы медленной загрузки заданий (30 секунд).

## 🎯 Измеряемые точки

### 1. **AI Service (`backend/app/ai_service.py`)**

#### `generate_task_question()`
- `[TIMING] OpenAI request START at YYYY-MM-DD HH:MM:SS.mmm` - Начало запроса к OpenAI
- `[TIMING] OpenAI request END at YYYY-MM-DD HH:MM:SS.mmm` - Конец запроса к OpenAI
- `[TIMING] OpenAI request duration: X.XXX seconds` - Длительность запроса к OpenAI

#### `generate_final_report()`
- `[TIMING] OpenAI request START at YYYY-MM-DD HH:MM:SS.mmm` - Начало запроса к OpenAI
- `[TIMING] OpenAI request END at YYYY-MM-DD HH:MM:SS.mmm` - Конец запроса к OpenAI
- `[TIMING] OpenAI request duration: X.XXX seconds` - Длительность запроса к OpenAI

### 2. **Tasks Router (`backend/app/routers/tasks.py`)**

#### `get_current_task()` - Получение текущего задания
- `[TIMING] get_current_task START for user X, profession Y` - Начало обработки запроса
- `[TIMING] Database queries completed in X.XXX seconds` - Время всех запросов к БД
- `[TIMING] Calling AI service...` - Начало вызова AI сервиса
- `[TIMING] AI service completed in X.XXX seconds` - Время выполнения AI сервиса
- `[TIMING] get_current_task TOTAL: X.XXX seconds` - Общее время обработки запроса

#### `submit_task_answer()` - Отправка ответа на задание
- `[TIMING] submit_task_answer START for user X, task Y` - Начало обработки запроса
- `[TIMING] Database queries completed in X.XXX seconds` - Время всех запросов к БД
- `[TIMING] Calling AI service for next question...` - Начало вызова AI для следующего вопроса
- `[TIMING] AI service (next question) completed in X.XXX seconds` - Время генерации следующего вопроса
- `[TIMING] Calling AI service for final report...` - Начало вызова AI для финального отчета
- `[TIMING] AI service (final report) completed in X.XXX seconds` - Время генерации отчета
- `[TIMING] submit_task_answer TOTAL: X.XXX seconds` - Общее время обработки запроса

## 📊 Как анализировать

### Пример нормальной работы:
```
[TIMING] get_current_task START for user 1, profession 1
[TIMING] Database queries completed in 0.023 seconds
[TIMING] Calling AI service...
[TIMING] OpenAI request START at 2026-01-17 15:30:45.123
[TIMING] OpenAI request END at 2026-01-17 15:30:47.456
[TIMING] OpenAI request duration: 2.333 seconds
[TIMING] AI service completed in 2.345 seconds
[TIMING] get_current_task TOTAL: 2.370 seconds
```

### Пример проблемы с БД:
```
[TIMING] get_current_task START for user 1, profession 1
[TIMING] Database queries completed in 15.678 seconds  ← ПРОБЛЕМА!
[TIMING] Calling AI service...
[TIMING] OpenAI request duration: 2.123 seconds
[TIMING] get_current_task TOTAL: 17.820 seconds
```

### Пример проблемы с сетью/OpenAI:
```
[TIMING] get_current_task START for user 1, profession 1
[TIMING] Database queries completed in 0.045 seconds
[TIMING] Calling AI service...
[TIMING] OpenAI request START at 2026-01-17 15:30:45.123
[TIMING] OpenAI request END at 2026-01-17 15:31:10.456  ← Прошло 25 секунд!
[TIMING] OpenAI request duration: 25.333 seconds  ← ПРОБЛЕМА!
[TIMING] AI service completed in 25.345 seconds
[TIMING] get_current_task TOTAL: 25.390 seconds
```

### Пример проблемы с задержкой между сервером и клиентом:
```
Backend лог:
[TIMING] get_current_task TOTAL: 2.370 seconds  ← Быстро!

Но в браузере консоли:
API call took: 30.123 seconds  ← ПРОБЛЕМА с сетью между клиентом и сервером!
```

## 🚀 Как использовать

### 1. Перезапустить backend
```bash
cd /root/simulation_profi/backend
source venv/bin/activate
sudo systemctl restart profession-simulator
# или
uvicorn main:app --host 0.0.0.0 --port 8002
```

### 2. Включить DEBUG_OPENAI_PROMPTS (опционально)
Если нужно видеть полные промпты и ответы:
```bash
# В backend/.env
DEBUG_OPENAI_PROMPTS=true
```

### 3. Воспроизвести проблему
- Откройте профессию
- Начните выполнять задания

### 4. Посмотреть логи
```bash
# Системные логи
sudo journalctl -u profession-simulator -f

# Или если запущен напрямую через uvicorn
# Логи будут в консоли
```

### 5. Анализировать
Найдите строки с `[TIMING]` и сравните время:
- **БД запросы** должны быть < 0.1 сек
- **OpenAI запросы** должны быть 1-5 сек (зависит от длины ответа)
- **Общее время** должно быть близко к сумме БД + OpenAI

Если:
- **БД медленно** → проблема с PostgreSQL (индексы, производительность)
- **OpenAI медленно** → проблема с сетью до OpenAI или их загрузка
- **Общее время ~ (БД + OpenAI), но клиент видит 30 сек** → проблема с сетью между клиентом и сервером

## 🔧 Возможные решения

### Если медленно БД:
```sql
-- Проверить индексы
\d user_progress
\d user_tasks

-- Анализ запросов
EXPLAIN ANALYZE SELECT * FROM user_progress WHERE user_id = 1 AND profession_id = 1;
```

### Если медленно OpenAI:
- Проверить `OPENAI_BASE_URL` в `.env`
- Проверить сеть до OpenAI: `curl -I https://api.openai.com`
- Попробовать через VPN/прокси
- Уменьшить `max_completion_tokens`

### Если медленно между клиентом и сервером:
- Проверить пинг: `ping 178.208.78.63`
- Проверить трассировку: `traceroute 178.208.78.63`
- Проверить файрволл/провайдера
- Использовать CDN/оптимизировать ответы

## 📝 Файлы изменены
- `backend/app/ai_service.py` - добавлено логирование времени OpenAI запросов
- `backend/app/routers/tasks.py` - добавлено логирование времени обработки эндпоинтов
