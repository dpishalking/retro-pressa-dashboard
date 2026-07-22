# Sync

## Commands

```bash
npm run sync:os-orders
npm run sync:os-traffic
npm run sync:os-sales
npm run sync:os-finance
npm run sync:os-dialog-index
npm run sync:os-core
npm run sync:bitrix-sales-foundation:dry
npm run sync:bitrix-sales-foundation
npm run sync:sales-os:dry
npm run sync:sales-os
npm run sync:sales-os-ingest:dry
npm run sync:sales-os-ingest
npm run sync:traffic-os:dry
npm run sync:traffic-os
npm run sync:traffic-management:dry
npm run sync:traffic-management
```

## Traffic OS

`POST /api/sync/traffic-os` — admin/rop.

Body: `{ periods, modules, dryRun }`. Modules: `all | management | foundation | traffic_management | … | export`.  
Writes workbook `TRAFFIC_OS_SPREADSHEET_ID` sheets 00–22 + `99_EXPORT` (`traffic_export_v2`). Mother cutover **not** enabled. See `TRAFFIC_MANAGEMENT_LAYER.md`.

## Sales OS dual-run

`POST /api/sync/sales-os-ingest` — admin/rop.

Ingests Sales OS `99_EXPORT` → mother `32_Sales_OS_Daily`, then writes `51_Sales_Reconciliation` + `52_Sales_Cutover_Readiness`.
Legacy remains current. See `docs/business-os/SALES_OS_DUAL_RUN.md`.

`os-daily` includes candidate step `sales_os_candidate` after payments; failure yields overall `partial` without stopping company aggregates.

## Bitrix Sales Foundation (staging 60–69)

`POST /api/sync/bitrix-sales-foundation` — admin/rop.

Order: field_catalog → stages → leads → deals → contacts → stage_history → pipeline → activities → dialog_links → data_quality.

Dry run reads Bitrix only. Production uses `safeReplaceSheet` on staging tabs; failed modules do not clear previous successful sheet data. See `docs/business-os/BITRIX_SALES_FOUNDATION.md`.

## Daily cron

`POST /api/sync/os-daily` — 12:00 Europe/Moscow

Order:

1. orders  
2. traffic  
3. sales  
4. finance  
5. customers  
6. payments  
7. company_daily  
8. company_monthly  
9. dictionaries  
10. reconciliation  
11. metrics registry  
12. data sources  

Partial failures return per-step JSON; successful steps are kept. Parallel double-run returns 409.

## Safety

`safeReplaceSheet` validates header before clear/write. URL-in-header and schema mismatch refuse write and log `00_Sync_Runs` as failed.
