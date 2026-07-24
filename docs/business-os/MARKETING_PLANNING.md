# Marketing Planning

Workbook: `MARKETING_PLANNING_SPREADSHEET_ID`  
Default: `1Ru9H24Hs2WPNcP2TEGpvIEcRtjnDV8l-UyBnWNFakN4`  
Contract: `marketing_predictive_v1`  
Export: `marketing_predictive_export_v1`

## Role

Управленческий слой поверх Traffic OS + Sales OS (+ СВОД plans/spend).  
Не warehouse, не Sales OS, не рекламный кабинет.

## Open first

| Tab | Purpose |
|-----|---------|
| `20_Marketing_Planning` | Общий маркетинг (UX как Sales «Предиктивка продажи») |
| `21_Paid_Planning` | Paid |
| `22_Organic_Planning` | Organic |
| `23_Channel_Planning` | Каналы (compact) |
| `24_Landing_Planning` | Лендинги (compact) |

## Sync

```bash
npm run sync:marketing-planning:dry
npm run sync:marketing-planning
npm run sync:marketing-planning:validate
npm run sync:marketing-planning:reconciliation
```

`POST /api/sync/marketing-planning` — admin/rop.  
Body: `{ periods, modules, dryRun }`.

Code: `src/lib/marketing-planning/`, `src/config/marketing-planning.ts`.

## Canons

- Revenue / payments: **Sales OS**
- Sessions: **GA4 via Traffic OS**
- Plans: only approved rows in `02_Plan_Registry` (from СВОД План/факт after parse)
- Ads APIs (Meta/Google/Yandex): **NOT_CONNECTED**

See [MARKETING_PREDICTIVE_MODEL.md](./MARKETING_PREDICTIVE_MODEL.md), [MARKETING_PLANNING_USER_GUIDE.md](./MARKETING_PLANNING_USER_GUIDE.md).
