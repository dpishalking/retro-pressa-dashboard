# Retro Pressa Analytics OS — Metric Catalog

**Date:** 2026-08-08  
**Companion:** [analytics-os-audit.md](./analytics-os-audit.md)  
**Locked sales defs (upstream):** [business-os/METRIC_DEFINITIONS.md](./business-os/METRIC_DEFINITIONS.md)  
**App engine:** `src/lib/metrics-engine.ts`, `src/lib/signal-rules.ts`, company-snapshot

Status legend: `LIVE READY` · `CALCULATABLE` · `PARTIAL` · `NOT AVAILABLE`

Each metric includes **Owner decision** — what the CEO can decide from it.

---

## Revenue

| Field | Value |
|-------|-------|
| Metric Name | Revenue (Paid) |
| Business Definition | Сумма оплаченных сделок sales-funnel за период |
| Formula | `SUM(opportunity)` where `STAGE_SEMANTIC_ID=S` and `CLOSEDATE` in period; Orders: `payment_status=paid` → `amount` |
| Source | Sales OS payments / Mother `24_Payments_Core` / `03_Orders` |
| Dimensions | day, month, manager, country, product (primary), source_channel |
| Refresh Frequency | On-demand sync + OS daily cron |
| Status | LIVE READY |
| Known Issues | Dual truth vs Maria day numbers; refunds not deducted |
| Owner decision | Выполняем ли план выручки; где провал дня/недели |

---

## Gross Revenue

| Field | Value |
|-------|-------|
| Metric Name | Gross Revenue |
| Business Definition | Валовая выручка до возвратов (= Paid Revenue today) |
| Formula | Same as Revenue until refunds exist |
| Source | Payments |
| Dimensions | Same as Revenue |
| Refresh Frequency | Same |
| Status | LIVE READY |
| Known Issues | Alias until Net Revenue exists |
| Owner decision | Верхняя планка денежного результата CRM |

---

## Net Revenue

| Field | Value |
|-------|-------|
| Metric Name | Net Revenue |
| Business Definition | Gross − refunds − chargebacks |
| Formula | `Gross Revenue − Refunds` |
| Source | Missing refunds SSOT |
| Dimensions | — |
| Refresh Frequency | — |
| Status | NOT AVAILABLE (shows as Gross until refunds) |
| Known Issues | No refund entity on Orders/Finance spine |
| Owner decision | Реальная выручка после возвратов — **недоступно** |

---

## Orders / Paid Orders

| Field | Value |
|-------|-------|
| Metric Name | Paid Orders |
| Business Definition | Число оплаченных заказов (deal = order v1) |
| Formula | `COUNT(*)` payments / paid orders in period |
| Source | Payments / Orders |
| Dimensions | manager, country, product, source |
| Refresh Frequency | Sync |
| Status | LIVE READY |
| Known Issues | order_id = deal_id; multi-category funnels excluded |
| Owner decision | Объём закрытий vs качество чека |

---

## Leads

| Field | Value |
|-------|-------|
| Metric Name | Leads (created) |
| Business Definition | Карточки лидов Bitrix с `DATE_CREATE` в периоде |
| Formula | `COUNT(leads)` exclude spam/review statuses per metric-definitions |
| Source | Bitrix `crm.lead.list` / Foundation `60_*` |
| Dimensions | day, source, country, manager, UTM |
| Refresh Frequency | Sync / leads-day script |
| Status | LIVE READY |
| Known Issues | Messenger duplicates inflate; use dedupe for “unique” |
| Owner decision | Хватает ли входящего потока |

---

## Unique Leads (deduped)

| Field | Value |
|-------|-------|
| Metric Name | Unique Leads |
| Business Definition | Лиды без повтора phone/email из истории |
| Formula | Created − duplicates (normalize phone last 10 / email); exclude Wazzup service numbers |
| Source | Bitrix API; `scripts/bitrix-leads-day.mjs` |
| Dimensions | day, channel |
| Refresh Frequency | On-demand / daily ops |
| Status | CALCULATABLE |
| Known Issues | Not yet first-class Sales OS column |
| Owner decision | Реальный новый спрос vs повторные чаты |

---

## Qualified Leads

| Field | Value |
|-------|-------|
| Metric Name | Qualified Leads |
| Business Definition | Лиды, прошедшие квалификацию (получатель/срок/интерес) |
| Formula | Period Sheets / dialogue quality proxies; Bitrix native field not locked |
| Source | Google traffic sheets + conversation quality metrics |
| Dimensions | paid vs organic (sheet) |
| Refresh Frequency | Sheet sync |
| Status | PARTIAL |
| Known Issues | Explicitly not from Bitrix in `BITRIX_METRIC_DEFINITIONS` |
| Owner decision | Качество лидов vs сырой объём |

