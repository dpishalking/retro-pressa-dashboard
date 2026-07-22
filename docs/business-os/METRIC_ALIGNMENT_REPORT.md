# Metric Alignment Report — Sales OS vs Legacy

Version: `sales_metric_alignment_v1`  
Investigation month: **2026-07**  
Source artifact: `data/metric-alignment/investigation-2026-07.json`  
Definitions: [`METRIC_DEFINITIONS.md`](./METRIC_DEFINITIONS.md)

## Summary (before alignment)

| Metric | Legacy | Sales OS | Δ |
|--------|--------|----------|---|
| Deals | 1179 | 1169 | −10 |
| Payments | 291 | 280 | −11 |
| Paid revenue | 22146.2 | 21193.2 | −953 |
| Pipeline (legacy open ≠ paid/lost) | 522 | 1006 (P) | +484 |
| Manager count | 20 (create/pay) | 30 (export daily) | +10 |

## Root causes

### 1. Deals (Δ −10)

**Cause:** Legacy `03_Orders` still contains **other-funnel** rows (`stage_id` like `C4:…`) preserved by Orders merge. Sales OS / SF staging only load **CATEGORY_ID = 0**.

**Only in Legacy (10):** all `C4:*` — out of sales funnel under locked defs.

| deal_id | created_at | closed_at | stage | manager | amount | reason |
|---------|------------|-----------|-------|---------|--------|--------|
| 89392 | 2026-07-09 | 2026-07-21 | C4:WON | 98840 | 47 | other funnel in Orders |
| 89554 | 2026-07-10 | 2026-07-21 | C4:WON | 98840 | 49 | other funnel in Orders |
| 89558 | 2026-07-10 | | C4:UC_MBO9X2 | 98840 | 4 | other funnel in Orders |
| 89644 | 2026-07-10 | | C4:WON | 98840 | 45 | other funnel in Orders |
| 89666 | 2026-07-10 | | C4:UC_36M8EU | 98840 | | other funnel in Orders |
| 89676 | 2026-07-10 | | C4:UC_B23IU3 | 98840 | | other funnel in Orders |
| 89758 | 2026-07-11 | | C4:WON | 98840 | 46 | other funnel in Orders |
| 89776 | 2026-07-11 | | C4:PREPARATION | 98840 | | other funnel in Orders |
| 89784 | 2026-07-11 | | C4:UC_MBO9X2 | 98840 | | other funnel in Orders |
| 90402 | 2026-07-14 | | C4:UC_MBO9X2 | 98840 | | other funnel in Orders |

**Only in Sales OS:** none.

**Fix (definition, not fudge):** filter metrics with `isSalesFunnelDeal` — do not count `C4:*` as Deals.

---

### 2. Payments / Paid revenue (Δ −11 / −953€)

**Intersection amount mismatches:** 0 (same OPPORTUNITY when deal present on both sides).

**Only in Legacy (11):**

| deal_id | created_at | closed_at | stage | manager | amount | reason |
|---------|------------|-----------|-------|---------|--------|--------|
| 19608 | 2025-05-29 | 2026-07-13 | WON | 3290 | 45 | closed in Jul, created before SF window |
| 40290 | 2025-09-24 | 2026-07-01 | WON | 29568 | 49 | closed in Jul, created before SF window |
| 43772 | 2025-10-16 | 2026-07-06 | WON | 3290 | 57 | closed in Jul, created before SF window |
| 60562 | 2026-01-13 | 2026-07-03 | WON | 29568 | 96 | closed in Jul, created before SF window |
| 74540 | 2026-03-30 | 2026-07-02 | WON | 79350 | 69 | closed in Jul, created before SF window |
| 77110 | 2026-04-17 | 2026-07-? | WON | | 395 | closed in Jul, created before SF window |
| 77190 | 2026-04-17 | 2026-07-? | WON | | 55 | closed in Jul, created before SF window |
| 89392 | 2026-07-09 | 2026-07-21 | C4:WON | 98840 | 47 | other funnel |
| 89554 | 2026-07-10 | 2026-07-21 | C4:WON | 98840 | 49 | other funnel |
| 89644 | 2026-07-10 | | C4:WON | 98840 | 45 | other funnel |
| 89758 | 2026-07-11 | | C4:WON | 98840 | 46 | other funnel |

- **7** category-0 WON closed in July but **created before** May–Jul staging create-window → missing from Sales OS payments until SF also pulls WON by `CLOSEDATE`.
- **4** other-funnel (`C4`) → excluded by funnel filter.
- Revenue of only-legacy payments = **953€** exactly (766 early + 187 C4).

