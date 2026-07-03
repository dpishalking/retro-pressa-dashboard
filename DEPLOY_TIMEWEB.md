# Деплой Retro Pressa на Timeweb

Надёжный вариант для этого проекта — Node.js/VPS/Cloud-сервер. Обычный статический или PHP-хостинг не подойдёт, потому что в проекте есть серверные API: импорт переписок, Bitrix, Google Sheets.

## Вариант 1. Timeweb Cloud / VPS

1. Создать сервер Ubuntu.
2. Установить Node.js 22 LTS и npm.
3. Загрузить проект на сервер.
4. В папке проекта выполнить:

```bash
npm ci
npm run build
PORT=4174 npm run start
```

Для постоянной работы лучше запускать через PM2:

```bash
npm install -g pm2
pm2 start npm --name retro-pressa -- run start
pm2 save
pm2 startup
```

В панели Timeweb или в nginx-прокси нужно направить домен на порт `4174`.

## Вариант 2. Docker

Если в Timeweb выбран сервер с Docker:

```bash
docker build -t retro-pressa .
docker run -d --name retro-pressa --restart unless-stopped -p 4174:4174 --env-file .env retro-pressa
```

## Переменные окружения

Создать `.env` на сервере по образцу `.env.example`.

Минимально:

```bash
BITRIX_WEBHOOK_URL=...
GOOGLE_SERVICE_ACCOUNT_JSON=...
PORT=4174
```

Если Google JSON неудобно хранить одной строкой, можно использовать:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Проверка

После запуска открыть:

```text
http://ваш-домен/
```

или временно:

```text
http://ip-сервера:4174/
```

Если приложение открылось, вкладка `Данные и настройки` сможет принимать переписки через файл или поле вставки текста.
