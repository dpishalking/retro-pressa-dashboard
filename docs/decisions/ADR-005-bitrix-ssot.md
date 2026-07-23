# ADR-005 — Why Bitrix is SSOT for CRM events

- **Status:** Accepted
- **Context:** Leads, deals, stage history originate in Bitrix.
- **Decision:** Bitrix is system-of-record for CRM **events**. Sales Foundation / Sales OS are normalized derivatives for Business OS.
- **Consequences:** Fixes happen upstream or via explicit mapping — not silent Mother edits of Bitrix facts.
- **Note:** Maria may be operational truth for **paid** figures in predictive overlays — does not replace Bitrix as CRM SSOT.
- **Refs:** [business-os/BITRIX_SALES_FOUNDATION.md](../business-os/BITRIX_SALES_FOUNDATION.md) · [DATA_FLOW.md](../DATA_FLOW.md)
