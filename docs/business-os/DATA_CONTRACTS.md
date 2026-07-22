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

## Currency

Current amounts assume EUR. Reserved fields: `amount_original`, `currency`, `exchange_rate`, `amount_eur`.
