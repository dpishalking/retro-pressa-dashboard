# Data contracts

## Mother tabs (hardening sprint)

| Tab | Grain | Primary key | Update |
|-----|-------|-------------|--------|
| `00_Metrics_Registry` | metric | metric_id | full replace |
| `00_Data_Sources` | source | source_id | full replace |
| `00_Change_Log` | event | change_id | append |
| `00_Sync_Runs` | run | sync_id | append |
| `10_Countries` | country | country_id | full replace |
| `11_Channels` | channel | channel_id | full replace |
| `12_Employees` | employee | employee_id | full replace |
| `21_Customers_Core` | customer | customer_key | full replace |
| `24_Payments_Core` | payment | payment_id | full replace |
| `30_Company_Daily` | day | date | full replace |
| `31_Company_Monthly` | month | month | full replace + preserve payroll/opex |
| `50_Reconciliation` | check | period+metric_id | full replace |
| `08_Dialog_Export` | period pointer | period | full replace |
| `60_Bitrix_Leads_Raw` | lead | lead_id | staging replace |
| `61_Bitrix_Deals_Raw` | deal | deal_id | staging replace |
| `62_Bitrix_Contacts_Raw` | contact | contact_id | staging replace |
| `63_Bitrix_Stage_History` | stage event | event_id | staging replace |
| `64_Bitrix_Stages` | stage | stage_id | staging replace |
| `65_Bitrix_Pipeline` | open deal snapshot | deal_id+snapshot_date | staging replace |
| `66_Bitrix_Activities` | activity | activity_id | staging replace |
| `67_Bitrix_Dialog_Links` | dialog session | session_id | staging replace |
| `68_Bitrix_Field_Catalog` | field | entity_type+field_id | staging replace |
| `69_Bitrix_Data_Quality` | period×entity×field | composite | staging replace |

Details: `docs/business-os/BITRIX_SALES_FOUNDATION.md`.

## Customer key

Priority: `contact:` → `phone:{sha256}` → `email:{sha256}` → `lead:` → `deal:` → `order:`

## Revenue dual canon

- `os_paid_revenue` — Bitrix WON / Payments (company/finance/sales)
- `svod_attributed_revenue` — СВОД График (marketing)

Never unlabeled single `revenue`.

## Sales OS export

See `src/lib/sales-os/export-contract.ts` — version `sales_export_v1`.
Child workbook: `SALES_OS_SPREADSHEET_ID` / `src/config/sales-os.ts`.
Mother reads only `99_EXPORT`.

## Sales OS prediction (`sales_prediction_v1`)

Sheets `40`–`46` + `98_PREDICTION_EXPORT`. Code: `src/lib/sales-os/prediction/`.

| Sheet | Grain | Primary key | Update |
|-------|-------|-------------|--------|
| `40_Sales_Plans` | period×scope×metric | period_type+period+scope_type+scope_id+metric_id | preserve manual / upsert |
| `41_Sales_Prediction_Fact` | same | same | full replace |
| `42_Sales_Prediction_Model` | same | model_id | full replace |
| `43_Sales_Prediction_Drivers` | period×scope×target×driver | composite | full replace |
| `44_Sales_Prediction_Quality` | period×scope×metric | composite | full replace |
| `45_Sales_Prediction_View` | display rows | — | full replace (from model) |
| `46_Sales_Prediction_Reconciliation` | period×metric | composite | full replace |
| `98_PREDICTION_EXPORT` | month×scope×metric | composite | full replace |

Rules: approved plans only; fact from `12_Daily_Fact`; `gap_to_plan = run_rate − plan`; does **not** change `sales_export_v1`.  
Docs: [SALES_PREDICTION_LAYER.md](./SALES_PREDICTION_LAYER.md).

## Traffic OS export

See `src/lib/traffic-os/export-contract.ts`.

| Version | Status |
|---------|--------|
| `traffic_export_v1` | Legacy reference (channel label, `paid_revenue`) |
| `traffic_export_v2` | Lead-cohort management export (superseded in workbook) |
| `traffic_export_v3` | **Active** on Traffic OS `99_EXPORT` — payment-calendar attribution + direct/contact/customer revenue splits |

Mother must **not** ingest Traffic `99_EXPORT` as canon until explicit cutover.  
Management sheets 16–22: `traffic_management_v1`.  
Enrichment sheets 23–25: see `TRAFFIC_ATTRIBUTION_INTEGRITY.md`.

## Currency

Current amounts assume EUR. Reserved fields: `amount_original`, `currency`, `exchange_rate`, `amount_eur`.
