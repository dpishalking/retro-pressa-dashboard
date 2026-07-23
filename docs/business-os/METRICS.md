# Metrics

Canonical metrics live in mother `00_Metrics_Registry` and presentation helpers in `src/lib/os-sheets/metric-presentation.ts`.

## Required IDs

- `os_paid_revenue` — company/finance/sales
- `svod_attributed_revenue` — marketing
- `revenue_reconciliation_delta` / `_pct`
- `os_payments_count`, `os_deals_count`, `os_invoices_count`
- `traffic_leads_raw`, `traffic_leads_verified`, `crm_leads`, `paid_leads`
- `ad_spend`, `cpl`, `cac`, `roas`, `average_check`, `payment_conversion`

## Sales Prediction (`sales_prediction_v1`)

Lagging: `paid_revenue`, `payments`, `average_check`  
Leading: `leads`, `deals`, `invoice_events`, `lead_to_deal_cr`, `deal_to_invoice_cr`, `invoice_to_payment_cr`, `lead_to_payment_cr`, snapshots `active_deals`, `active_pipeline_amount`

Fact grain: Daily Fact. Plan: `40_Sales_Plans` approved only.  
See [SALES_PREDICTION_LAYER.md](./SALES_PREDICTION_LAYER.md).

## UI labels

Show:

- «Оплаченная выручка» + «Источник: OS / Bitrix Payments»
- «Атрибутированная выручка» + «Источник: Маркетинговый СВОД»

Do not show two plain «Выручка» cards.
