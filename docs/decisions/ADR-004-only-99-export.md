# ADR-004 — Why only `99_EXPORT` for child → Mother exchange

- **Status:** Accepted
- **Context:** Avoid IMPORTRANGE mesh and silent coupling to internal tabs.
- **Decision:** Official exchange is versioned `99_EXPORT` (`<domain>_export_vN`). Mother/Executive must not treat internal child sheets as canon.
- **Consequences:** Schema changes require new version + tests; dual-run validates before cutover.
- **Refs:** [business-os/BUSINESS_OS_STANDARD_V1.md](../business-os/BUSINESS_OS_STANDARD_V1.md) · [ARTIFACTS.md](../ARTIFACTS.md)
