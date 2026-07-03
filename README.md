# Retro Pressa Dashboard

MVP управленческого дашборда Retro Pressa для цели `€100 000` в месяц.

## Запуск

```bash
npm install
npm run dev
```

Локальный адрес: `http://127.0.0.1:4174/`

## Production

```bash
npm ci
npm run build
PORT=4174 npm run start
```

Для Timeweb/VPS см. [DEPLOY_TIMEWEB.md](./DEPLOY_TIMEWEB.md).

## Структура

- `src/app` — Next.js App Router.
- `src/components` — UI-компоненты дашборда.
- `src/data` — демо-данные мая и июня 2026.
- `src/lib/metrics-engine.ts` — расчётные показатели.
- `src/lib/conversation-intelligence.ts` — импорт и факторный анализ переписок.
- `src/lib/signal-rules.ts` — автоматические сигналы.
- `src/lib/import-schemas.ts` — Zod-схемы для будущего CSV-импорта.
- `src/types` — типы данных.
- `src/tests` — unit-тесты расчётов.
