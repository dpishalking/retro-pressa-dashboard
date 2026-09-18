# Retro Pressa — карта проекта для агентов

Next.js 15 (App Router) + TypeScript + Tailwind. Дашборд для Retro Pressa: аналитика, реклама, РОП, обучение, цифровой двойник. UI на **русском**, код и идентификаторы — на **английском**.

**Business OS (архитектура, Sheets, sync, recovery):** начинать с [`docs/00_START_HERE.md`](docs/00_START_HERE.md). Этот файл — карта **кода и UI**, не замена governance-хаба.

## Запуск

```bash
npm run dev    # http://127.0.0.1:4174
npm run build
npm test       # tsx-тесты в src/tests/
```

Env-шаблон: `.env.example`. Локальные секреты — только в `.env.local` (не коммитить).

## Модули и маршруты

| Раздел | URL | Экран / page | Ключевые lib |
|--------|-----|--------------|--------------|
| Вход | `/` | `src/app/page.tsx` | `src/lib/auth/` |
| Кабинет | `/hub` | `src/app/hub/page.tsx` | `office-hub.tsx` |
| Аналитика | `/analytics` | `dashboard-ui.tsx` | `metrics-engine`, `signal-rules`, `company-snapshot` |
| Реклама | `/ad-analytics` | `ad-analytics-screen.tsx` | `google/ga4-connector`, `ga4-analytics-ask` |
| РОП | `/rop`, `/rop/conversations` | `rop-*-screen.tsx` | `bitrix/`, `conversation-*`, `gemini-conversation-analyzer` |
| Обучение | `/training/**` | `src/app/training/**` | `src/lib/training/` |
| Мотивация | `/motivation` | `motivation-screen.tsx` | `src/lib/motivation/` |
| Спеки (публично) | `/md`, `/md/[slug]` | `md-doc-screen.tsx` | `src/content/md/`, `src/lib/md/` |
| Цифровой двойник | `/digital-twin` | `digital-twin-screen.tsx` | `digital-twin/`, `planning-layer/`, `financial-engine` |
| UTM | `/utm` | `utm-generator-*` | `utm-generator`, `utm-standards` |
| Админ | `/admin/users` | — | `auth/admin-users-auth` |

Навигация и карточки кабинета: `src/components/office-hub.tsx`.

## API (`src/app/api/`)

- **Auth**: `/api/auth/login`, `logout`, `me` — единственные публичные API.
- **Sync**: `/api/sync/ga4`, `google-traffic`, `bitrix`, `clarity`, `utm-audit`.
- **Analytics AI**: `/api/analytics/ask` — Gemini по GA4 + CRM.
- **Conversations**: import, gemini, rop-report, sync-bitrix, history.
- **Training**: modules, products, quiz, progress, bot-link.
- **Planning / finance**: `/api/planning/*`, `/api/financial-report`, `/api/company-snapshot`.
- **Admin**: `/api/admin/users` — только admin/rop.

Все остальные API требуют сессию (см. `src/middleware.ts`).

## Интеграции

| Сервис | Коннектор | Снапшоты |
|--------|-----------|----------|
| GA4 | `src/lib/google/ga4-connector.ts` | `data/google-snapshots/`, `.cache/` |
| Google Sheets (трафик, финансы) | `google/traffic-connector`, `sheets-client` | `google/snapshot-store` |
| Bitrix | `src/lib/bitrix/` | `data/bitrix-snapshots/` |
| Gemini | `ga4-analytics-ask`, `gemini-conversation-analyzer` | `.cache/gemini-*` |
| Clarity | `src/lib/clarity/` | clarity-snapshot-store |

Периоды: `PeriodKey` = `may-2026` | `june-2026` | `july-2026` (`src/types/metrics.ts`).

## UI-паттерны

- Страница = тонкий `page.tsx` (metadata + import screen-компонента).
- Экран = `src/components/*-screen.tsx` с `"use client"`.
- Секции: `SectionHead` + `className="card"` + таблицы в `table-scroll`.
- Форматирование: `eur`, `number`, `pct` из `src/lib/format.ts`.
- Метрики: `src/lib/metrics-engine.ts`.
- **Отдельный loading state** на каждое действие (sync, ask, import) — не переиспользовать один status для разных кнопок.

## Auth и роли

- `admin` — всё, включая `/digital-twin`, `/admin`, `/training/admin`.
- `rop` — hub, analytics, ad-analytics, rop, training, user management.
- `mop` — hub, training.

Проверки: `src/lib/auth/access.ts`, `src/middleware.ts`. Новый маршрут → обновить `canAccessRoute` и карточку в `office-hub.tsx`.

## Данные (не коммитить)

```
data/bitrix-snapshots/
data/google-snapshots/
data/auth/
data/conversation-exports/
data/conversation-snapshots/
data/manager-dialogs-sheet-state/
.cache/
.env / .env.local
```

## Деплой (автоматический)

После задачи с правками кода или конфига: коммит → `git push origin main`. Это и есть деплой.

- Push в `main` → GitHub Actions `Deploy Retro Pressa` → Timeweb (`85.92.111.202`).
- Не спрашивать «деплоить?» и не ждать слова «деплой».
- PR — только если пользователь явно просит ветку/ревью, а не сразу прод.
- Не force-push в `main`. Не коммитить `.env*`, `data/**`, снапшоты.

Подробности: `AUTO_DEPLOY.md`, `.github/workflows/deploy.yml`, `.cursor/rules/git-deploy.mdc`. Секреты — в GitHub Secrets.

## Тесты

`npm test` — unit-тесты в `src/tests/`. При изменении расчётов добавлять/обновлять тесты там же.

## Типичные задачи

- **Кнопка не реагирует** → проверить `disabled`, отдельный ли loading state, middleware 401, Network tab.
- **Новый блок на экране** → screen-компонент, паттерн из `ad-analytics-screen.tsx`.
- **Новый sync** → connector в `src/lib/`, route в `src/app/api/sync/`, snapshot store при необходимости.
- **Gemini** → ключ `GEMINI_API_KEY`, модель `GEMINI_MODEL`, ошибки на русском в UI.

## Cursor Cloud specific instructions

- Node 22 + npm. Зависимости ставит update script (`npm install`); отдельно ничего доустанавливать не нужно.
- Приложение — **один** Next.js-сервис. Запуск: `npm run dev` → `http://127.0.0.1:4174` (команды: см. `## Запуск`). Базы данных нет — состояние в файлах `data/` и `.cache/`.
- Для входа нужен `.env.local` минимум с `AUTH_SECRET` (любая случайная строка) + `DEFAULT_ADMIN_LOGIN`/`DEFAULT_ADMIN_PASSWORD` (по умолчанию `admin`/`admin`). Без `AUTH_SECRET` логин работать не будет. `.env.local` не коммитить.
- Все внешние интеграции (Bitrix, GA4, Google Sheets, Gemini, Clarity) и Telegram-бот `manager-questions-bot/` — опциональны и не нужны, чтобы поднять и протестировать дашборд; без ключей соответствующие sync/AI-фичи просто отключены и в UI видно «НЕТ ДАННЫХ».
- Тесты: `npm test` (tsx-тесты в `src/tests/`) — зелёные. `npm run typecheck` в репозитории имеет предсуществующие ошибки в нескольких тест-файлах (`src/tests/*`) и не входит в `npm test`; на запуск приложения это не влияет.
