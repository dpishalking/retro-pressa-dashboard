# Traffic Management Layer — Audit

**Date:** 2026-07-22  
**Workbook:** `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg`  
**Scope:** Management Layer v1 on existing Traffic OS (Foundation + Identity intact)

---

## 1. What is already ready

| Layer | Status | Location |
|-------|--------|----------|
| Workbook 00–15 + 99_EXPORT | Ready | `src/config/traffic-os.ts` |
| Identity taxonomy | Ready | `src/lib/traffic-os/taxonomy.ts` |
| Attribution Lead→Deal→Invoice→Payment | Ready | `buildTrafficOsModel` in `build-model.ts` |
| Landing / Channel / Campaign / Daily / Monthly facts | Ready | same |
| Data Quality + Reconciliation | Ready (will extend) | same |
| CLI sync + dry-run | Ready | `npm run sync:traffic-os(:dry)` |
| Safe write | Ready | `src/lib/os-sheets/safe-write.ts` |
| In-process mutex | Ready | `syncTrafficOs` lock |
| Export contract v1 | Ready | `export-contract.ts` — Mother **not** ingesting |
| Unit tests (identity) | Ready | `src/tests/traffic-os.test.ts` |

**Not ready / missing for Management:**

- Sheets 16–22 (management views)
- Threshold config (`traffic-management.ts`)
- `traffic_export_v2`
- HTTP `POST /api/sync/traffic-os`
- Module filter in sync
- Management alerts
- Sales coverage sheet with unattributed revenue explicit

---

## 2. Metrics: usable vs limited

### Usable (with confidence)

- Leads by `traffic_type` / channel (classified only)
- Deal counts from lead-cohort join (`lead.created_at` period)
- Messenger / email / offline / paid Meta-Google (verified or derived)
- Attribution status mix (`fully_attributed`, `source_only`, …)
- Unknown share (honest residual)

### Limited

- Landing analysis (~48% coverage) → `management_status=limited`
- Attributed revenue (~7.5% lead linkage) → never label as total channel revenue
- Language / country path-or-enum derived only
- Campaign without spend (no CPL/ROAS)

### Not for Management v1

- CPL, CAC, ROAS, ROMI, forecasts, plan, AI recommendations, Mother cutover, GA4 visits

---

## 3. Sheets to add / change

| Sheet | Action |
|-------|--------|
| `16_Traffic_Management` | **ADD** management summary |
| `17_Traffic_Type_Fact` | **ADD** date × traffic_type |
| `18_Channel_Management` | **ADD** day/week/month × channel |
| `19_Landing_Management` | **ADD** day/week/month × landing |
| `20_Campaign_Management` | **ADD** day/week/month × campaign |
| `21_Traffic_Sales_Coverage` | **ADD** Traffic vs Sales coverage |
| `22_Traffic_Alerts` | **ADD** quality alerts |
| `14_Data_Quality` | **EXTEND** management coverage metrics |
| `15_Reconciliation` | **EXTEND** difference_reason style checks |
| `99_EXPORT` | **UPGRADE** to `traffic_export_v2` (new columns; Mother not switched) |
| `00–13` | unchanged role (facts remain sources) |

---

## 4. Definitions (locked for v1)

| Concept | Rule |
|---------|------|
| Date grain (facts/management) | Cohort by `lead.created_at` → `YYYY-MM-DD` |
| Sales calendar metrics | Deals by `deal.created_at`; invoices by `invoice_at`; payments by `paid_at` |
| Linkage | `lead_id → deal.lead_id → invoice/payment.deal_id` |
| Primary deal | First deal by `created_at` |
| `paid_revenue` / attributed | Sum of linked payment amounts only |
| organic_total | `organic_social + organic_search + direct + referral` only |
| Messenger / email / offline / partner | **Not** in organic_total |
| Unknown | Separate; never redistribute |
| Empty CR | Denominator 0 → empty string (not `0%`) |
| Confidence | Classification of attribution quality, not sale probability |

---

## 5. Risks

1. Revenue linkage ~7.5% — channel revenue rankings are **not** decision-grade.
2. Landing coverage ~47.7% — landing “winners” are limited.
3. Unknown ~14.5% — bare WEB + `instagram\|social`.
4. Different event grains vs Sales OS cause expected deltas.
5. Orphan deals/payments without lead_id.
6. Partial workbook write (not atomic across 17+ tabs).
7. No spend canon → no spend governance.
8. No GA4 visits → no visit→lead CR.

---

## 6. Implementation plan

1. `src/config/traffic-management.ts` — thresholds + sheet columns (defaults marked `default_not_approved`).
2. `src/lib/traffic-os/management.ts` — builders for 16–22 + export v2 + alerts.
3. Extend `build-model.ts` / `sync.ts` — wire matrices, modules, write order.
4. `POST /api/sync/traffic-os` + npm scripts.
5. Tests (fixtures, no live Sheets).
6. Docs + dry-run + production sync for 2026-05…07.

**Builders to keep:** `buildTrafficOsModel`, `resolveLeadIdentity`, `attributionQuality`, `safeReplaceSheet`.
