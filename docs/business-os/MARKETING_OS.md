# Marketing OS — Sheet Audit

Workbook: `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg`  
Sprint: Marketing Operating System v1 (Control Layer)  
Contract: `marketing_os_v1`

## Layer map

| Sheet | Role | Audience |
|-------|------|----------|
| `00_Readme` | service | engineers |
| `01_Settings` | registry / config (incl. health weights) | engineers + ops |
| `02_Source_Map` | registry | ops |
| `03_Landing_Map` | registry | ops |
| `04_Campaign_Map` | registry | ops |
| `05_Traffic_Raw` | raw | engineers |
| `06_Organic_Raw` | raw | engineers |
| `07_CRM_Leads` | raw | engineers |
| `08_Attribution` | fact | analysts |
| `09–13_*_Fact` | fact | analysts |
| `14_Data_Quality` | service | ops |
| `15_Reconciliation` | service | engineers |
| `16_Traffic_Management` | management | marketers / ROP |
| `17_Traffic_Type_Fact` | fact | analysts |
| `18–20_*_Management` | management | marketers |
| `21_Traffic_Sales_Coverage` | management | marketers / ROP |
| `22_Traffic_Alerts` | alerts (Critical / Warning / Info / Resolved) | marketers |
| `23_Join_Quality` | registry | engineers |
| `24_Revenue_Attribution` | fact | analysts |
| `25_Attribution_Gaps` | service | ops |
| **`30_Marketing_Home`** | **control home** | **marketer daily** |
| **`31_Unknown_Center`** | **control detail** | marketer / ops |
| **`32_Data_Quality_Center`** | **control detail** | ops |
| **`33_Marketing_Timeline`** | **control history** | marketer / owner |
| `99_EXPORT` | export | Mother (not cut over) |

## Role taxonomy

| Role | Meaning |
|------|---------|
| raw | Evidence as ingested |
| fact | Derived grain tables |
| management | Operable aggregates + status |
| registry | Maps / join rules |
| service | DQ, recon, gaps |
| control | Daily marketing operating surface (30–33) |
| export | Downstream contract |

## Daily workflow

1. Open `30_Marketing_Home`
2. Read Traffic Health + Today's Priorities
3. Drill to `31` / `32` / `18–20` / `22` only if needed
4. Check `33_Marketing_Timeline` for progress between syncs

## Docs

- `MARKETING_HOME.md`
- `TRAFFIC_HEALTH.md`
- `UNKNOWN_CENTER.md`

## Out of scope (this sprint)

No Meta / GA4 / Google Ads APIs. No ROAS / CAC / forecast / planning / budget. No Mother cutover. No new workbook.
