# Sales Prediction Alignment Audit

Sprint: **Sales Prediction Layer Alignment v1**  
Hub: [../00_START_HERE.md](../00_START_HERE.md) · Standard: [BUSINESS_OS_STANDARD_V1.md](./BUSINESS_OS_STANDARD_V1.md)

**Rule:** findings only — no silent fixes of legacy numbers.

---

## Where the current model lives

| Location | Role |
|----------|------|
| Spreadsheet `1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820` tab `Предиктивка продажи` | Legacy ROP visual (weeks 1–5, Plan/Fact/PTF%) |
| Optional Paid/Organic tabs via `predictive-by-traffic` | Traffic cuts — **out of scope** for department Sales Prediction |
| Code `src/lib/sales-os/predictive-model.ts` + `sync-predictive.ts` | Grid bootstrap, fact write, СВОД plan push |
| Sales OS Settings `plan_paid_revenue_eur` / `plan_payments_count` | Operational month targets (not Prediction contract) |
| Sales OS sheets `12_Daily_Fact` / `13_Funnel_Fact` / `08_Payment_Events` | Official facts (underused by legacy front) |
| Sales OS `40–46` | **Absent before this sprint** — target home |

---

## Metric audit table

| metric_id | metric_name | current_location | current_formula / rule | current_source | date_field | period_rule | value_type | verified | gap | recommended_action |
|-----------|-------------|------------------|------------------------|----------------|------------|-------------|------------|----------|-----|-------------------|
| paid_revenue | Revenue / Выручка | Legacy grid row Revenue; Daily Fact `revenue` | Sum day facts; Maria preferred if paid filled | Maria → else Daily Fact | day cell / `paid_at` | calendar day in month | currency additive | partially_verified | Legacy prefers Maria over Sales OS Payment Events | Official layer: Sales OS Daily Fact / Payment Events only; Maria = dual-run compare |
| payments | Sale / Продажи | Legacy `sale` | Count payments | Maria `paid_total_count` or Daily Fact `payments` | same | same | count additive | partially_verified | Naming `sale` vs `payments` | Rename to `payments` in Prediction contract |
| average_check | AOV | Legacy AOV | revenue/sale; sheet formulas | derived | n/a | ratio | average | verified | empty when sale=0 in template | Keep; empty if payments=0 |
| leads | Leads | Legacy Leads | day sum | СВОД day preferred → Daily Fact | created day | additive | count | partially_verified | СВОД ≠ Sales OS Leads SSOT | Official: Daily Fact `leads` only |
| deals | Deals | Legacy Deals | day sum | Daily Fact `deals_created` | created_at day | additive | count | verified | — | Keep from Daily Fact |
| invoice_events | Invoices | Legacy Invoices | day sum | Maria invoices or Daily Fact | invoice_at day | additive | count | partially_verified | Maria mix | Official: Daily Fact `invoices` |
| lead_to_deal_cr | CR L→Deal | Legacy | deals/leads formulas | sheet | n/a | ratio | conversion | verified | — | Aggregate nums then divide; never sum % |
| deal_to_invoice_cr | CR Deal→Inv | Legacy | invoices/deals | sheet | n/a | ratio | conversion | verified | — | same |
| invoice_to_payment_cr | CR Inv→Sale | Legacy | sale/invoices | sheet | n/a | ratio | conversion | verified | Rename sale→payments | same |
| lead_to_payment_cr | CR L→Sale | Legacy | sale/leads | sheet | n/a | ratio | conversion | verified | — | same |
| active_deals | Active deals | Daily Fact snapshot cols | last day values | pipeline snapshot | snapshot_date | **snapshot** | snapshot | verified | Must not sum weeks | Prediction: as-of only |
| active_pipeline_amount | Pipeline € | Daily Fact | last day | pipeline | snapshot | snapshot | snapshot | verified | Must not sum | as-of only |
| stale_deals | Stale | Daily Fact | — | pipeline | snapshot | snapshot | snapshot | legacy_but_usable | Optional v1 | Optional leading |
| deals_without_next_activity | No next act | Daily Fact | — | pipeline | snapshot | snapshot | snapshot | legacy_but_usable | Optional v1 | Optional leading |

---

## Plan audit

| Plan | Source | Status | Notes |
|------|--------|--------|-------|
| Month revenue / sales / leads / invoices | СВОД «План/факт» (`gid=875444162`) ОБЩИЕ | **verified** (department) | Official department month plans → `40_Sales_Plans` as `approved` / `svod_plan_fact_obshie` |
| Week/day plan | Formula `=МЕС/weekCount` and `/7` | **unsupported** | Equal split — **not** approved week weights (sprint forbids) |
| Deals plan | `deriveDealsPlanForInvoices` from current CR | **unsupported** / scenario | Generated from fact CR — not approved plan |
| Settings `plan_paid_revenue_eur` | Manual in Sales OS | **manual_only** / partially_verified | Real ops target; migrate to `40_Sales_Plans` as `approved` only when owner confirms |
| Settings `plan_payments_count` | Manual | **manual_only** | same |
| Manager plans | Not in legacy department grid | **no_plan** | Do not auto-allocate |

---

## Run-rate / PTF audit

| Behavior | Status | Notes |
|----------|--------|-------|
| PTF% = fact/plan × periodDays/elapsed | partially_verified | Calendar days; as_of_day in row 35 |
| Includes current day in elapsed (`asOf-start+1`) | **wrong_date_rule** vs Standard | Standard: exclude incomplete current day |
| Closed weeks: PTF empty (formula gated) | verified | Keep: completed week run_rate = fact |
| Future weeks: empty | verified | Keep |
| CR/AOV PTF without time scale | verified | Keep |
| Traffic lights yellow 90% hard-coded | partially_verified | Tolerance must be Settings-approved; else no Yellow/Red business color |

---

## Fact provenance gaps

| Issue | Impact |
|-------|--------|
| Maria overrides Bitrix WON revenue | Dual canon; official Prediction Fact must use Sales OS Facts |
| СВОД leads override Bitrix leads | Dual canon; official Fact = Daily Fact |
| Legacy not readable as Fact SSOT | Do not read legacy formulas for Fact |

---

## Recommended actions (this sprint)

1. Keep legacy workbook **unchanged** as dual-run peer.  
2. Add Sales OS sheets `40–46` + contract `sales_prediction_v1`.  
3. Fact only from `12_Daily_Fact` / `13_Funnel_Fact` (+ snapshot cols).  
4. Plans only `status=approved` on `40_Sales_Plans`.  
5. Mark СВОД equal-split and derived deals plan as unsupported in reconciliation.  
6. Default `forecast_method=calendar_run_rate` with `forecast_as_of` = last complete day.

---

## Open / Requires clarification

- Manager plans: separate spreadsheet/tab — **URL not provided yet**.  
- Are Settings plan keys still needed as override after СВОД import?  
- Working-day calendar for Latvia — not wired; method available but not default.
