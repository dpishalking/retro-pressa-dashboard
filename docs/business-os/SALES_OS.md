# Sales OS (skeleton)

Not live yet. Contract only.

## Future workbook tabs

`00_Readme` … `11_Data_Quality` + `99_EXPORT`

## Export contract

Version: `sales_export_v1`  
Code: `src/lib/sales-os/export-contract.ts`

Mother will ingest **only** `99_EXPORT`. Current `02_Sales_Daily` stays Bitrix/Orders-derived until cutover.

## Dialog daily (future)

Planned mother sheet `38_Dialog_Daily` (date × manager). Do not use message `rows_count` as dialog count. Requires stable `dialog_id`.
