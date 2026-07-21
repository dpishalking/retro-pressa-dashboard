# Retro Pressa — архитектурный аудит Business OS

**Роль документа:** карта развития на 1–3 года без переписывания с нуля.  
**Дата аудита:** 2026-07-21  
**Стек:** Next.js 15 (App Router) + TypeScript + Tailwind · деплой Timeweb · данные: Bitrix + Google Sheets + файловые снапшоты  
**Целевая выручка:** от $150k/мес с масштабированием без смены фундамента

---

## Вердикт (кратко)

Система уже не «набор дашбордов», а **ранняя Business OS** с явным ядром:

1. **Company Snapshot** — единый SSOT-снимок периода  
2. **Planning Layer** (FACT / PLAN / SCENARIO)  
3. **Financial Engine** (канонический PnL / CF / slices)  
4. **Digital Twin** (драйверы → marketing/sales/production/HR → финансы)

Google Sheets **частично** является операционным источником (маркетинг, обучение, экспорт диалогов; финансы/ФОТ/производство — через env, часто с `demo_fallback`). Bitrix остаётся источником правды по лидам, сделкам и выручке.

Главный разрыв с целевой моделью: **нет сквозных сущностей Order / Customer / Payment / Production Job / Shipment** — есть агрегаты метрик и качество переписок. Развитие должно идти через расширение Snapshot + Sheets-контрактов, а не через новый монолит.

---

## Раздел 1. Что уже существует

Оценка готовности: **0–5** (0 = заглушка, 5 = production-ready и масштабируемо).

### 1.1 Auth & Access

| | |
|--|--|
| **Назначение** | Сессии, роли `admin` / `rop` / `mop`, защита маршрутов и API |
| **Где** | `src/lib/auth/`, `src/middleware.ts`, `/admin/users` |
| **Готовность** | 4 |
| **Зависимости** | `data/auth/users.json`, cookie-сессия |
| **Масштабирование** | Хватает до ~десятков сотрудников. Нет SSO/OAuth, нет оргструктуры (отделы, страны), роли жёстко зашиты в `access.ts` |

### 1.2 Office Hub (кабинет)

| | |
|--|--|
| **Назначение** | Точка входа в модули |
| **Где** | `/hub` → `office-hub.tsx` |
| **Готовность** | 4 |
| **Масштабирование** | Хорошо как launcher. Не CEO Dashboard |

### 1.3 Operational Analytics Dashboard

| | |
|--|--|
| **Назначение** | KPI периода: лиды, счета, продажи, CPL, ROAS, сигналы |
| **Где** | `/analytics` → `dashboard-ui.tsx`, `metrics-engine`, `signal-rules` |
| **Готовность** | 4 |
| **Зависимости** | company-snapshot / demo-data, Bitrix + Sheets |
| **Масштабирование** | PeriodKey захардкожен (`may-2026`…`july-2026`) — узкое место |

### 1.4 Ad Analytics + GA4 / Clarity / AI Ask

| | |
|--|--|
| **Назначение** | Рекламный и сайт-трафик, friction Clarity, Gemini Q&A |
| **Где** | `/ad-analytics`, `ga4-connector`, `clarity/`, `/api/analytics/ask` |
| **Готовность** | 3–4 |
| **Зависимости** | GA4 property, Clarity token, Gemini |
| **Масштабирование** | Каналы (Yandex/SEO/GEO) не first-class сущности; attribution слабее, чем нужно для $150k+ multi-market |

### 1.5 ROP / Conversation Intelligence

| | |
|--|--|
| **Назначение** | Синк Open Lines, качество диалогов, Gemini-анализ, ROP-отчёт, экспорт в Sheets |
| **Где** | `/rop`, `/rop/conversations`, `conversation-*`, `bitrix/conversation-*`, docs: `conversation-analytics-architecture.md` |
| **Готовность** | 4 |
| **Зависимости** | Bitrix webhook, Gemini, private exports в `data/conversation-*` |
| **Масштабирование** | Сильный модуль Sales Quality. Нет полного Sales CRM UI (папки `sales/`, `correspondence/` пустые) |

