# Sales OS Dual-Run Audit

Date: 2026-07-22

## Exists

- Mother hardening + `os-daily` cron (legacy current)
- Staging `60–69` in mother
- Local uncommitted Sales OS Data Model v1 (`src/lib/sales-os/*`, `src/config/sales-os.ts`)
- Sales OS workbook filled; `99_EXPORT` ~753 rows (`sales_export_v1`)
- Helpers: `safeReplaceSheet`, Sync Runs, registries, metrics registry

## Legacy path (current)

```text
Bitrix → 03_Orders → 02_Sales_Daily / 24_Payments_Core → Company aggregates
```

`02_Sales_Daily` grain: date × manager_id  
Columns: deals_created, invoices, payments, revenue (no leads)

## Sales OS path (candidate)

```text
Bitrix → mother 60–69 → Sales OS model → 99_EXPORT → (this sprint) 32_Sales_OS_Daily
```

## Gaps before this sprint

- Mother did not ingest `99_EXPORT`
- Export columns were thinner than dual-run contract (missing CR fields, paid_revenue naming, active_deals, etc.)
- No `51_Sales_Reconciliation` / `52_Sales_Cutover_Readiness`

## Planned changes

1. Align `sales_export_v1` columns to dual-run contract; rebuild export from Sales OS sync
2. Mother mirror `32_Sales_OS_Daily`
3. Ingest + validation + health
4. Reconciliation + cutover readiness
5. Wire into `os-daily` as non-blocking candidate steps

## Risks

- Leads absent in legacy Sales_Daily → pending_definition
- Payments: Orders paid_at vs WON CLOSEDATE/OPPORTUNITY → may differ
- Invoice fill-rate low → expected_difference / pending_definition
- Sheets quota on multi-book sync
- Uncommitted local Sales OS code must be preserved