---

## Conversion Rate (Lead → Paid)

| Field | Value |
|-------|-------|
| Metric Name | Sales Conversion Rate |
| Business Definition | Доля лидов, давших оплату в периоде (или cohort — выбрать политику) |
| Formula | Engine: `salesCount / totalLeads`; cohort alternative: paid from leads created in period |
| Source | metrics-engine + Sales daily |
| Dimensions | manager, country, channel |
| Refresh Frequency | Sync |
| Status | CALCULATABLE |
| Known Issues | Period vs cohort mismatch; lead→deal link gaps |
| Owner decision | Где ломается воронка продаж |

---

## Invoice Conversion

| Field | Value |
|-------|-------|
| Metric Name | Invoice Conversion |
| Business Definition | Доля лидов/сделок со счётом |
| Formula | `invoicesCount / leads` (engine) |
| Source | Invoice UF + Maria overlay for ROP day |
| Dimensions | manager, day |
| Refresh Frequency | Sync |
| Status | PARTIAL (dual truth) |
| Known Issues | Engineering invoice events ≠ Maria ROP invoices |
| Owner decision | Менеджеры выставляют счета вовремя? |

---

## AOV

| Field | Value |
|-------|-------|
| Metric Name | Average Order Value (Average Paid Check) |
| Business Definition | Средний чек оплаты |
| Formula | `Revenue / Paid Orders` |
| Source | Payments |
| Dimensions | country, product, manager, channel |
| Refresh Frequency | Sync |
| Status | LIVE READY |
| Known Issues | Primary product only for product dimension |
| Owner decision | Растить чек vs объём заказов |

---

## Products per Order

| Field | Value |
|-------|-------|
| Metric Name | Products per Order |
| Business Definition | Среднее число товарных позиций в сделке |
| Formula | `AVG(product_rows_count)` on deals/payments |
| Source | Foundation `61_Bitrix_Deals_Raw.product_rows_count` |
| Dimensions | product category, country |
| Refresh Frequency | Foundation sync |
| Status | PARTIAL |
| Known Issues | Not on Mother Orders columns; qty/price lines not projected |
| Owner decision | Работает ли корзина / допродажи |

---

## Attach Rate

| Field | Value |
|-------|-------|
| Metric Name | Attach Rate |
| Business Definition | Доля заказов с доп. SKU besides base product |
| Formula | `orders with product_rows_count > 1 / paid orders` (proxy until taxonomy) |
| Source | Deal productrows |
| Dimensions | base product, country |
| Refresh Frequency | Foundation sync |
| Status | PARTIAL |
| Known Issues | Need official base vs attach SKU dictionary |
| Owner decision | Какие бандлы масштабировать |

---

## Upsell Rate

| Field | Value |
|-------|-------|
| Metric Name | Upsell Rate |
| Business Definition | Доля диалогов/сделок с расширенным предложением → оплата |
| Formula | Conversation `extendedOfferPct` / outcome markers; or SKU upgrade rules |
| Source | Dialogue quality + Gemini conversation analysis |
| Dimensions | manager, channel |
| Refresh Frequency | ROP daily sync |
| Status | PARTIAL |
| Known Issues | Not pure revenue upsell; sample reliability varies |
| Owner decision | Где учить менеджеров допродаже |

---

## Repeat Rate

| Field | Value |
|-------|-------|
| Metric Name | Repeat Purchase Rate |
| Business Definition | Доля клиентов с >1 paid order |
| Formula | `COUNT(customers where paid_orders_count > 1) / COUNT(customers with paid≥1)` |
| Source | Mother `21_Customers_Core` |
| Dimensions | country, first product |
| Refresh Frequency | os-orders / os-core sync |
| Status | CALCULATABLE |
| Known Issues | Identity fragmentation on messenger-only clients |
| Owner decision | Есть ли база повторных покупок / нужна ли CRM retention |

---

## LTV

| Field | Value |
|-------|-------|
| Metric Name | Customer LTV |
| Business Definition | Накопленная оплаченная выручка клиента |
| Formula | `total_paid_revenue` per customer; cohort AVG |
| Source | Customers Core |
| Dimensions | cohort month, country |
| Refresh Frequency | Sync |
| Status | PARTIAL |
| Known Issues | No time-decay / predicted LTV; identity gaps |
| Owner decision | Сколько можно тратить на привлечение |

---

## CAC

