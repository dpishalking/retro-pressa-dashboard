# Traffic Management Layer v1

Workbook: `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg`  
Contracts: `traffic_os_v1` + `traffic_management_v1` + `traffic_export_v2`  
Thresholds: **system defaults** (`threshold_status=default_not_approved`) — not owner-approved marketing policy.

Related: `TRAFFIC_MANAGEMENT_AUDIT.md`, `TRAFFIC_OS.md`, `TRAFFIC_IDENTITY_REPORT.md`.

---

## What you can measure now

| Question | Where | Caveat |
|----------|-------|--------|
| Leads by traffic_type (paid / organic / messenger / unknown…) | `16` / `17` | Unknown separate; never redistributed |
| Channel leads / deals / attributed payments | `18_Channel_Management` | Filter by `management_status` |
| Landing leads / deals | `19_Landing_Management` | Global landing coverage ~48% → often `limited` |
| Campaign leads (no cost) | `20_Campaign_Management` | No CPL/ROAS |
| How much Sales revenue is attributed | `21_Traffic_Sales_Coverage` | Attributed ≠ total |
| Quality alerts | `22_Traffic_Alerts` | Ops actions only |

---

## What you must not claim

- “Best channel by revenue” without coverage warning (revenue linkage ~7.5%).
- That attributed revenue = company revenue.
- Organic includes WhatsApp/Telegram/email/offline (it does **not**).
- Ranking landings as proven winners when coverage < 50%.
- CPL / CAC / ROAS / forecasts (out of scope).

---

## Paid vs Organic

**organic_total** = `organic_social + organic_search + direct + referral` only.

Separate:

- messenger
- email
- offline
- partner
- unknown
- excluded

Grand Total = all types once (CRM leads must reconcile).

---

## How to read coverage & confidence

- **coverage** — share of rows with usable identity / Sales linkage.
- **confidence** — attribution quality class (`high|medium|low|unknown`), not P(sale).
- **management_status** — `usable|limited|low_sample|low_coverage|unknown|conflict`.
- Low sample / low coverage → do **not** treat as strong conclusion.

---

## Conversions (v1)

Cohort by `lead.created_at` (not payment calendar).

| Metric | Numerator | Denominator |
|--------|-----------|-------------|
| lead_to_deal_cr | leads with deal_id | leads |
| deal_to_invoice_cr | invoice_events | deals |
| invoice_to_payment_cr | payments | invoices |
| lead_to_payment_cr | payments | leads |

Empty denominator → empty cell (not 0%). Label as **attributed-only**.

---

## Revenue

- `attributed_paid_revenue` — linked payment amounts only.
- `total_sales_revenue` — Sales OS calendar `paid_at`.
- `unattributed_revenue` / `revenue_coverage_pct` — gap between them.

Never compare channels on revenue without showing linkage %.

---

## Sync

```bash
npm run sync:traffic-management:dry -- --periods=2026-05,2026-06,2026-07
npm run sync:traffic-management -- --periods=2026-05,2026-06,2026-07
npm run sync:traffic-management:validate
npm run sync:traffic-sales-coverage
```

API: `POST /api/sync/traffic-os` body `{ periods, modules, dryRun }` (admin/rop).

Modules: `all | management | foundation | traffic_management | … | export`.

Mother must **not** ingest `99_EXPORT` as canon yet (`traffic_export_v2`).

---

## When data can be trusted

- Classified paid / messenger / email / offline **lead volumes** — usable.
- Deal CR on classified cohorts with `management_status=usable` — cautious use.
- Revenue / payment rankings — **not** decision-grade until linkage rises.

## Recommended next sprint

**Traffic ↔ Sales Attribution Enrichment v1** (raise revenue/payment linkage) before Planning/Predictive.
