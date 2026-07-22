# Metric Definitions — Sales (locked)

Version: `sales_metric_defs_v1` (+ Maria flueger)  
Date: 2026-07-22  
Scope: sales funnel only (`CATEGORY_ID = 0`). Stages from other funnels (`C1:…`, `C4:…`, …) are **out of scope**.

## Operational flueger (Maria)

For **day invoices / month sales & revenue** used by the ROP Board, the operational truth is Maria’s workbook:

[Отчет показатели RETRO PRESSA](https://docs.google.com/spreadsheets/d/1nNC48IfiUgO86YGvyLH05o6DrBq3jKKprChT09HN2Mc) → tab **«Отчет день/месяц»**.

On each `sync:sales-os` we pull:

* yesterday **Счетов (шт/евро)** → `15_Maria_Daily` (+ `16_Maria_Snapshot`)
* month **Продаж / Выручка** → ROP Board fact + snapshot
* **ПЛАН Выручка** → plan for traffic light if `01_Settings.plan_paid_revenue_eur` is empty

Day **оплаты** (22 / 1510 style) are not always on that sheet — keep them in `15_Maria_Daily` from Maria’s chat when she sends them; sync does **not** wipe `paid_*`.

Env: `MARIA_TRUTH_SPREADSHEET_ID` (default = that workbook).

## Funnel filter

A deal is in **sales funnel** iff:

* `category_id` is `0` / empty, **and**
* `stage_id` does **not** match `^C[1-9]\d*:` (Bitrix non-default category prefix).

## Deals

* **Definition:** count of sales-funnel deals with `created_at` in the calendar period.
* **Day bucket:** calendar date from the Bitrix timestamp **as returned** (date prefix of `DATE_CREATE`, e.g. `2026-07-13T01:00:00+03:00` → `2026-07-13`). Not UTC conversion.
* **Not:** invoice date, close date, other categories.
* **Canonical candidate:** Sales OS `04_Deals` / staging `61` (category 0).
* **Legacy compare:** `03_Orders` rows with `created_at` in period **after sales-funnel filter**.

## Payments

* **Definition:** sales-funnel deals with `STAGE_SEMANTIC_ID = S` (WON) and `CLOSEDATE` (`paid_at`) in the calendar period.
* **Day bucket:** same Bitrix date-prefix rule as Deals.
* **Amount field:** `OPPORTUNITY` (same as Orders `amount` when paid).
* **Not:** bank confirmation, invoice UF alone.
* **Important:** include deals **created before the period** if they closed in the period.
* **Canonical candidate:** Sales OS `08_Payment_Events`.
* **Legacy compare:** `03_Orders` where `payment_status = paid` and `paid_at` in period + sales-funnel filter.

## Paid revenue

* **Definition:** sum of payment amounts as defined above.
* **Currency:** EUR assumed.

## Active deals / Active pipeline amount

* **Definition:** sales-funnel deals with `STAGE_SEMANTIC_ID = P` (in progress) at snapshot time.
* **Amount:** sum of `OPPORTUNITY`.
* **Not:** “anything not paid/lost” (that incorrectly includes other semantics / orphans).
* **Canonical candidate:** Sales OS `09_Active_Pipeline` / staging `65`.
* **Legacy compare:** `03_Orders` with `stage_semantic = P` + sales-funnel filter.

## Manager count

* **Definition:** unique `manager_id` with at least one of:
  * deal **created** in period (sales funnel), or
  * **payment** closed in period (sales funnel).
* **Not:** managers who only appear on pipeline snapshot with zero create/pay activity in the period.

## Invoice events

* System sheet `07_Invoice_Events` = UF invoice date (engineering).  
* **ROP day management** = Maria `invoices_*` on `15_Maria_Daily`.

## Payments (system vs Maria)

* **System / dual-run:** WON + CLOSEDATE + OPPORTUNITY (locked for Sales OS ↔ legacy match).  
* **ROP Board day money:** Maria `paid_total_*` on `15_Maria_Daily` when filled.

## Leads

* Still `pending_review` (no leads column on `02_Sales_Daily`). Non-blocking for cutover.
