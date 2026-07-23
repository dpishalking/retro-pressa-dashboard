# Artifact Registry

Catalog of durable Business OS artifacts (types of deliverables).

Hub: [00_START_HERE.md](./00_START_HERE.md)

## Exports

| Artifact | Owner | Notes |
|----------|-------|-------|
| `sales_export_v1` | Sales OS | Mother dual-run consumer |
| `traffic_export_v3` | Traffic OS | Mother cutover blocked |
| Mother consumer tabs | Mother | Ingest from `99_EXPORT` only |

## Contracts

- Export column schemas / version bumps in code + `docs/business-os/DATA_CONTRACTS.md`
- Metric definitions: `METRIC_*` docs
- Layer standard: `BUSINESS_OS_STANDARD_V1.md`

## API

- Session-protected sync & analytics under `src/app/api/`
- Public: auth login/logout/me only (unless product expands)

## Sync

- Bitrix sync
- Google traffic / Sheets writers
- Traffic OS sync scripts
- GA4 foundation sync
- Clarity / UTM audit (see AGENTS.md)

## Prediction

- Sales predictive layers (partial)
- Mother/СВОД overlays (ops)
- Traffic prediction: planned
- Separate “predictive cuts” workbook: **Requires clarification**

## Dashboards

- Next.js screens: analytics, ad-analytics, ROP, training, digital-twin
- Sheet Homes: Marketing Home, Sales boards, Mother

## Standards

- Business OS Standard v1
- Metric / DQ / Sync standards
- ADR set in `docs/decisions/`

## Registries

- [SYSTEMS.md](./SYSTEMS.md)
- [SPREADSHEETS.md](./SPREADSHEETS.md)
- [DOCUMENT_INDEX.md](./DOCUMENT_INDEX.md)
- OS manifests in `src/config/os-manifests/`

## Blueprints

- [FINANCE_OS_BLUEPRINT.md](./business-os/FINANCE_OS_BLUEPRINT.md)
- [PRODUCT_OS_BLUEPRINT.md](./business-os/PRODUCT_OS_BLUEPRINT.md)
- Executive: ADR-007 + roadmap only