### 1.6 Company Snapshot (SSOT)

| | |
|--|--|
| **Назначение** | Единый снимок: marketing / sales / finance / production / hr / quality / training |
| **Где** | `src/lib/company-snapshot/`, `/api/company-snapshot` |
| **Готовность** | 4 (архитектурно), 3 (наполнение live-источников) |
| **Зависимости** | Bitrix, Google marketing/finance/payroll/production, bank file, conversations, training |
| **Масштабирование** | **Ключевой актив.** Правильные SSOT-rules + reconciliation. Расширять контракт snapshot, не плодить параллельные «истины» |

### 1.7 Planning Layer

| | |
|--|--|
| **Назначение** | FACT / PLAN / SCENARIO → единый контекст для финансов |
| **Где** | `src/lib/planning-layer/`, `/api/planning/*` |
| **Готовность** | 4 |
| **Зависимости** | Company Snapshot, `data/scenarios/library.json` |
| **Масштабирование** | Подходит для vibe-coding сценариев. Нужна связь планов с Sheets (ручная корректировка CEO/CFO) |

### 1.8 Financial Engine (FOS)

| | |
|--|--|
| **Назначение** | Канонический PnL, cash flow, slices, unit economics, health, forecast, explainability |
| **Где** | `src/lib/financial-engine/`, `/api/financial-report` |
| **Готовность** | 4 |
| **Зависимости** | Snapshot (+ опционально finance sheets) |
| **Масштабирование** | Хороший фундамент Finance Engine. Live-финансы часто на fallback — это риск доверия к цифрам |

### 1.9 Digital Twin / Decision Engine

| | |
|--|--|
| **Назначение** | Драйверы → движки marketing/sales/production/HR → bottlenecks + recommendations |
| **Где** | `/digital-twin` (admin), `src/lib/digital-twin/` |
| **Готовность** | 3–4 |
| **Зависимости** | Snapshot, Financial Engine, Planning |
| **Масштабирование** | Прототип AI/BI «что если». Production/Delivery — агрегированные драйверы, не операционный контур |

### 1.10 Google Sheets Integrations

| | |
|--|--|
| **Назначение** | Чтение маркетинга, финансов/ФОТ/производства; запись диалогов менеджеров; каталог обучения |
| **Где** | `sheets-client`, `traffic-connector`, `sheet-sources`, `manager-dialogs-sheet-sync`, training sheet sync |
| **Готовность** | 3 |
| **Зависимости** | Service Account, hardcoded spreadsheet IDs + env |
| **Масштабирование** | Есть клиент R/W, но **нет единой Sheets Architecture** (реестр таблиц, схемы колонок, владельцы). Часть ID захардкожена в `google-sources.ts` |

### 1.11 Bitrix CRM Connector

| | |
|--|--|
| **Назначение** | Лиды, сделки, счета, продукты, менеджеры → метрики + переписки |
| **Где** | `src/lib/bitrix/` |
| **Готовность** | 4 |
| **Зависимости** | `BITRIX_WEBHOOK_URL`, кастомные UF-поля |
| **Масштабирование** | Завязка на конкретные field IDs — хрупко при смене CRM-схемы. Нет отдельного слоя «CRM Adapter contract» |

### 1.12 Training / Knowledge / Practice Bot

| | |
|--|--|
| **Назначение** | Продукты, CRM-трек, квизы, прогресс, KB, материалы, Telegram practice bot |
| **Где** | `/training/**`, `src/lib/training/`, `manager-questions-bot/` |
| **Готовность** | 4 (каталог/квизы), 2–3 (practice: legacy routes redirect) |
| **Масштабирование** | People/Knowledge Engine seed. Хранение в JSON/файлах; нет связи прогресса обучения → KPI продаж менеджера в одном UI |

### 1.13 UTM Generator & Standards

| | |
|--|--|
| **Назначение** | Публичный генератор UTM + аудит тегов |
| **Где** | `/utm` (public), `utm-*`, `/api/sync/utm-audit` |
| **Готовность** | 4 |
| **Масштабирование** | Хороший Marketing hygiene tool |

