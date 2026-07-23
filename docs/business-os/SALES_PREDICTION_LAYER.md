# Sales Prediction Layer

Контракт: **`sales_prediction_v1`**  
Workbook: Sales OS `1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY`  
Листы: `40`–`46`, `98_PREDICTION_EXPORT`  
Hub: [../00_START_HERE.md](../00_START_HERE.md) · Audit: [SALES_PREDICTION_ALIGNMENT_AUDIT.md](./SALES_PREDICTION_ALIGNMENT_AUDIT.md)

---

## Что показывает модель

Пять вопросов:

1. **Что уже получили?** → Fact  
2. **Куда идём при текущем темпе?** → Run Rate  
3. **Выполняем ли утверждённый план?** → Gap / Status  
4. **Сколько ещё нужно получить?** → Required Result  
5. **Что ограничивает план?** → Drivers (если baseline approved)

Scopes: `department=sales` и каждый активный `manager` (одна структура, без листа на менеджера).

---

## Lagging vs Leading

| | Метрики |
|--|---------|
| **Lagging** | `paid_revenue`, `payments`, `average_check` |
| **Leading** | `leads`, `deals`, `invoice_events`, CR-цепочка, snapshots `active_deals` / `active_pipeline_amount` |

Lagging — результаты. Leading — драйверы воронки и ёмкость.

---

## Plan

Только строки в `40_Sales_Plans` со `status=approved`.

### Department (общий план отдела)

Источник: СВОД `1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M` → лист **«План/факт»** (`gid=875444162`) → блок **ОБЩИЕ**, колонка **План** на месяц (июль, август, …).

Sync импортирует в `40_Sales_Plans`:

| СВОД | metric_id |
|------|-----------|
| Выручка | `paid_revenue` |
| Продажи / Sale | `payments` |
| Лиды | `leads` |
| Счета | `invoice_events` |
| Ср. чек | `average_check` |

`plan_source = svod_plan_fact_obshie`. Ручной approved override на том же PK не перезаписывается.

### Manager

Планы менеджеров — **отдельная таблица** (подключим позже).  
Пока → manager = **NO_PLAN** в Sales OS Prediction, если нет ручных строк в `40_Sales_Plans`.

**ROP visual (facts now):** workbook  
`1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820`

- index: `Менеджеры — список`
- tabs: `М — {name} [{id}]` — тот же predictive frame, факты из Sales OS `12_Daily_Fact`, планы пустые

```bash
npm run sync:predictive-managers:dry -- --period=2026-07
npm run sync:predictive-managers -- --period=2026-07
```

### Правила

- `draft` не участвует.  
- Нет строки → **NO_PLAN** (не ноль).  
- Нет авто-деления месяца на недели.  
- Нет авто-распределения общего плана по менеджерам.  
- Settings `plan_paid_revenue_eur` — запасной ops hint, не заменяет СВОД.

---

## Fact

Только Sales OS `12_Daily_Fact` (агрегаты из Payment/Invoice/Lead/Deal events).

Не источник факта: legacy predictive formulas, Maria (для dual-run compare), СВОД leads.

`average_check = paid_revenue / payments`; если payments=0 → empty.

---

## Run Rate

Метод из Settings `forecast_method` (default `calendar_run_rate`).

Безопасное правило v1:

- `forecast_as_of` = вчера (текущий неполный день не входит);  
- additive: `fact_to_date / elapsed_days × days_in_month`;  
- завершённая неделя: run_rate = fact;  
- будущая неделя: empty;  
- ratio/average: projected num / projected den;  
- snapshot: только as-of, не сумма.

`unsupported` → run_rate empty, status BLOCKED/UNKNOWN.

---

## Gap

`gap_to_plan = run_rate − plan`  
без плана → empty + NO_PLAN.

**Required Result** (additive): `max(plan − fact, 0)` и `required_per_remaining_unit`.

---

## Когда прогноз нельзя использовать

Quality gate / `44_Sales_Prediction_Quality`:

- нет fact;  
- method unsupported;  
- critical block;  
- для gap — нет approved plan;  
- для drivers — нет approved baseline.

Тогда не показываем «правдоподобное» число.

---

## Как читать модель отдела / менеджера

1. `45_Sales_Prediction_View` — план/факт/run rate по неделям + месяц + дни.  
2. Детали — `42_Sales_Prediction_Model`.  
3. Качество — `44_*`.  
4. Сверка с legacy — `46_*`.

Менеджер без плана: факт и run rate есть, gap нет, status **NO_PLAN**.

---

## Sync

```bash
npm run sync:sales-prediction:dry
npm run sync:sales-prediction
npm run sync:sales-prediction:validate
```

`POST /api/sync/sales-prediction` — body `{ period, scope, dryRun, modules }`.

`sales_export_v1` / `99_EXPORT` **не меняются**. Export прогноза: `98_PREDICTION_EXPORT`.

---

## Legacy dual-run

Книга `1_bVqzLX…820` сохраняется. Сравнение — [SALES_PREDICTION_RECONCILIATION.md](./SALES_PREDICTION_RECONCILIATION.md).
