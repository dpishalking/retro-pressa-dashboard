# Traffic OS

Child warehouse for traffic evidence. Architecture mirrors Sales OS.

**Spreadsheet:** `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg`  
**Env:** `TRAFFIC_OS_SPREADSHEET_ID`  
**Contracts:** `traffic_os_v1` (workbook), `traffic_management_v1` (sheets 16–22), `traffic_export_v2` (`99_EXPORT`)

Related: `TRAFFIC_MANAGEMENT_LAYER.md`, `TRAFFIC_MANAGEMENT_AUDIT.md`, `TRAFFIC_IDENTITY_REPORT.md`, coverage/source-map/roadmap.

## Architecture

```text
Marketing СВОД (day / Органика)
Bitrix Foundation 60 + Sales OS 03/04/07/08
Contractor landing titles (ALX/ART)
        │
        ▼
RAW          05_Traffic_Raw / 06_Organic_Raw / 07_CRM_Leads
MAPS         02_Source_Map / 03_Landing_Map / 04_Campaign_Map
ATTRIBUTION  08_Attribution  (Lead → Deal → Invoice → Payment → Revenue)
FACTS        09–13 Landing / Channel / Campaign / Daily / Monthly
QUALITY      14_Data_Quality / 15_Reconciliation
MANAGEMENT   16–22 Traffic / Type / Channel / Landing / Campaign / Sales Coverage / Alerts
EXPORT       99_EXPORT (`traffic_export_v2`) → mother (not switched)
```

No IMPORTRANGE. No invented forecasts/plans/CPL/ROAS as canon.

## Data Contracts

| Sheet | Grain | PK |
|-------|-------|----|
| `05_Traffic_Raw` | day | date |
| `06_Organic_Raw` | day | date |
| `07_CRM_Leads` | lead | lead_id |
| `08_Attribution` | lead | lead_id |
| `09_Landing_Fact` | date × landing | date + landing_id |
| `10_Channel_Fact` | date × traffic_type × channel | composite |
| `11_Campaign_Fact` | date × campaign_key | composite |
| `12_Daily_Fact` | date | date |
| `13_Monthly_Fact` | month | month |
| `99_EXPORT` | date × traffic_type × channel_id × landing_id × campaign_id | composite (`traffic_export_v2`) |
| `16_Traffic_Management` | month × block × item × metric | composite |
| `17_Traffic_Type_Fact` | date × traffic_type | composite |
| `18–20_*_Management` | period_type × period × entity | composite |
| `21_Traffic_Sales_Coverage` | period × metric_id | composite |
| `22_Traffic_Alerts` | alert_id | alert_id |

### Taxonomy (`traffic_type`)

`paid | organic_social | organic_search | referral | direct | partner | messenger | email | offline | unknown | excluded`

Rules live in `src/lib/traffic-os/taxonomy.ts`. Unmapped SOURCE_ID / ambiguous UTM → **unknown**. Manual labels in `02_Source_Map` are preserved on sync.

Identity sprint report: `TRAFFIC_IDENTITY_REPORT.md`.

## Source of Truth

| Metric | SoT |
|--------|-----|
| CRM leads / UTM / SOURCE_ID | Sales OS `03_Leads` (+ Foundation `source_description` / language) |
| Deal / Invoice / Payment / Revenue | Sales OS `04` / `07` / `08` via lead→deal join |
| Media spend / clicks / СВОД leads CRM | СВОД `day` / `Органика` (evidence only; not Sales money) |
| Landing URL | Bitrix WEB / `source_description` / contractor titles |
| Channel class | `02_Source_Map` only |

## Update Flow

```bash
npm run sync:traffic-os:dry -- --periods=2026-05,2026-06,2026-07
npm run sync:traffic-os -- --periods=2026-05,2026-06,2026-07
npm run sync:traffic-management:dry -- --periods=2026-05,2026-06,2026-07
npm run sync:traffic-management -- --periods=2026-05,2026-06,2026-07
```

Code: `src/lib/traffic-os/*`, `src/config/traffic-management.ts`, API `POST /api/sync/traffic-os`.

## Data Quality

See sheet `14_Data_Quality` after sync (UTM, landing, source, country, language, deal/payment linkage, unknown share).

## Known Gaps

1. Residual ~14.5% `unknown` (mostly bare WEB / landing SOURCE + ambiguous `instagram|social`) — see Identity Report.  
2. `language_raw` mostly empty in CRM; language mostly from URL path.  
3. Landing URL still partial (~48%).  
4. Attribution revenue < Sales OS calendar payments (orphans / date grain).  
5. СВОД «Лиды CRM» ≠ Bitrix lead count (definition conflict — explained in Reconciliation).  
6. GA4 visits not ingested yet.  
7. Mother not reading Traffic `99_EXPORT` yet.

## Non-goals (Foundation v1)

Predictive Traffic, plan-fact, CPL/CAC/ROAS canon, weighted attribution, AI, Mother cutover.
