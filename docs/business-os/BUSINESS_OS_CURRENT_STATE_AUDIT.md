# Business OS — Current State Audit

Sprint: Business OS Standard v1  
Date: 2026-07-22  
Scope: Mother · Sales OS · Traffic OS (config + contracts; no mass sheet migration)

Standard: [BUSINESS_OS_STANDARD_V1.md](./BUSINESS_OS_STANDARD_V1.md)

---

## 1. Systems overview

| System | Spreadsheet (default) | Export | Sync |
|--------|----------------------|--------|------|
| Mother | `1iahEEem…Eu8` | N/A (hub) | `sync:os-*`, foundation, ingest |
| Sales OS | `1Zj_jLoJz…RwY` | `sales_export_v1` | `sync:sales-os` |
| Traffic OS | `1jBUvTiD…9Wg` | `traffic_export_v3` | `sync:traffic-os` |

---

## 2. Mother — sheet inventory (summary)

| sheet_name | proposed_layer | grain / PK | status | gap | recommended_action |
|------------|----------------|------------|--------|-----|-------------------|
| 00_Registry | registry | — | partially_compliant | Weak column contract | Document columns; no rename |
| 00_Metrics_Registry | registry | metric_id | compliant | — | Keep as central metrics registry |
| 00_Data_Sources | registry | source_id | compliant | — | Keep |
| 00_Change_Log | registry | — | compliant | — | Keep |
| 00_Sync_Runs | sync_health | sync_id | compliant | — | Align fields to Sync Standard over time |
| 01_Traffic_Daily | warehouse/management | date×channel | legacy_but_working | Dual canon vs Traffic export | Keep until Traffic cutover policy |
| Органика | warehouse | date | legacy_but_working | SVOD grain | Keep |
| 02_Sales_Daily | management | date | legacy_but_working | Dual-run with Sales OS | Keep during dual-run |
| 03_Orders | warehouse | order_id | compliant | — | Keep |
| 04_Production_Jobs | warehouse | — | blocked | No stable source | Do not invent |
| 05_Reviews_NPS | warehouse | — | unknown | No contract | Audit later |
| 06_Products | warehouse | — | blocked | Title only | Product OS audit |
| 07_Finance_Daily | management | date | partially_compliant | Plan fields mixed | Finance OS audit first |
| 08_Dialog_Export | export | pointer | legacy_but_working | — | Keep |
| 10–12 Countries/Channels/Employees | registry | id | compliant | — | Keep |
| 21_Customers_Core | warehouse | customer_id | compliant | — | Keep |
| 24_Payments_Core | warehouse | payment_id | compliant | — | Keep |
| 30/31 Company Daily/Monthly | management | date/month | legacy_but_working | Dashboard-like | Keep |
| 32_Sales_OS_Daily | warehouse | date×manager | compliant | Dual-run ingest | Keep |
| 50_Reconciliation | reconciliation | — | compliant | — | Keep |
| 51_Sales_Reconciliation | reconciliation | — | compliant | — | Keep |
| 52_Sales_Cutover_Readiness | reconciliation | — | compliant | — | Keep |
| 60–69 Bitrix Foundation | warehouse/dq | lead/deal/… | compliant | — | Keep as Sales staging |
| 99_Bitrix_Map | settings | — | legacy_but_working | — | Keep |

---

## 3. Sales OS — sheet inventory