### 1.14 Daily Sync Orchestration & Deploy

| | |
|--|--|
| **Назначение** | Утренний sync Bitrix+Sheets+GA4+Clarity+dialogs+snapshot; auto-deploy |
| **Где** | `/api/rop/daily-sync`, `.github/workflows/*` |
| **Готовность** | 4 |
| **Масштабирование** | Паттерн правильный. Нужен мониторинг/алерты при частичном падении источников |

### 1.15 Заглушки

| Путь | Статус |
|------|--------|
| `src/app/sales/` | пусто |
| `src/app/correspondence/` | пусто |
| Training practice routes | redirect → `/training` |

---

## Раздел 2. Какие сущности существуют

### 2.1 Фактическая модель (как в коде)

Система мыслит **метриками периода**, а не жизненным циклом заказа.

```text
Period (may|june|july-2026)
  └── CompanySnapshot
        ├── Marketing metrics (leads, spend, QL, daily rows)
        ├── Sales aggregates (revenue, invoices, deals by manager/country/product)
        ├── Finance drivers (payroll, overhead, unitCost, tax, cash)
        ├── Production drivers (hours, defectRate, …)
        ├── HR drivers (headcount, salary)
        ├── Quality (dialogue metrics, conversation dashboard)
        └── Training aggregates

Bitrix (внешний)
  Lead ──► Deal ──► Invoice/Payment flag ──► Product rows
  User (manager)
  Open Line Dialog ──► Messages

Google Sheets (внешний)
  Traffic rows (date, channel, campaign, market, spend, leads, QL)
  Finance / Payroll / Production sheets (опционально)
  Manager dialogs export tab
  Training product catalog

Auth
  AppUser (admin|rop|mop)

Training
  Product, TrackModule, Quiz, Progress, KnowledgeBaseArticle

Digital Twin
  Driver, Scenario, Constraint, Recommendation

Conversations
  ConversationMessage, DialogSummary, Intent, Stage, Outcome
```

### 2.2 Целевые сущности vs факт

| Сущность | В системе | Комментарий |
|----------|-----------|-------------|
| Lead | Частично | Агрегаты + recentLeads в Bitrix snapshot, не доменная модель |
| Customer | Нет | Нет LTV/повторных продаж как сущности |
| Deal | Частично | Через Bitrix deals → метрики |
| Order | Нет | Прокси: salesCount / invoices |
| Product | Частично | Training catalog + invoice product cuts; нет ops-каталога SKU/стран |
| Payment | Частично | Поля счетов Bitrix, не платёжный журнал |
| Employee | Частично | Auth user ≠ HR employee; менеджеры из Bitrix |
| Campaign | Слабо | Строки Sheets/UTM, нет Campaign entity |
| Task | Нет | |
| Production Job | Нет | Только драйверы twin |
| Shipment / Delivery | Нет | Только `deliveryCost` драйвер |
| Conversation | Да | Сильная модель |
| Knowledge Article | Да | Training KB |

### 2.3 Целостность модели данных

**Нецелостна на уровне бизнес-объектов** — и это осознанный текущий дизайн (метрический SSOT), но он **не покрывает** полный цикл:

`Ads → Lead → Chat → Call → Pay → Produce → Deliver → Repeat`

Связь «диалог → сделка → оплата → заказ → доставка» **не формализована** единым ID. Outcome диалога часто proxy (маркеры checkout/payment), а финальная конверсия берётся из CRM отдельно (`docs/conversation-analytics-architecture.md`).

**Риск:** при масштабе $150k+ без Order/Customer ID невозможно честно считать LTV, повторные продажи, узкие места производства и логистики по заказам.

---

## Раздел 3. Какие процессы уже автоматизированы

