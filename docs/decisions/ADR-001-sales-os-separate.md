# ADR-001 — Why Sales OS is a separate workbook

- **Status:** Accepted (documented from existing architecture)
- **Context:** CRM volume, dual-run cutover, Maria truth, ROP board need a child warehouse.
- **Decision:** Sales OS lives in its own Google spreadsheet; Mother ingests only `99_EXPORT` (`sales_export_v1`) via dual-run.
- **Consequences:** Sync ownership clear; Mother stays thin; cutover is explicit.
- **Refs:** [ARCHITECTURE.md](../ARCHITECTURE.md) · [business-os/SALES_OS_DUAL_RUN.md](../business-os/SALES_OS_DUAL_RUN.md)
