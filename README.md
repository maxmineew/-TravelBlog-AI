# TravelBlog AI 🌍

Telegram Mini App + Bot для генерации тревел-контента о путешествиях по России.

## Архитектура

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐
│  Telegram    │◄──►│  Express.js  │◄──►│  GigaChat /    │
│  Mini App    │    │  Backend     │    │  YandexGPT     │
│  (WebApp)    │    │              │    │  (AI Provider)  │
└─────────────┘    └──────┬───────┘    └────────────────┘
                          │
┌─────────────┐    ┌──────┴───────┐
│  Telegram   │◄──►│  Bot         │
│  User       │    │  (polling)   │
└─────────────┘    └──────────────┘
```

- **Frontend**: Vanilla JS Mini App, Telegram WebApp API
- **Backend**: Node.js + Express
- **AI**: GigaChat (Sber) / YandexGPT / Mock
- **Auth**: HMAC-валидация initData
- **Хранение**: in-memory (MVP), localStorage на клиенте
- **Лимиты**: 14 генераций/день (free), без лимита (premium)

## Структура проекта

```
travelblog-ai/
├── frontend/
│   ├── index.html          # Mini App SPA
│   ├── style.css           # Стили (Telegram theme)
│   └── script.js           # Логика приложения
├── backend/
│   ├── server.js           # Express API + статика
│   ├── ai.js               # GigaChat + YandexGPT + Mock
│   ├── auth.js             # Валидация initData (HMAC)
│   ├── package.json
│   └── .env.example
├── bot/
│   └── bot.js              # Telegram бот (/start, Mini App кнопка)
├── data/
│   └── russia_places.json  # 23 локации РФ
└── README.md
```

## Быстрый старт (локально)

### 1. Установка

```bash
cd backend
npm install
```

### 2. Настройка окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
BOT_TOKEN=ваш_токен_бота
WEBAPP_URL=https://ваш-домен.com
AI_PROVIDER=mock                    # mock / gigachat / yandexgpt
NODE_ENV=development
```

> **Mock-режим**: работает без ключей AI — идеален для тестирования.

### 3. Запуск

```bash
npm start
```

Сервер запустится на `http://localhost:3000`.

### 4. Тест через curl

```bash
# Health check
curl http://localhost:3000/api/health

# Генерация (в dev-режиме авторизация не требуется)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "placeId": "nizhny",
    "contentType": "post",
    "style": "family",
    "audience": "family",
    "language": "ru"
  }'
```

### 5. Туннель для Telegram (ngrok)

```bash
npx ngrok http 3000
```

Скопируйте HTTPS-URL и вставьте в `WEBAPP_URL` в `.env`.
Перезапустите сервер.

## Настройка AI-провайдеров

### GigaChat (Sber)