| Процесс | Как | Зрелость |
|---------|-----|----------|
| Синк CRM-метрик | `/api/sync/bitrix`, daily-sync | Высокая |
| Синк маркетинга из Sheets | `/api/sync/google-traffic` | Высокая |
| Синк GA4 / Clarity | sync routes | Средняя–высокая |
| Сборка Company Snapshot | `build-snapshot` + reconciliation | Высокая (архитектура) |
| Экспорт/импорт переписок | import, live store, sheet export | Высокая |
| Gemini анализ диалогов | `/api/conversations/gemini` | Средняя–высокая |
| ROP quality report | `conversation-rop-report` | Высокая |
| Расчёт KPI / сигналов | metrics-engine, signal-rules, kpi-engine | Высокая |
| Финансовый отчёт FACT/PLAN/SCENARIO | planning + financial-engine | Высокая |
| Сценарный «что если» (twin) | digital-twin engines | Средняя |
| AI ask по рекламе/сайту | `/api/analytics/ask` | Средняя |
| UTM generate / audit | `/utm`, utm-audit | Высокая |
| Обучение: каталог, квиз, прогресс | training APIs | Высокая |
| Синк training sheet | `npm run sync:training-sheet` | Средняя |
| Deploy + cron daily-sync | GitHub Actions | Высокая |
| Управление пользователями | `/api/admin/users` | Средняя |

---

## Раздел 4. Какие процессы отсутствуют или слабы

### Маркетинг
- First-class каналы: **Яндекс / SEO / GEO / organic content** (сейчас в основном Facebook contractors + organic summary + GA4)
- Единый Campaign / Creative / Budget plan в Sheets → Snapshot
- Сквозная атрибуция Lead → Sale → Revenue по UTM (есть зачатки `utm-attribution`)

### Продажи
- Операционный Sales Desk (пусто `sales/`, `correspondence/`)
- Скрипты/плейбуки как executable process (есть обучение, нет runtime coaching loop)
- Связка training progress ↔ sales KPI менеджера
- Call / telephony слой

### Производство
- Очередь заказов, статусы, capacity calendar
- Брак/переделки по заказам (есть только rate-драйвер)
- BOM / unit cost по SKU и стране

### Логистика
- Отправления, трекинг, SLA доставки, стоимость по направлениям
- Сейчас: `deliveryCost` в twin/finance

### Финансы
- Live Sheets как обязательный SSOT (сейчас часто fallback)
- Платёжный журнал, дебиторка, multi-currency ops
- Прогноз cash runway, привязанный к банку (частично есть bank file + CF)

### HR / People
- Оргструктура, смены, найм, performance review
- Сейчас: headcount/salary drivers + training

### База знаний
- Есть training KB; нет операционной KB (SOP производства, логистики, country playbooks) как модуля OS

### AI
- Есть Gemini для диалогов и ask-analytics
- Нет: AI Memory слой, agent workflows, predictive churn/LTV, auto-alerts по anomalies

### BI / CEO Dashboard
- Есть разрозненные экраны + twin
- Нет единого CEO one-pager: cash, profit, pipeline, capacity, risks

### Предиктивная аналитика
- Twin scenarios + financial forecast — зачаток
- Нет ML/стат-моделей на исторических когортах

---

## Раздел 5. Целевая архитектура Business OS

Принцип: **не новый монолит**, а модули поверх уже существующих слоёв.

```text
Business OS
├── Ingestion Layer          (connectors: Bitrix, Sheets, GA4, Clarity, Bank, future carriers)
├── Contract Layer           (Sheets schemas + Bitrix field map + Period registry)
├── Company Snapshot (SSOT)  ← уже есть, расширяем
├── Planning Layer           ← уже есть
├── Engine Layer
│   ├── Marketing Engine     ← twin + ad-analytics + sheets traffic
│   ├── Sales Engine         ← twin + ROP conversations + future sales desk
│   ├── Production Engine    ← twin drivers → ops sheets
│   ├── Delivery Engine      ← NEW (sheets + carriers)
│   ├── Finance Engine       ← financial-engine (уже канон)
│   ├── People Engine        ← auth + training + HR sheets
│   ├── Knowledge Engine     ← training KB → ops KB
│   └── AI Engine            ← gemini clients + memory + agents
├── BI Layer                 ← analytics + ad-analytics + financial views
└── CEO Dashboard            ← NEW thin UI over snapshot + FOS + twin signals
```

