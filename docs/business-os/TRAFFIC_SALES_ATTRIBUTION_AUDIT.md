# Traffic ↔ Sales Attribution Audit

**Sprint:** Traffic ↔ Sales Attribution Enrichment v1  
**Date:** 2026-07-22  
**Workbook:** `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg`

Constraints: no invented joins, no name matching, no Mother cutover, no CPL/ROAS/forecast.

---

## 1. Join chain (as of Management Layer)

```text
Bitrix Lead → Sales OS 03_Leads → Traffic 07/08 (cohort lead.created_at)
     ↓ lead_id
Bitrix Deal → Sales OS 04_Deals
     ↓ deal_id
Invoice proxy → 07_Invoice_Events (from deal.invoice_at)
Payment proxy → 08_Payment_Events (won deal + closed_at → paid_at, amount=opportunity)
```

| Hop | Primary key | Join rule (current) | Coverage (approx) | Confidence | Risk |
|-----|-------------|---------------------|-------------------|------------|------|
| Traffic ← Lead | `lead_id` | Period filter on `created_at` | ~100% of CRM leads in scope | high | Definition vs СВОД |
| Lead → Deal | `deal.lead_id` | Exact; **first deal by created_at only** | ~44.5% leads | high | Later deals ignored |
| Deal → Invoice | `deal_id` | Exact count | partial | medium | Synthetic invoice event |
| Deal → Payment | `deal_id` | Exact sum | ~7.5% leads have pay | medium | Payment = won proxy |
| Payment calendar ↔ Traffic | — | Not used; cohort only | amount ~71.6% | mixed | Cross-period lost in linkage % |

---

## 2. Keys available

| Key | Sales Leads | Sales Deals | Payment Events | Foundation Contacts | Traffic Attribution |
|-----|-------------|-------------|----------------|---------------------|---------------------|
| `lead_id` | yes | yes | yes | — | yes |
| `deal_id` | — | yes | yes | — | primary only |
| `contact_id` | yes | yes | yes | yes | **no** |
| `customer_key` | yes | yes | yes | yes | **no** |
| `phone_hash` | no | no | no | yes | no |
| `email_hash` | no | no | no | yes | no |
| name | — | — | — | — | **forbidden** |

---

## 3. Orphan / gap classes (to classify)

| Class | Meaning |
|-------|---------|
| `orphan_deal` | Deal with empty `lead_id` |
| `missing_lead` | `lead_id` present but lead not in Sales OS / not resolvable |
| `cross_period` | Payment in period; lead created outside period (recoverable via lead_id) |
| `primary_deal_only_loss` | Secondary deals of same lead ignored by current Attribution |
| `missing_contact` | No contact_id for bridge |
| `ambiguous_contact` | contact_id maps to >1 lead → **do not join** |
| `ambiguous_customer` | customer_key maps to >1 lead → **do not join** |
| `legacy_deal` / `manual_deal` | Heuristic flags only if evidenced (else `other`) |
| `unlinked_payment` | Payment without deal_id |
| `unknown_revenue` | In period Sales revenue with no safe traffic join |

---

## 4. Allowed enrichment methods (ordered)

| Method | Confidence | Rule |
|--------|------------|------|
| `lead_id` | **high** | Payment/deal carries lead_id; resolve traffic from that lead |
| `deal_lead_id` | **high** | Via deal.lead_id when payment.lead_id empty |
| `contact_id` | **medium** | contact_id → **exactly one** Sales lead |
| `customer_key` | **medium** | customer_key → **exactly one** Sales lead |
| `phone_hash` | **low** | Contact hash → unique contact → unique lead; **recorded in Join Quality; not used for channel revenue** (false-match protection) |
| `email_hash` | **low** | Same as phone |
| `manual` | manual | Source Map / future override only |
| `unknown` | unknown | Leave unattributed |

**Forbidden:** name, fuzzy string, redistribute unknown, force-match ambiguous keys.

---

## 5. Enrichment deliverables

| Sheet | Role |
|-------|------|
| `23_Join_Quality` | Registry of join rules + coverage |
| `24_Revenue_Attribution` | Payment-event grain attributed rows |
| `25_Attribution_Gaps` | Unattributable reasons |
| Extended `21_Traffic_Sales_Coverage` | lead / contact / customer paths |
| `traffic_export_v3` | Payment-calendar attributed rollup (Mother not switched) |

---

## 6. Why coverage may not reach 100%

1. Orphan deals without lead_id (Bitrix data).
2. Ambiguous contact/customer (multiple leads).
3. Payment proxy model ≠ bank ledger.
4. Phone/email intentionally not used for channel money (false match risk).
5. Leads deleted / missing from Sales OS extract.

---

## 7. Implementation plan

Additive module `src/lib/traffic-os/sales-attribution.ts` → wired from `buildTrafficOsModel` / `syncTrafficOs`.  
Do **not** rewrite Identity taxonomy or Management sheet roles.
