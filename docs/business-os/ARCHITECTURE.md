# Architecture — Retro Pressa Business OS

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

Child systems (future)
├── Sales OS → 99_EXPORT only into mother
├── Traffic OS
├── Finance OS
├── Product OS
└── Production OS (blocked until stable status source)

External
├── Bitrix CRM
├── Marketing СВОД (График / day / Органика)
└── Dialog analytics workbook (transcripts stay outside mother)
```

Sync layer: Next.js API + npm scripts + Google service account. No IMPORTRANGE mesh.