Хранение правды:

| Слой | Роль |
|------|------|
| **Google Sheets** | Ввод, ручные правки, ops-журналы, прогнозы, finance/production/HR |
| **Bitrix** | CRM-события: lead/deal/invoice/dialog |
| **Snapshot files** | Быстрый канонический read-model для UI/AI |
| **Next.js UI/API** | Оркестрация, RBAC, расчёты, презентация — **не** master DB операционки |

### 5.1 Marketing Engine

| | |
|--|--|
| **Ответственность** | Бюджеты, лиды, CPL/CPQL, каналы, кампании, UTM hygiene |
| **In** | Sheets traffic, GA4, Clarity, ads platforms (будущее) |
| **Out** | `snapshot.marketing`, сигналы, twin drivers |
| **Tables** | `Marketing_Daily`, `Campaigns`, `Channel_Budgets` |
| **API** | `/api/sync/google-traffic`, `/api/sync/ga4`, `/api/sync/clarity`, `/api/analytics/ask` |

### 5.2 Sales Engine

| | |
|--|--|
| **Ответственность** | Воронка, качество диалогов, конверсия, средний чек, менеджеры |
| **In** | Bitrix, conversations, Sheets sales overrides |
| **Out** | `snapshot.sales`, `snapshot.quality`, ROP reports |
| **Tables** | `Sales_Daily`, `Manager_Scorecard`, `Dialog_Export` (уже частично) |
| **API** | sync bitrix, conversations/*, rop-report, manager-dialogs/* |

### 5.3 Production Engine

| | |
|--|--|
| **Ответственность** | Capacity, очередь, брак, unit cost, SLA производства |
| **In** | Sheets Production + будущий Order feed |
| **Out** | `snapshot.production`, twin constraints |
| **Tables** | `Orders`, `Production_Queue`, `Defects`, `SKU_Cost` |
| **API** | расширить sheet-sources + `/api/company-snapshot`; позже `/api/production/*` |

### 5.4 Delivery Engine

| | |
|--|--|
| **Ответственность** | Отправки, трекинг, стоимость, SLA по странам |
| **In** | Sheets Delivery + carrier APIs (позже) |
| **Out** | delivery KPIs в snapshot/finance |
| **Tables** | `Shipments`, `Delivery_Rates` |
| **API** | новый sync + snapshot fields |

### 5.5 Finance Engine

| | |
|--|--|
| **Ответственность** | PnL, CF, unit economics, health, forecast |
| **In** | Snapshot (Bitrix revenue + Sheets costs + bank) |
| **Out** | `/api/financial-report` |
| **Tables** | `Finance_PnL_Manual`, `Cash_Balances`, `Forecast_Assumptions` |
| **API** | `/api/financial-report`, planning/* |

### 5.6 People Engine

| | |
|--|--|
| **Ответственность** | Роли доступа, обучение, headcount, производительность |
| **In** | auth store, training, payroll sheet |
| **Out** | `snapshot.hr`, `snapshot.training` |
| **Tables** | `Employees`, `Payroll_Monthly`, training catalogs |
| **API** | auth, admin/users, training/* |

### 5.7 Knowledge Engine

| | |
|--|--|
| **Ответственность** | SOP, playbooks, product KB, country rules |
| **In** | Sheets/Docs + training KB |
| **Out** | UI + AI retrieval context |
| **Tables** | `Knowledge_Index` |
| **API** | training/knowledge-base → обобщить |

### 5.8 AI Engine

| | |
|--|--|
| **Ответственность** | Анализ, ask, recommendations, memory, alerts |
| **In** | Snapshot + dialogs + KB |
| **Out** | insights, twin recommendations, future agents |
| **Tables** | `AI_Memory`, `AI_Runs` (Sheets или `.cache` → затем Sheets) |
| **API** | gemini routes, analytics/ask, recommendations (twin) |

### 5.9 BI Layer + CEO Dashboard

| | |
|--|--|
| **Ответственность** | Единый управленческий контур |
| **In** | Snapshot + FOS + twin signals + reconciliations |
| **Out** | `/analytics` (ops), `/digital-twin` (what-if), новый `/ceo` или усиленный hub |
| **API** | company-snapshot, financial-report, existing dashboards |

---

## Раздел 6. Google Sheets Architecture

Цель: Sheets = **операционный master** для ручного ввода и корректировок; Bitrix = **event master** CRM; Snapshot = **read-model**.

### 6.1 Предлагаемый реестр книг (без дублирования)

| Книга | Назначение | Пишет | Читает OS |
|-------|------------|-------|-----------|
| **01_Marketing** | Daily spend/leads/QL по каналам и рынкам | Маркетинг / подрядчики | traffic-connector |
| **02_Campaigns** | Справочник кампаний, UTM, бюджет-план | Маркетинг | attribution + twin |
| **03_Sales_Ops** | Ручные корректировки воронки, QL overrides, цели | РОП | snapshot reconcile |
| **04_Orders** | Заказ как сущность (id, customer, product, status, country) | Ops / менеджер | production/delivery/finance |
| **05_Production** | Очередь, часы, брак, unit cost | Производство | sheet-sources / twin |
| **06_Delivery** | Отправки, трек, стоимость, SLA | Логистика | delivery engine |
| **07_Finance** | Overhead, tax, discounts, manual PnL lines | CFO | sheet-sources |
| **08_Payroll** | ФОТ, headcount, avg salary | HR/CFO | sheet-sources |
| **09_Employees** | Сотрудники, роли, рынки, статус | HR/Admin | People + auth bridge |
| **10_Forecast** | Цели месяца, сценарии, допущения | CEO/РОП | planning-layer |
| **11_Dialog_Export** | Архив диалогов (уже есть паттерн) | Система (append) | ROP / AI |
| **12_Training_Catalog** | Продукты обучения (уже есть sheet) | L&D | training sync |
| **13_AI_Memory** | Решения, гипотезы, итоги разборов | Система / РОП | AI Engine |
| **14_Dashboard_Controls** | Переключатели периода, флаги dataMode, owners | Admin | ops |

### 6.2 Правила анти-дублирования

1. **Один owner на метрику** — уже зафиксировано в `SSOT_RULES`; Sheets не перебивает Bitrix revenue.  
2. **Orders — единственный источник order_id**; Sales/Production/Delivery только ссылаются.  
3. Marketing daily не хранит revenue — revenue только из CRM/Orders.  
4. Dialog export не является источником продаж — только quality.  
5. Forecast хранит **targets/assumptions**, не факт.  
6. Хардкод spreadsheet ID → постепенно в **реестр** (`src/config/google-sources.ts` + env), без магии в коннекторах.

### 6.3 Минимальный контракт колонок (пример Orders)

`order_id | created_at | lead_id | deal_id | customer_key | country | product_sku | status | paid_at | amount | currency | production_status | shipment_id | manager_id | source_campaign`

Этого достаточно, чтобы закрыть дыру модели данных без миграции на Postgres на первом этапе.

---

## Раздел 7. Roadmap

Оценка объёма: **S** &lt; 1 нед · **M** 1–3 нед · **L** 3–8 нед · **XL** 2+ мес (при vibe-coding с вашим ревью).

### Этап 0 — Зафиксировать контракт (сейчас)

| | |
|--|--|
| **Цель** | Договориться: Snapshot + Sheets + Bitrix роли; этот аудит = карта |
| **Результат** | Принятые SSOT-правила, список книг Sheets, запрет параллельных «истин» |
| **Зависимости** | Нет |
| **Сложность** | S |
| **Объём** | Продуктовые решения, без большого кода |

### Этап 1 — Sheets как обязательный Finance/Ops SSOT

| | |
|--|--|
| **Цель** | Убрать критичную зависимость от `demo_fallback` для finance/payroll/production |
| **Результат** | Live `dataMode: live|partial` с понятными пробелами; CEO доверяет PnL |
| **Зависимости** | Заполненные Finance/Payroll/Production sheets + env |
| **Сложность** | M |
| **Объём** | Контракты колонок, валидация, UI data quality |

### Этап 2 — Period Registry + CEO one-pager

| | |
|--|--|
| **Цель** | Снять хардкод PeriodKey; единый управленческий экран |
| **Результат** | Динамические периоды; `/ceo` или усиленный hub: cash, profit, pipeline, capacity, reconciliations |
| **Зависимости** | Этап 1 |
| **Сложность** | M |
| **Объём** | types/metrics + snapshot + thin UI |

### Этап 3 — Orders sheet → Snapshot bridge

| | |
|--|--|
| **Цель** | Появить сущность Order без переписывания CRM |
| **Результат** | Связь deal/invoice → order → production/delivery статусы в snapshot |
| **Зависимости** | Этап 1, дисциплина заполнения Orders |
| **Сложность** | L |
| **Объём** | Новая книга + connector + типы snapshot |

### Этап 4 — Production + Delivery Engines (ops)

| | |
|--|--|
| **Цель** | Из драйверов twin сделать операционные контуры |
| **Результат** | Очередь, SLA, bottlenecks на реальных заказах |
| **Зависимости** | Этап 3 |
| **Сложность** | L |
| **Объём** | Sheets + UI секции + constraints twin |

### Этап 5 — Sales Desk (заполнить пустые `sales/` / correspondence)

| | |
|--|--|
| **Цель** | Операционный слой продаж поверх Bitrix + quality |
| **Результат** | Менеджерский scorecard, coaching loop, связь с training |
| **Зависимости** | ROP module (уже), training |
| **Сложность** | L |
| **Объём** | UI + API агрегатов, не замена Bitrix |

### Этап 6 — Marketing Channel Expansion + Attribution

| | |
|--|--|
| **Цель** | Yandex/SEO/GEO/content как равные каналы; UTM → revenue |
| **Результат** | Сопоставимый CPL/ROAS по всем источникам |
| **Зависимости** | Этапы 1–3 (для revenue join) |
| **Сложность** | L |
| **Объём** | Sheets schema + attribution lib |

### Этап 7 — AI Engine v2 (memory + alerts)

| | |
|--|--|
| **Цель** | Память решений, аномалии, еженедельный CEO brief |
| **Результат** | `AI_Memory` sheet + scheduled insights |
| **Зависимости** | Стабильный snapshot live |
| **Сложность** | M–L |
| **Объём** | Gemini pipelines + storage |

### Этап 8 — People OS + Knowledge ops

| | |
|--|--|
| **Цель** | Employees sheet ↔ roles; SOP вне training-only |
| **Результат** | Найм/производительность/знания как часть OS |
| **Зависимости** | Этап 5 |
| **Сложность** | L |
| **Объём** | M |

### Этап 9 — Масштабирование платформы (только когда нужно)

| | |
|--|--|
| **Цель** | Если файловые снапшоты/Sheets упрутся в объём |
| **Результат** | Опционально: Postgres/BigQuery как cache, Sheets остаётся UI ввода |
| **Зависимости** | Реальная боль по объёму/конкуренции записи |
| **Сложность** | XL |
| **Объём** | Не начинать раньше доказанной необходимости |

**Почему не переписывать сейчас:** ядро Snapshot → Planning → FOS → Twin уже правильное для Business OS. Переписывание уничтожит единственный работающий SSOT.

---

## Раздел 8. Технический долг и риски

### Узкие места
1. **PeriodKey hardcoded** — блокирует «годы без переписывания».  
2. **demo_fallback** в finance/production/HR — риск ложных управленческих решений.  
3. **Нет Order entity** — потолок для LTV, production, delivery.  
4. **Хардкод spreadsheet IDs** в `google-sources.ts` — хрупкость и непрозрачность.  
5. **Bitrix UF field IDs** — схема CRM как скрытый контракт.  
6. **Файловое хранилище** (`data/**`) на одном сервере — ок для старта, риск backup/concurrency.  
7. **Роли только 3 уровня** — мало для international ops (country manager, production lead).

### Потенциальные проблемы
- Частичный sync без алерта → `partial` snapshot выглядит «нормально».  
- Proxy outcome диалогов ≠ CRM sale → путаница в отчётах, если не показывать источник.  
- Gemini cost/latency на полном объёме диалогов.  
- Public `/utm` ок, но любой новый public API опасен (middleware discipline).

### Лишние / параллельные пути
- Пустые `sales/`, `correspondence/` — шум в карте маршрутов.  
- Dual mental model: demo-data vs live snapshot (нужен явный banner dataMode в UI везде).  
- Practice training routes disabled, но код/бот остаются — документировать статус.

### Что переработать сейчас (пока система небольшая)
1. **Реестр периодов** (config, не union на 3 месяца).  
2. **Реестр Sheets** (id, owner, schema version, required columns).  
3. **Обязательная валидация SSOT** при daily-sync (fail loud).  
4. **Документ field-map Bitrix** рядом с `metric-definitions.ts` (уже почти есть — сделать каноном).  
5. **UI data quality** на всех финансовых экранах.  
6. **Не** внедрять Postgres/микросервисы до боли.

### Не хватает данных для части решений
Чтобы выбрать детали Этапов 3–4, нужно от вас:
- Какие Google Sheets уже ведутся вручную (ссылки/назначение) кроме маркетинга и dialog export?  
- Есть ли сейчас таблица заказов/производства вне Bitrix?  
- Валюты и юрлица (одна компания или несколько)?  
- Кто owner каждой метрики в команде (маркетинг / РОП / CFO / производство)?  
- Целевой SLA: решение CEO по цифрам — ежедневно или еженедельно?

---

## Сравнение вариантов развития

| Вариант | Суть | Плюсы | Минусы | Рекомендация |
|---------|------|-------|--------|--------------|
| **A. Evolve-in-place** | Расширять Snapshot + Sheets + Twin | Сохраняет капитал, vibe-friendly | Нужна дисциплина контрактов | **Выбрать** |
| **B. CRM-centric rewrite** | Всё вокруг Bitrix UI | Одна система ввода | Sheets философия ломается; Bitrix плохо тянет finance/production | Нет |
| **C. Greenfield Business OS** | Новый стек/БД | «Чистота» | 6–18 мес потери, риск регресса | Нет |
| **D. Warehouse-first** | Сразу BigQuery/dbt | Аналитика enterprise | Overkill до доказанной боли; хуже vibe-итерации | Позже, этап 9 |

**Почему A лучше текущего хаоса роста:** вы уже имеете правильный «позвоночник» (SSOT snapshot + канон финансов). Нужно сделать Sheets-контракты и Order bridge — не новый каркас.

---

## Модель работы (роли)

Согласованный цикл:

1. Совместно проектируем модуль и требования.  
2. Вы утверждаете ТЗ и архитектуру.  
3. Cursor реализует минимальный diff.  
4. Вы ревьюите продукт/риски.  
5. Модуль закрывается → следующий по roadmap.

Cursor = **реализация**. Вы = **архитектура, продукт, ревью**. Этот документ — общая карта; изменения roadmap — только через ваше решение.

---

## Приложение: карта текущего → целевого

| Целевой модуль | Уже есть задел | Главный следующий шаг |
|----------------|----------------|------------------------|
| Marketing Engine | Sheets traffic, GA4, Clarity, UTM | Channel registry + attribution |
| Sales Engine | Bitrix + ROP conversations | Sales desk + Order link |
| Production Engine | Twin drivers + sheet-sources | Orders + queue sheets |
| Delivery Engine | `deliveryCost` only | Shipments sheet |
| Finance Engine | FOS + planning | Live sheets mandatory |
| People Engine | Auth + training + payroll source | Employees sheet |
| Knowledge Engine | Training KB | Ops SOP layer |
| AI Engine | Gemini ask + dialog analysis | Memory + alerts |
| BI / CEO | analytics + twin | CEO one-pager |

---

*Источник инвентаризации: кодовая база Retro Pressa (`src/`, `data/`, `docs/`, workflows), `AGENTS.md`, `ssot-rules.ts`, company-snapshot / financial-engine / digital-twin.*