| Field | Value |
|-------|-------|
| Metric Name | Customer Acquisition Cost |
| Business Definition | Рекламные затраты на одного нового платящего клиента |
| Formula | `ad_spend / new_paid_customers` (Company Monthly has `cac`) |
| Source | СВОД/Mother ad_spend + Customers |
| Dimensions | month, channel (weak) |
| Refresh Frequency | Sheet sync |
| Status | PARTIAL |
| Known Issues | No Ads API; new vs returning attribution weak |
| Owner decision | Окупаемость платного канала |

---

## CPL

| Field | Value |
|-------|-------|
| Metric Name | Cost per Lead (Paid) |
| Business Definition | Стоимость платного лида |
| Formula | `ad_spend / paidLeads`; engine `paidCpl` |
| Source | Sheets spend + Bitrix/ traffic paid leads |
| Dimensions | day, campaign (UTM), market |
| Refresh Frequency | Sync |
| Status | PARTIAL |
| Known Issues | Spend grain ≠ UTM grain without Ads API |
| Owner decision | Резать/масштабировать закупку |

---

## ROAS

| Field | Value |
|-------|-------|
| Metric Name | ROAS (Cash / Invoice) |
| Business Definition | Выручка на € рекламы |
| Formula | `revenue / adSpend` (cash); invoice variant in metrics-engine |
| Source | Revenue + ad_spend |
| Dimensions | month, market |
| Refresh Frequency | Sync |
| Status | PARTIAL |
| Known Issues | Attribution window; Traffic Mother blocked |
| Owner decision | Эффективность маркетингового бюджета |

---

## Gross Profit

| Field | Value |
|-------|-------|
| Metric Name | Gross Profit |
| Business Definition | Выручка − себестоимость |
| Formula | Company monthly `gross_profit`; or `revenue − cogs` from passports |
| Source | Finance thin + product passports + financial-engine |
| Dimensions | month, product (weak) |
| Refresh Frequency | Manual costs + sync |
| Status | PARTIAL |
| Known Issues | COGS not order-actual; payroll/opex manual |
| Owner decision | Какие продукты реально кормят маржу |

---

## Contribution Margin

| Field | Value |
|-------|-------|
| Metric Name | Contribution Margin |
| Business Definition | Выручка − переменные затраты (COGS, shipping, payment fees, ad variable) |
| Formula | `Revenue − variable_costs` |
| Source | Incomplete |
| Dimensions | product, country |
| Refresh Frequency | — |
| Status | PARTIAL |
| Known Issues | Shipping/fees/actual COGS missing at order grain |
| Owner decision | Unit economics до постоянных затрат |

---

## Refund Rate

| Field | Value |
|-------|-------|
| Metric Name | Refund Rate |
| Business Definition | Доля выручки/заказов с возвратом |
| Formula | `refunds / orders` |
| Source | — |
| Dimensions | — |
| Refresh Frequency | — |
| Status | NOT AVAILABLE |
| Known Issues | No refunds on Orders/Finance |
| Owner decision | Качество/обещания продукта — **нет данных** |

---

## Production Time

| Field | Value |
|-------|-------|
| Metric Name | Production Time |
| Business Definition | Время от оплаты (или старта производства) до готовности |
| Formula | `production_completed_at − production_started_at` |
| Source | Manual Orders columns / stub Production Jobs |
| Dimensions | product, country |
| Refresh Frequency | Manual |
| Status | NOT AVAILABLE (live) |
| Known Issues | Production OS blocked |
| Owner decision | Узкое место при масштабе ×10 — **нет live** |

---

## Delivery Time

| Field | Value |
|-------|-------|
| Metric Name | Delivery Time |
| Business Definition | Время доставки клиенту |
| Formula | `delivered_at − shipped_at` |
| Source | Manual delivery fields |
| Dimensions | country |
| Refresh Frequency | Manual |
| Status | NOT AVAILABLE (live) |
| Known Issues | No carrier integration |
| Owner decision | SLA по странам |

---

## Order Processing Time

| Field | Value |
|-------|-------|
| Metric Name | Order Processing Time (CRM) |
| Business Definition | Время от создания сделки до оплаты |
| Formula | `paid_at − created_at` or stage history durations |
| Source | Orders + `63_Bitrix_Stage_History` |
| Dimensions | manager, product |
| Refresh Frequency | Foundation sync |
| Status | CALCULATABLE |
| Known Issues | Does not include production |
| Owner decision | Где сделки зависают до денег |

---

## Manager Response Time