| sheet_name | proposed_layer | grain / PK | source | manual_fields | sync_type | external_consumers | contract_version | status | gap | recommended_action |
|------------|----------------|------------|--------|---------------|-----------|--------------------|------------------|--------|-----|-------------------|
| 00_Readme | registry | — | sync | — | full_replace | — | sales_os_v1 | partially_compliant | No full sheet registry | Add pointer to Standard |
| 01_Settings | settings | key | sync+manual | plan_* | upsert | — | — | partially_compliant | approval_status incomplete | Align settings passport later |
| 02_Managers | warehouse | manager_id | Bitrix | — | full_replace | — | — | legacy_but_working | — | Keep |
| 03_Leads | warehouse | lead_id | Foundation 60 | — | full_replace | Traffic (read via Sales) | — | compliant | UTM fill ~45% | Keep |
| 04_Deals | warehouse | deal_id | Foundation 61 | — | full_replace | — | — | compliant | — | Keep |
| 05_Stage_Map | settings | stage_id | sync+manual | business_stage | upsert | — | — | partially_compliant | — | Preserve manuals |
| 06_Stage_History | warehouse | event_id | Foundation | — | full_replace | — | — | compliant | — | Keep |
| 07_Invoice_Events | warehouse | event_id | derived | — | full_replace | — | — | compliant | — | Keep |
| 08_Payment_Events | warehouse | event_id | derived | — | full_replace | — | — | compliant | — | Keep |
| 09_Active_Pipeline | management | snapshot | derived | — | full_replace | — | — | legacy_but_working | Snapshot grain | Keep |
| 10_Dialog_Links | warehouse | dialog_id | dialogs | — | full_replace | — | — | legacy_but_working | — | Keep |
| 11_Data_Quality | data_quality | period×field | sync | — | full_replace | — | — | partially_compliant | Threshold approval | Align DQ Standard later |
| 12_Daily_Fact | management | date×manager | derived | — | full_replace | export | — | compliant | — | Keep |
| 13_Funnel_Fact | management | period×manager | derived | — | full_replace | — | — | compliant | — | Keep |
| 14_ROP_Board | dashboard | section×item | derived | — | full_replace | UI | — | legacy_but_working | — | Keep |
| 15_Maria_Daily | warehouse | date | manual | paid_* | manual | predictive | — | legacy_but_working | Manual truth | Preserve forever |
| 16_Maria_Snapshot | management | key | manual | value | manual | — | — | legacy_but_working | — | Preserve |
| 99_EXPORT | export | date×manager | facts | — | full_replace | Mother dual-run | **sales_export_v1** | compliant | — | Version discipline |
| Предиктивка (external) | prediction | plan/fact grid | SVOD+Maria+Bitrix | plan cells | separate sync | ROP | — | **needs_migration** | Outside OS numbering / contract | **Sales Prediction Layer Alignment** |

---

## 4. Traffic OS — sheet inventory

| sheet_name | proposed_layer | grain / PK | source | status | gap | recommended_action |
|------------|----------------|------------|--------|--------|-----|-------------------|
| 00_Readme / 01_Settings | registry/settings | — | sync | partially_compliant | Settings passport incomplete | Keep; gradual field align |
| 02–04 Maps | warehouse mapping | key | sync+manual | compliant | — | Preserve manuals |
| 05–06 Raw | warehouse raw | day | SVOD | compliant | — | Keep |
| 07 CRM Leads | warehouse | lead_id | Sales | compliant | — | Keep |
| 08 Attribution | warehouse attribution | lead_id | derived | compliant | — | Keep |
| 09–13 Facts | management | date×… | derived | legacy_but_working | Numbers ≠ Standard 30–39 | **Do not rename** |
| 14 DQ / 15 Recon | dq/recon | — | sync | partially_compliant | — | Keep |
| 16–20 Management | management | period×entity | derived | compliant | Numbering overlaps “raw band” in Standard | Document as legacy map |
| 21 Coverage | reconciliation | — | sync | compliant | — | Keep |
| 22 Alerts | management | alert_id | sync | partially_compliant | Lifecycle partial | Align alert fields later |
| 23–25 Join/Revenue/Gaps | dq/attribution | — | sync | compliant | — | Keep |
| 26–29 / 34–35 GA4 | warehouse | date×dims | GA4 API | compliant | Single property | Keep |
| 30–33 Marketing Control | dashboard/dq | block×item | derived | compliant | Occupies Standard “management” band | Document; no rename |
| 36 GA4 DQ | data_quality | metric_id | sync | compliant | — | Keep |
| 99_EXPORT | export | date×type×channel×landing×campaign | facts | compliant | Mother cutover blocked | Keep `traffic_export_v3` |

Prediction: **absent** (blocked) — not a sheet gap to fake.

---

## 5. Naming migration map (future only)

| current_sheet | standard_role | future_name | migration_required | priority |
|---------------|---------------|-------------|--------------------|----------|
| Sales 12_Daily_Fact | management | 30_Daily_Fact | no (cosmetic) | low |
| Traffic 09–13 Facts | management | 30–39_* | no | low |
| Traffic 16–20 Mgmt | management | 30–39_* | no | low |
| Traffic 30–33 Control | dashboard | 80–89_* | no | low |
| Sales predictive external | prediction | 40_Prediction_* | **yes** (logical) | **high** |
| Finance (none) | all | Standard bands | n/a | — for new OS |

---

## 6. Architectural repeats (good patterns)

- Child workbook + `00_Readme` + `01_Settings` + `99_EXPORT`  
- Foundation → normalized → management → export  
- Dual-run / reconciliation before Mother cutover  
- Manual truth sheets (Maria) preserved  
- Contract versions on export  
- Dry-run + module filters (Traffic)

## 7. Real problems vs cosmetic

**Real:** Prediction outside Sales OS contract; Traffic Prediction blocked; Settings approval_status incomplete; Mother stubs 04/06; fragmented DQ thresholds; Traffic numbering ≠ Standard  

**Cosmetic:** Sheet number bands differ; multiple DQ sheet names; Russian predictive tab titles  

**Do not fix for beauty before Finance OS.**