**Fix:** `fetchDealsRaw` merges deals **created in period** + **WON closed in period**; recon/Sales_Daily apply funnel filter.

---

### 3. Pipeline (Δ +484 under old defs)

**Cause (two layers):**

1. **Definition mismatch:** Legacy counted Orders `payment_status ∉ {paid, lost}` (includes invoiced). Sales OS = `STAGE_SEMANTIC_ID = P` only.
2. **Source incompleteness:** Orders universe lacked open P deals not created/invoiced/paid in period → **490** pipeline IDs in SF `65` missing from Orders.

**Fix:** lock pipeline = semantic `P` + sales funnel; expand Orders Bitrix universe to include `STAGE_SEMANTIC_ID=P`.

---

### 4. Manager count (Δ +10)

**Cause:** Sales OS export daily rows include managers with **pipeline-only** activity on snapshot day. Locked def = managers with **deal create OR payment** in period.

**Only in export (pipeline-only):** `93414`, `99854`, `114`, `6066`, `37068`, `40300`, `61116`, `66240`, `71644`, `88172`.

**Create/pay activity both sides:** 20 = 20.

**Fix:** recon `manager_count` counts only create/pay; pipeline does not add managers.

---

## Alignment actions (code)

| Change | File(s) |
|--------|---------|
| Funnel helper | `src/lib/os-sheets/sales-metric-defs.ts` |
| SF deals: WON closed in period | `src/lib/bitrix/sales-foundation/deals.ts` |
| Sales_Daily funnel filter | `src/lib/os-sheets/sales-mapper.ts` |
| Orders universe + open P | `src/lib/bitrix/connector.ts` (`loadOsBitrixDealUniverse`) |
| Recon locked defs | `src/lib/os-sheets/sales-reconciliation.ts` |
| Dual-run metric status | `src/config/sales-dual-run.ts` |
| Locked definitions doc | `docs/business-os/METRIC_DEFINITIONS.md` |

**Not done:** delete Orders rows, hardcode exclusions, invent amounts.

## Validation (post-rebuild)

Checked after SF deals/pipeline refresh, Sales OS rebuild (Bitrix date-prefix day buckets), Orders May→June→July merge, dual-run ingest.

| Month | Metric | Legacy | Sales OS | Delta | Status |
|-------|--------|--------|----------|-------|--------|
| 2026-05 | Deals | 1908 | 1908 | 0 | matched |
| 2026-05 | Payments | 359 | 359 | 0 | matched |
| 2026-05 | Paid revenue | 30208.15 | 30208.15 | 0 | matched |
| 2026-05 | Pipeline (snapshot) | 0* | 0* | 0 | matched |
| 2026-05 | Managers | 13 | 13 | 0 | matched |
| 2026-06 | Deals | 1805 | 1805 | 0 | matched |
| 2026-06 | Payments | 416 | 416 | 0 | matched |
| 2026-06 | Paid revenue | 35490.4 | 35490.4 | 0 | matched / within_tolerance |
| 2026-06 | Pipeline (snapshot) | 0* | 0* | 0 | matched |
| 2026-06 | Managers | 15 | 15 | 0 | matched |
| 2026-07 | Deals | 1170 | 1170 | 0 | matched |
| 2026-07 | Payments | 287 | 287 | 0 | matched |
| 2026-07 | Paid revenue | 21959.2 | 21959.2 | 0 | matched |
| 2026-07 | Active deals | 1007 | 1007 | 0 | matched |
| 2026-07 | Pipeline amount | 32764.58 | 32764.58 | 0 | matched |
| 2026-07 | Managers | 21 | 21 | 0 | matched |

\* Pipeline on month grain is only filled for the **current snapshot day** (checked_at). Historical months show 0/0; July snapshot matched.

Day-level (last 7+ July days): Deals / Payments / Revenue / Managers — all **matched** after day-bucket alignment.

### Cutover readiness (blocking)

| Metric | Ready |
|--------|-------|
| Deals | Ready |
| Payments | Ready |
| Paid revenue | Ready |
| Manager count | Ready |
| Contract schema | Ready |
| Sync health | Ready |

Non-blocking pending: Leads, Invoice events. Pipeline matched on snapshot but non-blocking for 7-day cutover rule (snapshot metric).

## Cutover recommendation

**Sales OS may become the canonical sales metrics source for Deals / Payments / Paid revenue / Managers** under locked defs (`sales_metric_defs_v1`), with dual-run kept for observation.

Hard Cutover of production UI/routing is **still out of scope** for this sprint — recommend a separate Hard Cutover sprint after stakeholder sign-off on `METRIC_DEFINITIONS.md`.

