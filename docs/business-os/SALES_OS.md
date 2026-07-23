# Sales OS Data Model v1 + Dual-Run

Child workbook (not mother internals).

## Workbook

- Spreadsheet ID: `1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY`
- Env: `SALES_OS_SPREADSHEET_ID`
- Contract: `sales_export_v1` on `99_EXPORT`

## Dual-run (current)

Mother candidate mirror: `32_Sales_OS_Daily`  
Reconciliation: `51_Sales_Reconciliation`  
Readiness: `52_Sales_Cutover_Readiness`

Legacy remains current. Details: `docs/business-os/SALES_OS_DUAL_RUN.md`.

## Workbook

- Title: Retro Pressa — Sales OS / `RP | Sales_OS`
- Spreadsheet ID: `1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY`
- Env: `SALES_OS_SPREADSHEET_ID` (priority) → fallback in `src/config/sales-os.ts`
- SA: `codex-pressa@secure-petal-446209-b8.iam.gserviceaccount.com` (Editor)

## Direction

```text
Bitrix → mother staging 60–69 → Sales OS normalized sheets → 99_EXPORT → mother aggregates
```

Mother reads **only** `99_EXPORT` from Sales OS. Never internal tabs `03_Leads`…`09_Active_Pipeline`.

## Tabs

| Tab | Role |
|-----|------|
| `00_Readme` | contract notes |
| `01_Settings` | key/value |
| `02_Managers` | manager dictionary |
| `03_Leads` | normalized leads |
| `04_Deals` | normalized deals |
| `05_Stage_Map` | stage dictionary |
| `06_Stage_History` | stage events |
| `07_Invoice_Events` | invoice facts from deal UF fields |
| `08_Payment_Events` | won deals by CLOSEDATE |
| `09_Active_Pipeline` | open pipeline snapshot |
| `10_Dialog_Links` | OL↔CRM links (no message bodies) |
| `11_Data_Quality` | fill-rate mirror |
| `12_Daily_Fact` | date × manager |
| `13_Funnel_Fact` | period × manager |
| `14_ROP_Board` | morning ROP board: plan vs fact, traffic light, actions |
| `15_Maria_Daily` | Maria day facts (truth sheet + optional chat paid_*) |
| `16_Maria_Snapshot` | Pull of «Отчет день/месяц» — yesterday/month/plan |
| `40_Sales_Plans` | Approved plans only (`sales_prediction_v1`) |
| `41_Sales_Prediction_Fact` | Prediction facts from Daily Fact |
| `42_Sales_Prediction_Model` | Plan / Fact / Run Rate / Gap |
| `43_Sales_Prediction_Drivers` | Simple revenue cascade |
| `44_Sales_Prediction_Quality` | Forecast gates |
| `45_Sales_Prediction_View` | Department + manager view from model |
| `46_Sales_Prediction_Reconciliation` | Legacy vs Sales OS dual-run |
| `98_PREDICTION_EXPORT` | `sales_prediction_v1` (not Mother ingest) |
| `99_EXPORT` | `sales_export_v1` for mother |

Legacy predictive front (dual-run peer): spreadsheet `PREDICTIVE_SALES_SPREADSHEET_ID` tab `Предиктивка продажи`. Official Prediction Layer: [SALES_PREDICTION_LAYER.md](./SALES_PREDICTION_LAYER.md).

## Commands

```bash
npm run sync:sales-os:dry -- --periods=2026-07
npm run sync:sales-os -- --periods=2026-07
npm run sync:sales-os -- --periods=2026-05,2026-06,2026-07
npm run sync:sales-prediction:dry -- --period=2026-07
npm run sync:sales-prediction -- --period=2026-07
```

API: `POST /api/sync/sales-os` · `POST /api/sync/sales-prediction` (admin/rop)

## Access denied

If SA cannot write, sync returns `blocked` with share instructions. Do **not** create another workbook.

## Contract

`src/lib/sales-os/export-contract.ts` — version `sales_export_v1`  
Weighted/forecast columns exist but stay empty until approved business rules.