| Field | Value |
|-------|-------|
| Metric Name | Manager Response Time |
| Business Definition | Медиана ответа менеджера в диалоге |
| Formula | `medianResponseMinutes` from dialogue quality / conversations |
| Source | Open Lines sync + Gemini/ROP metrics |
| Dimensions | manager, channel |
| Refresh Frequency | Daily ROP cron |
| Status | LIVE READY (sample-dependent) |
| Known Issues | Coverage < all leads; reliability tiers |
| Owner decision | Кого коучить по скорости ответа |

---

## Country Revenue / Country CR

| Field | Value |
|-------|-------|
| Metric Name | Country Revenue / Country Conversion |
| Business Definition | Выручка и конверсия по стране заказа/лида |
| Formula | SUM/COUNT by `country` (deal UF preferred, else lead) |
| Source | Orders, leads, CountryInvoiceMetrics |
| Dimensions | country, month |
| Refresh Frequency | Sync |
| Status | LIVE READY / CALCULATABLE |
| Known Issues | Empty country rows; naming variants |
| Owner decision | Какие рынки масштабировать |

---

## Pipeline / Backlog

| Field | Value |
|-------|-------|
| Metric Name | Active Pipeline Amount |
| Business Definition | Сумма open deals (`STAGE_SEMANTIC_ID=P`) |
| Formula | `SUM(opportunity)` active pipeline snapshot |
| Source | Foundation `65_Bitrix_Pipeline` / Sales active pipeline |
| Dimensions | stage, manager |
| Refresh Frequency | Pipeline sync module |
| Status | LIVE READY |
| Known Issues | Snapshot point-in-time |
| Owner decision | Хватает ли воронки на план |

---

## Plan / Fact / Forecast

| Field | Value |
|-------|-------|
| Metric Name | Plan Completion / Run-rate / Forecast |
| Business Definition | Исполнение плана выручки и прогноз |
| Formula | Finance `plan_completion_pct`, `run_rate_revenue`, `forecast_revenue`; predictive sales layer |
| Source | Mother `07_Finance_Daily`, Sales prediction, Maria plan |
| Dimensions | month, manager (predictive) |
| Refresh Frequency | Daily / predictive cron |
| Status | PARTIAL |
| Known Issues | Multiple plan sources; week plans NO_PLAN until approved |
| Owner decision | Успеваем ли к концу месяца |

---

## Data Status Architecture (mandatory for UI)

Every KPI card must expose:

| Status | Meaning |
|--------|---------|
| LIVE | Fresh from connected sync within SLA |
| CALCULATED | Derived from live inputs by locked formula |
| MANUAL | Human-entered sheet field |
| DEMO | Placeholder / synthetic (digital twin drivers) |
| NO DATA | Entity or fill-rate insufficient — do not invent zeros |

Implementation sketch (Phase 1):

```ts
type MetricDataStatus = "live" | "calculated" | "manual" | "demo" | "no_data";

type AnalyticsMetricValue = {
  metricId: string;
  value: number | null;
  status: MetricDataStatus;
  asOf: string | null;       // last_sync_at / data_as_of
  source: string;            // e.g. sales_export_v1 | mother_orders | svod
  confidence: "high" | "medium" | "low";
  decisionHint?: string;     // short owner action language
};
```

---

## Events (derivable)

| Event | Availability | Source |
|-------|--------------|--------|
| lead_created | Available now | Leads DATE_CREATE |
| manager_assigned | Available now | ASSIGNED_BY on lead/deal |
| first_response | Possible | Conversations timestamps |
| qualified | Possible / partial | Dialogue markers / sheets |
| offer_sent | Possible | Conversation intents / activities |
| payment_link_sent | Possible | Conversation payment markers |
| order_paid | Available now | WON + CLOSEDATE |
| product_added | Possible | productrows / history weak |
| stage_changed | Available now | Stage history |
| invoice_issued | Available now | Invoice UF / stage |
| production_started | Impossible (live) | Manual only |
| production_completed | Impossible (live) | Manual only |
| shipped | Impossible (live) | Manual only |
| delivered | Impossible (live) | Manual only |
| refunded | Impossible | No entity |
| review_received | Impossible | No SSOT |

---

## Metric → Decision Map (Phase 1 priority)

| If metric moves… | Owner action |
|------------------|--------------|
| Revenue ↓ vs plan | Open funnel + managers + countries drill-down same day |
| CPL ↑ | Pause/scale campaigns; check UTM orphans |
| CR ↓ | ROP coaching; conversation quality |
| AOV ↓ | Bundle / attach playbooks |
| Repeat flat | Retention offer design |
| Pipeline thin | Demand gen priority over ops |
| Response time ↑ | Staffing / SLA enforcement |
| Production NO DATA | Do not scale ads until ops instrumentation |
