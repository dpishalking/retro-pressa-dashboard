# Systems Registry

Hub: [00_START_HERE.md](./00_START_HERE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SPREADSHEETS.md](./SPREADSHEETS.md)

| Name | Purpose | Owner | Spreadsheet (default) | Repo path | Status | Readiness | Export | Current focus | Next |
|------|---------|-------|----------------------|-----------|--------|-----------|--------|---------------|------|
| Mother OS | Hub, registries, dual-run ingest, company facts | platform / owner | `1iahEEem…Eu8` | `src/config/os-sheets.ts`, `src/lib/os-sheets/` | Active | Warehouse partial · Management partial | Ingests `sales_export_v1` | Dual-run | Sales cutover when ready |
| Sales OS | CRM warehouse + facts + ROP board | rop | `1Zj_jLoJz…RwY` | `src/lib/sales-os/` | Active | Found.+Mgmt Done · Prediction Partial | `sales_export_v1` | Dual-run trust | Prediction Alignment |
| Traffic OS | Traffic warehouse + mgmt + GA4 + home | marketing_ops | `1jBUvTiD…9Wg` | `src/lib/traffic-os/` | Active | Found.+Mgmt+Control Done · Pred. Blocked | `traffic_export_v3` | Unknown/orphans | Pred. if gates / Finance audit |
| Sales Foundation | Bitrix staging on Mother | platform | Mother `60–69` | `src/config/sales-foundation.ts` | Active | Staging Done | Feeds Sales OS | Maintain | — |
| Predictive Sales front | Plan/fact/PTF grid | rop | `1_bVqzLXO…820` | `src/lib/sales-os/predictive-*.ts` | Active (legacy place) | Prediction Partial | N/A | Standard alignment | Sales Prediction Alignment |
| Dialogs workbook | Transcripts | ops | `1mQEcDny…DcQmo` | `OS_DIALOGS_*` | Active | External warehouse | Index via Mother `08` | Keep bodies out of Mother | — |
| СВОД marketing | Plans / day / organic | marketing | `1nItFm1e…ey4M` | traffic raw / plans | Active | Source | — | Evidence | — |
| Maria truth | Manual paid truth | ops | `1nNC48If…HN2Mc` | Sales Maria | Active | Manual | — | Preserve | — |
| Finance OS | Cash / P&L | finance_tbd | — | template manifest | Planned | None | `finance_export_v1` planned | — | Coverage Audit |
| Product OS | Product performance | product_tbd | — | template manifest | Planned | None | `product_export_v1` planned | — | Coverage Audit |
| Executive OS | Role dashboards | owner | — | — | Planned | None | Reads contracts | — | After exports stable |
| Production OS | Jobs / SLA | — | Mother `04_*` stub | — | **Blocked** | None | — | Need status source | Do not invent |

## Manifests

| System | File |
|--------|------|
| Sales | `src/config/os-manifests/sales-os.ts` |
| Traffic | `src/config/os-manifests/traffic-os.ts` |
| Finance | `src/config/os-manifests/finance-os.template.ts` |
| Product | `src/config/os-manifests/product-os.template.ts` |

[READINESS.md](./READINESS.md) · [business-os/BUSINESS_OS_COMPLIANCE_MATRIX.md](./business-os/BUSINESS_OS_COMPLIANCE_MATRIX.md)
