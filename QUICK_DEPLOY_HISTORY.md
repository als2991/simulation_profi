# Быстрое развертывание истории прохождений

## 🚀 Команды для применения (копируйте по порядку)

### 1️⃣ Применить миграцию БД

```bash
ssh root@178.208.78.63
cd /root/simulation_profi
sudo -u postgres psql -d profession_simulator -f database/migration_add_attempts.sql
```

**Проверка:**
```bash
sudo -u postgres psql -d profession_simulator -c "\d user_progress"
```
Должны появиться столбцы `id` и `attempt_number`.

### 2️⃣ Перезапустить Backend

```bash
cd /root/simulation_profi/backend
sudo systemctl restart profession-simulator
sudo journalctl -u profession-simulator -n 20
```

**Проверка:**
```bash
curl http://localhost:8002/docs
```
Должен вернуть HTML страницу Swagger.

### 3️⃣ Обновить и перезапустить Frontend

```bash
cd /root/simulation_profi/frontend
npm run build
pm2 restart profession-simulator-frontend
pm2 logs profession-simulator-frontend --lines 20
```

**Проверка:**
```bash
pm2 status
```
Frontend должен быть `online`.

### 4️⃣ Проверить работу

Откройте сайт и:
1. Войдите в аккаунт
2. Перейдите на дашборд - должен показываться номер попытки
3. Откройте завершенную профессию
4. Должна появиться кнопка "Пройти заново"
5. Если есть >1 попытки - должна появиться "История прохождений"

## ✅ Что получили

- **Множественные прохождения**: пользователи могут проходить профессию сколько угодно раз
- **История**: все попытки сохраняются с отчетами и датами
- **Прогресс**: можно сравнить первую и последнюю попытку
- **Мотивация**: "Попытка 3", "Улучшите результат!"

## 🔧 Если что-то не работает

### Backend не запускается
```bash
cd /root/simulation_profi/backend
source venv/bin/activate
python -c "from app import models; print('OK')"
```

### Frontend не собирается
```bash
cd /root/simulation_profi/frontend
rm -rf .next node_modules/.cache
npm install
npm run build
```

### Миграция не применяется
```bash
# Проверьте подключение к БД
sudo -u postgres psql -d profession_simulator -c "SELECT 1"

# Посмотрите ошибки миграции
sudo -u postgres psql -d profession_simulator -f database/migration_add_attempts.sql 2>&1 | tail -50
```

## 📝 Rollback (если нужно откатить)

```sql
-- ОСТОРОЖНО! Удалит все данные о попытках!
BEGIN;

ALTER TABLE user_tasks DROP COLUMN IF EXISTS progress_id;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS attempt_number;

ALTER TABLE user_progress DROP COLUMN IF EXISTS attempt_number;
ALTER TABLE user_progress DROP COLUMN IF EXISTS id;

ALTER TABLE user_progress ADD PRIMARY KEY (user_id, profession_id);

ROLLBACK; -- Или COMMIT если уверены
```

## 📞 Поддержка

Если возникли проблемы - проверьте:
1. Логи backend: `sudo journalctl -u profession-simulator -n 50`
2. Логи frontend: `pm2 logs profession-simulator-frontend`
3. Статус БД: `sudo -u postgres psql -d profession_simulator -c "\dt"`
4. Версии: `python --version`, `node --version`, `npm --version`
