# ADR-006 — Why Warehouse / Management / Prediction are separated

- **Status:** Accepted (Business OS Standard v1)
- **Context:** Mixing grains caused fake forecasts, silent zeros, and unreadable sheets.
- **Decision:** Logical layers — Warehouse (evidence), Management (facts/alerts), Prediction (plan/run-rate/gap), Dashboard (UI), Export (contracts).
- **Consequences:** New OS follow templates; existing sheet numbers may stay legacy without mass rename.
- **Refs:** [business-os/BUSINESS_OS_STANDARD_V1.md](../business-os/BUSINESS_OS_STANDARD_V1.md)
