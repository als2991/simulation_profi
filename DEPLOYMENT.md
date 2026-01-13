# Руководство по развёртыванию

## Подготовка к развёртыванию

### 1. Настройка базы данных PostgreSQL

#### Локально
```bash
# Установка PostgreSQL (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Создание базы данных
sudo -u postgres psql
CREATE DATABASE profession_simulator;
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE profession_simulator TO your_user;
\q

# Применение схемы
psql -U your_user -d profession_simulator -f database/schema.sql
```

#### Облачный сервис (DigitalOcean, AWS RDS)
1. Создайте managed PostgreSQL instance
2. Получите connection string
3. Обновите `DATABASE_URL` в `.env`

### 2. Настройка OpenAI API

1. Зарегистрируйтесь на https://platform.openai.com
2. Создайте API ключ
3. Добавьте ключ в `backend/.env`:
```
OPENAI_API_KEY=sk-...
```

### 3. Настройка ЮKassa

1. Зарегистрируйтесь на https://yookassa.ru
2. Получите Shop ID и Secret Key
3. Добавьте в `backend/.env`:
```
YUKASSA_SHOP_ID=...
YUKASSA_SECRET_KEY=...
```

### 4. Генерация SECRET_KEY

```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Добавьте результат в `backend/.env`:
```
SECRET_KEY=your_generated_secret_key
```

## Развёртывание Backend

### Вариант 1: Docker (рекомендуется)

Создайте `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Создайте `backend/docker-compose.yml`:
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
    restart: unless-stopped
```

Запуск:
```bash
cd backend
docker-compose up -d
```

### Вариант 2: Прямой запуск на сервере

```bash
# На сервере Linux
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Настройте systemd service
sudo nano /etc/systemd/system/profession-simulator.service
```

Содержимое файла service:
```ini
[Unit]
Description=Profession Simulator API
After=network.target

[Service]
User=your_user
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Активация:
```bash
sudo systemctl enable profession-simulator
sudo systemctl start profession-simulator
```

### Вариант 3: Cloud платформы

#### Heroku
```bash
heroku create profession-simulator-api
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set OPENAI_API_KEY=...
heroku config:set SECRET_KEY=...
git push heroku main
```

#### Railway
1. Подключите GitHub репозиторий
2. Добавьте переменные окружения
3. Railway автоматически развернёт приложение

## Развёртывание Frontend

### Вариант 1: Vercel (рекомендуется для Next.js)

1. Установите Vercel CLI:
```bash
npm i -g vercel
```

2. Разверните:
```bash
cd frontend
vercel
```

3. Настройте переменные окружения в Vercel Dashboard:
- `NEXT_PUBLIC_API_URL` - URL вашего backend API

### Вариант 2: Docker

Создайте `frontend/Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

Обновите `next.config.js`:
```javascript
module.exports = {
  output: 'standalone',
  // ... остальные настройки
}
```

### Вариант 3: Статический экспорт

```bash
cd frontend
npm run build
# Файлы в out/ можно развернуть на любом статическом хостинге
```

## Настройка Nginx (опционально)

Если развёртываете на собственном сервере:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## SSL сертификат (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Мониторинг и логи

### Логи Backend
```bash
# Docker
docker-compose logs -f backend

# Systemd
sudo journalctl -u profession-simulator -f
```

### Мониторинг базы данных
- Используйте pgAdmin или аналогичные инструменты
- Настройте алерты на высокую нагрузку

## Резервное копирование

### База данных
```bash
# Ежедневный бэкап
pg_dump profession_simulator > backup_$(date +%Y%m%d).sql

# Восстановление
psql profession_simulator < backup_20240101.sql
```

### Автоматизация через cron
```bash
0 2 * * * pg_dump profession_simulator > /backups/db_$(date +\%Y\%m\%d).sql
```

## Обновление приложения

```bash
# Backend
cd backend
git pull
docker-compose restart  # или systemctl restart profession-simulator

# Frontend
cd frontend
git pull
npm run build
# Перезапуск зависит от платформы развёртывания
```

## Проверка работоспособности

1. Backend health check:
```bash
curl http://your-api-url/health
```

2. Frontend доступность:
Откройте в браузере `http://your-frontend-url`

3. Проверка API:
```bash
curl http://your-api-url/docs
```

## Безопасность

1. **Никогда не коммитьте `.env` файлы**
2. Используйте сильные пароли для БД
3. Настройте firewall (только необходимые порты)
4. Регулярно обновляйте зависимости
5. Используйте HTTPS для production
6. Настройте rate limiting для API

## Масштабирование

### Горизонтальное масштабирование Backend

1. Запустите несколько инстансов backend
2. Используйте load balancer (Nginx, HAProxy)
3. Настройте shared session storage (Redis)

### Оптимизация базы данных

1. Добавьте индексы на часто используемые поля
2. Настройте connection pooling
3. Используйте read replicas для чтения

## Troubleshooting

### Backend не запускается
- Проверьте логи: `docker-compose logs backend`
- Проверьте переменные окружения
- Убедитесь, что порт 8000 свободен

### Ошибки подключения к БД
- Проверьте `DATABASE_URL`
- Убедитесь, что PostgreSQL запущен
- Проверьте firewall правила

### Frontend не подключается к API
- Проверьте `NEXT_PUBLIC_API_URL`
- Проверьте CORS настройки в backend
- Проверьте сетевую доступность API
