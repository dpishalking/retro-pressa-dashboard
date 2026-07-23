# Sales Prediction Reconciliation

Legacy predictive front vs Sales OS Prediction Layer (`sales_prediction_v1`).

Audit: [SALES_PREDICTION_ALIGNMENT_AUDIT.md](./SALES_PREDICTION_ALIGNMENT_AUDIT.md)  
Layer: [SALES_PREDICTION_LAYER.md](./SALES_PREDICTION_LAYER.md)

Sheet: `46_Sales_Prediction_Reconciliation` (filled by `sync:sales-prediction`).

---

## Method

Compare month (and optionally weeks) for:

`paid_revenue`, `payments`, `average_check`, `leads`, `deals`, `invoice_events`

| Side | Source |
|------|--------|
| Legacy | External workbook / optional `legacyMonthAgg` in sync |
| Sales OS | `41_Sales_Prediction_Fact` from `12_Daily_Fact` |

Statuses: `matched` · `expected_difference` · `mismatch` · `pending_definition` · `missing_legacy` · `missing_sales_os`

---

## Expected differences (do not “fix” silently)

| Metric | Reason |
|--------|--------|
| paid_revenue / payments | Legacy may prefer Maria paid truth; Sales OS uses Daily Fact / Payment Events (Bitrix WON) |
| leads | Legacy may prefer СВОД day+organic; Sales OS uses Daily Fact leads |
| Week PLAN | Legacy equal-split `МЕС/weekCount` = **unsupported**; Sales OS week PLAN = NO_PLAN unless approved week row |
| Deals PLAN | Legacy `deriveDealsPlanForInvoices` = scenario; Sales OS ignores |

---

## How to refresh

```bash
npm run sync:sales-prediction:dry -- --period=2026-07
# production write (with SA):
npm run sync:sales-prediction -- --period=2026-07
```

Pass legacy aggregates into sync API when available for numeric dual-run; otherwise rows show `missing_legacy`.

---

## Cutover

Legacy workbook is **not** deleted in this sprint.  
Decommission only after ops accept reconciliation + approved plans on `40_Sales_Plans`.
