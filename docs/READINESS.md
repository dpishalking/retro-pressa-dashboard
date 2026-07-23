# Readiness Matrix

Statuses: **Done** | **Partial** | **Planned** | **Blocked**

Hub: [00_START_HERE.md](./00_START_HERE.md) · Compliance: [business-os/BUSINESS_OS_COMPLIANCE_MATRIX.md](./business-os/BUSINESS_OS_COMPLIANCE_MATRIX.md)

| Capability | Mother | Sales | Traffic | Finance | Product | Executive |
|------------|--------|-------|---------|---------|---------|-----------|
| Warehouse | Partial | Done | Done | Planned | Planned | Planned |
| Management | Partial | Partial | Done | Planned | Planned | Planned |
| Prediction | Partial* | Partial→**in-OS v1** | Planned | Planned | Planned | Planned |
| Dashboard (app UI) | Partial | Partial | Partial | Planned | Planned | Planned |
| Export (`99_EXPORT`) | N/A (consumer) | Done | Done | Planned | Planned | Planned (reader) |
| Documentation | Partial→improving | Done | Done | Blueprint | Blueprint | ADR only |
| Testing | Partial | Partial | Partial | — | — | — |
| Sync | Partial | Done | Done | — | — | — |
| Production | Live | Live | Live | — | — | — |

\*Mother may host or consume predictive overlays; child OS remain calculation owners where dual-run applies.  
Sales Prediction: sheets `40–46` + `98_PREDICTION_EXPORT` (`sales_prediction_v1`); legacy workbook dual-run. See [business-os/SALES_PREDICTION_LAYER.md](./business-os/SALES_PREDICTION_LAYER.md).

### Notes

- Traffic → Mother cutover: **Blocked**
- Finance / Product / Executive: **Planned**
- Manifest compliance: Sales/Traffic **partially_compliant** per Standard v1
- GA4 hard CRM identity: **Partial / weak** (see GA4_AUDIT)
- Sales week/manager plans: **NO_PLAN** until approved on `40_Sales_Plans`
