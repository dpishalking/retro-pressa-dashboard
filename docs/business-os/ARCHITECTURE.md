# Architecture — Retro Pressa Business OS

Canonical layer standard: **[BUSINESS_OS_STANDARD_V1.md](./BUSINESS_OS_STANDARD_V1.md)**  
(Warehouse → Management → Prediction → Dashboard → Export + Settings/DQ/Recon).

```text
Mother
├── Registry / Metrics contracts / Data sources / Change log / Sync runs
├── Thin dictionaries (Countries, Channels, Employees)
├── Orders spine
├── Customers core
├── Payments core
├── Company daily
├── Company monthly
├── Reconciliation
└── BI-ready aggregates

Child systems
├── Sales OS → 99_EXPORT (sales_export_v1) dual-run into mother
├── Traffic OS → 99_EXPORT (traffic_export_v3); mother cutover blocked
├── Finance OS → blueprint only (Coverage Audit next)
├── Product OS → blueprint only (catalog source blocked)
└── Production OS (blocked until stable status source)

External
├── Bitrix CRM
├── Marketing СВОД (График / day / Органика)
├── GA4 (Traffic warehouse foundation)
└── Dialog analytics workbook (transcripts stay outside mother)
```

Sync layer: Next.js API + npm scripts + Google service account. No IMPORTRANGE mesh.  
Manifests: `src/config/os-manifests/`.
