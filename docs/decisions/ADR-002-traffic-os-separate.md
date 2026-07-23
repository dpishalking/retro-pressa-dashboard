# ADR-002 — Why Traffic OS is a separate workbook

- **Status:** Accepted
- **Context:** Traffic taxonomy, maps, GA4 day-grain, marketing home must not pollute Mother or Sales grain.
- **Decision:** Traffic OS child workbook; export `traffic_export_v3`; Mother cutover blocked until policy sprint.
- **Consequences:** Traffic can evolve independently; dual-canon with Mother `01_Traffic_Daily` until cutover.
- **Refs:** [business-os/TRAFFIC_OS.md](../business-os/TRAFFIC_OS.md) · [DATA_FLOW.md](../DATA_FLOW.md)