1. Зарегистрируйтесь на [developers.sber.ru](https://developers.sber.ru)
2. Создайте проект, получите `client_id` и `client_secret`
3. В `.env`:

```env
AI_PROVIDER=gigachat
GIGACHAT_CLIENT_ID=ваш_client_id
GIGACHAT_CLIENT_SECRET=ваш_client_secret
```

> **SSL**: GigaChat использует сертификаты Минцифры. Если возникает ошибка SSL,
> добавьте в `.env`: `NODE_TLS_REJECT_UNAUTHORIZED=0` (только для разработки).

Токен обновляется автоматически каждые 28 минут (истекает через 30).

### YandexGPT

1. Зарегистрируйтесь в [Yandex Cloud](https://cloud.yandex.ru)
2. Создайте API-ключ и получите folder_id
3. В `.env`:

```env
AI_PROVIDER=yandexgpt
YANDEX_API_KEY=ваш_api_key
YANDEX_FOLDER_ID=ваш_folder_id
```

## Создание Telegram-бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` → задайте имя и username
3. Скопируйте токен в `BOT_TOKEN`
4. `/mybots` → выберите бота → Bot Settings → Menu Button → задайте URL Mini App

## Примеры генерации

### Пример 1: Пост (Нижний Новгород, семейный)

**Запрос:**
```json
{
  "placeId": "nizhny",
  "contentType": "post",
  "style": "family",
  "audience": "family",
  "language": "ru"
}
```

**Примерный ответ:**

> 🏠 **Нижний Новгород с детьми — город, в который хочется вернуться!**
>
> Мы приехали сюда всей семьёй на выходные и были покорены. Представьте: вы стоите на высоком берегу, где Ока впадает в Волгу, а дети в восторге от канатной дороги через реку!
>
> 🎯 Что мы успели:
> • Канатная дорога — дети назвали это «полётом над рекой»
> • Кремль — территория огромная, есть где побегать
> • Покровская улица — мороженое и уличные музыканты
> • Речная прогулка — час на кораблике, шикарные виды
>
> 💡 Совет: берите удобную обувь — город холмистый!
>
> 📌 Сохраняйте и планируйте поездку!
>
> #НижнийНовгород #ПутешествияСДетьми #Россия #СемейныйОтдых #Волга #ЗолотоеКольцо #ТревелБлог

### Пример 2: Image Prompt (Байкал, экстрим)

**Запрос:**
```json
{
  "placeId": "baikal",
  "contentType": "image",
  "style": "extreme",
  "audience": "solo",
  "language": "ru"
}
```

**Примерный ответ:**

> **Prompt 1:** Extreme ice diving beneath crystal-clear Lake Baikal surface, diver silhouette visible through transparent ice from above, deep blue frozen bubbles pattern, dramatic natural lighting penetrating ice layer, underwater photography, ultra-detailed 8k
>
> **Prompt 2:** Solo adventurer on mountain bike riding across frozen Lake Baikal, massive ice cracks beneath wheels, snow-capped Siberian mountains in background, low winter sun creating long shadows, action sports photography, GoPro wide angle perspective
>
> **Prompt 3:** Dramatic campsite on Lake Baikal shore at twilight, expedition tent glowing from inside, frozen lake surface stretching to horizon, Milky Way appearing in dark sky above, extreme cold vapor rising from ice, cinematic landscape photography

## Деплой (Production)

### Рекомендуемый хостинг: Timeweb Cloud

1. Создайте Cloud-сервер (Ubuntu 22.04, от 1 vCPU / 1 GB RAM)
2. Подключитесь по SSH

```bash
# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Загрузка проекта
cd /opt
git clone <your-repo-url>  
cd travelblog-ai/backend
npm install --production

# Настройка окружения
cp .env.example .env
nano .env   # заполнить реальные значения

# PM2
sudo npm install -g pm2
pm2 start server.js --name  
pm2 startup
pm2 save
```

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo apt install -y nginx
sudo ln -s /etc/nginx/sites-available/travelblog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL (Let's Encrypt)

```bash

sudo certbot --nginx -d your-domain.com
```

### Альтернативные хостинги

| Хостинг | Плюсы | Минусы |
|---------|-------|--------|
| **Timeweb Cloud** | Простой UI, русская поддержка, от ~300₽/мес | Нет бесплатного тарифа |
| **Selectel** | Надёжность, SLA, гибкие тарифы | Сложнее интерфейс |
| **Yandex Cloud** | Интеграция с YandexGPT, бесплатный грант | Более сложная настройка |

## Freemium

- **Free**: 14 генераций/день (сбрасывается в полночь)
- **Premium**: без лимита (определяется по `is_premium` в Telegram initData)

### MVP-вариант премиум-оплаты

Полноценная оплата через Telegram Payments требует интеграции с платёжным провайдером.
Для MVP используется нативный статус Telegram Premium — подписчики Premium не имеют лимитов.

Если нужна кастомная подписка, рекомендуется:
1. Telegram Stars (Telegram Payments API v2)
2. ЮKassa / Tinkoff через webhook

## Ограничения и риски

### Текущие ограничения MVP

- **Хранение данных** — in-memory, при перезапуске сервера история теряется.
  *Решение*: подключить SQLite/PostgreSQL.
- **GigaChat SSL** — сертификаты Минцифры могут не распознаваться.
  *Fallback*: `NODE_TLS_REJECT_UNAUTHORIZED=0` или установка корневого сертификата.
- **Telegram WebApp API** — CloudStorage доступен с Telegram 6.9+.
  *Fallback*: используется localStorage.
- **Mock-провайдер** — возвращает шаблонные ответы, для реальной работы нужен API-ключ.

### Зависимости от версии Telegram

| Функция | Мин. версия |
|---------|-------------|
| WebApp basic | 6.0 |
| MainButton | 6.0 |
| BackButton | 6.1 |
| HapticFeedback | 6.1 |
| CloudStorage | 6.9 |
| closingConfirmation | 6.2 |

### Что нужно для production

- [ ] Persistent storage (PostgreSQL / SQLite)
- [ ] Redis для rate-limiting и кеша токенов
- [ ] Мониторинг (PM2 + Grafana / Sentry)
- [ ] CI/CD pipeline
- [ ] Логирование запросов
- [ ] Бэкап данных
- [ ] Нагрузочное тестирование

## Чек-лист запуска

1. ✅ Получить BOT_TOKEN у @BotFather
2. ✅ `cd backend && npm install`
3. ✅ `cp .env.example .env` → заполнить токен
4. ✅ `npm start` → проверить http://localhost:3000
5. ✅ `curl http://localhost:3000/api/health` → `{"status":"ok"}`
6. ✅ Открыть http://localhost:3000 в браузере → работает Mini App
7. ✅ `npx ngrok http 3000` → получить HTTPS-URL
8. ✅ Вписать URL в `WEBAPP_URL` и перезапустить
9. ✅ Открыть бота в Telegram → `/start` → кнопка Mini App работает
10. ✅ Сгенерировать тестовый контент в Mock-режиме
11. ✅ Настроить GigaChat или YandexGPT → `AI_PROVIDER=gigachat`
12. ✅ Задеплоить на сервер (Timeweb Cloud / Selectel)
13. ✅ Настроить Nginx + SSL
14. ✅ `pm2 start server.js` → проверить стабильность
