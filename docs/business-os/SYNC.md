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
```

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
