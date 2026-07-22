# Metrics

Canonical metrics live in mother `00_Metrics_Registry` and presentation helpers in `src/lib/os-sheets/metric-presentation.ts`.

## Required IDs

- `os_paid_revenue` — company/finance/sales
- `svod_attributed_revenue` — marketing
- `revenue_reconciliation_delta` / `_pct`
- `os_payments_count`, `os_deals_count`, `os_invoices_count`
- `traffic_leads_raw`, `traffic_leads_verified`, `crm_leads`, `paid_leads`
- `ad_spend`, `cpl`, `cac`, `roas`, `average_check`, `payment_conversion`

## UI labels

Show:

- «Оплаченная выручка» + «Источник: OS / Bitrix Payments»
- «Атрибутированная выручка» + «Источник: Маркетинговый СВОД»

Do not show two plain «Выручка» cards.
