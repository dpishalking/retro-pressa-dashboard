# Sales OS Dual-Run

## Why

Prove Sales OS `99_EXPORT` against legacy before any hard cutover.

```text
legacy = current
sales_os_export = candidate
```

## Direction

```text
Bitrix → mother 60–69 → Sales OS → 99_EXPORT → 32_Sales_OS_Daily → 51/52 reconciliation
```

Mother never reads Sales OS internal tabs.

## Mother tabs

| Tab | Role |
|-----|------|
| `32_Sales_OS_Daily` | mirror of `99_EXPORT` |
| `51_Sales_Reconciliation` | legacy vs candidate |
| `52_Sales_Cutover_Readiness` | readiness gates |

## Canonical status

- `02_Sales_Daily` / `03_Orders` / `24_Payments_Core` = **current**
- Sales OS export = **candidate**
- Company Daily/Monthly stay on legacy

## Commands

```bash
npm run sync:sales-os -- --periods=2026-05,2026-06,2026-07   # rebuild export if needed
npm run sync:sales-os-ingest:dry -- --periods=2026-05,2026-06,2026-07
npm run sync:sales-os-ingest -- --periods=2026-05,2026-06,2026-07
npm run sync:sales-os-reconciliation
```

API: `POST /api/sync/sales-os-ingest`

## Cutover blockers

Blocks: deals, payments, paid_revenue, manager_count, contract_schema, sync_health  
Non-blocking until definitions approved: leads, invoice_events

Hard cutover is **manual only** after readiness.

## Rollback

Keep ingest disabled / skip candidate in os-daily (`skipSalesOsCandidate`) and continue legacy.
