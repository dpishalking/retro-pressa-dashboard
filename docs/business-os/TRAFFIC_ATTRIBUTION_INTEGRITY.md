# Traffic Attribution Integrity Report

**Sprint:** Traffic ↔ Sales Attribution Enrichment v1  
**Date:** 2026-07-22  
**Export:** `traffic_export_v3` (Mother not switched)

Related: `TRAFFIC_SALES_ATTRIBUTION_AUDIT.md`, `TRAFFIC_MANAGEMENT_LAYER.md`.

---

## What is now proven

| Claim | Evidence | Confidence |
|-------|----------|------------|
| Payment with `lead_id` → traffic identity of that lead | `24_Revenue_Attribution` method=`lead_id` | **high** |
| Payment via `deal.lead_id` when payment.lead_id empty | method=`deal_lead_id` | **high** |
| Cross-period: lead created earlier, paid in period | `cross_period=true` | **high** (join); traffic class as Identity rules |
| Unique `contact_id` → exactly one lead | method=`contact_id` | **medium** |
| Unique `customer_key` → exactly one lead | method=`customer_key` | **medium** |
| All deals of a lead counted in lead-cohort Attribution | sum by `lead_id` | **high** |
| Ambiguous contact/customer left unattributed | gap reasons | **by design** |
| Phone/email hash **not** used for channel money | `23_Join_Quality` status=`not_used_for_revenue` | **safety** |
| Name matching never used | — | **forbidden** |
| False matches introduced by auto-join | `false_matches=0` | **acceptance** |

---

## What is not proven

- That attributed revenue = bank cash (Sales payment is won-deal proxy).
- Channel ranking by revenue without filtering `confidence` / method.
- Organic volumes (still mostly unknown / ambiguous UTM).
- Spend → revenue ROAS.
- Predictive readiness.

---

## Attribution methods (locked)

| Method | Confidence | Auto channel money? |
|--------|------------|---------------------|
| `lead_id` | high | yes |
| `deal_lead_id` | high | yes |
| `contact_id` (unique only) | medium | yes |
| `customer_key` (unique only) | medium | yes |
| `phone_hash` | low | **no** |
| `email_hash` | low | **no** |
| `manual` | manual | only if explicit |
| `unknown` | unknown | no |

---

## Sheets

| Sheet | Purpose |
|-------|---------|
| `23_Join_Quality` | Join registry |
| `24_Revenue_Attribution` | Payment-event attribution |
| `25_Attribution_Gaps` | Unattributable cases |
| `21_Traffic_Sales_Coverage` | Extended lead/contact/customer paths |
| `99_EXPORT` | `traffic_export_v3` payment-calendar rollup |

---

## Main remaining blockers for Planning / Predictive

1. Unknown traffic still ~14.5% (bare WEB + ambiguous social UTM).  
2. Payment model ≠ bank ledger.  
3. Orphan deals without lead_id.  
4. Ambiguous contact/customer intentionally unattributed.  
5. No approved spend canon / no GA4 visits.

**Verdict:** Enrichment improves **provable** payment↔traffic linkage without inventing joins.  
Traffic OS is **not** ready for Traffic Planning & Predictive Layer until unknown + orphan gaps shrink and spend canon exists.
