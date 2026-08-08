# Retro Pressa Analytics OS — Phase 1 Implementation Plan

**Date:** 2026-08-08  
**Goal:** Working CEO Control Center at `/analytics` on **existing data**, with honest metric statuses.  
**Not in Phase 1:** AI Analyst, Conversation Intelligence deep embed, predictive v2, anomaly detection, Gift Graph, Scale Simulator.  
**Prerequisite reading:** [analytics-os-audit.md](./analytics-os-audit.md) · [analytics-os-metrics.md](./analytics-os-metrics.md) · [analytics-os-data-map.md](./analytics-os-data-map.md)

**Do not start coding until decisions in §0 are answered.**

---

## 0. Decisions required before STEP 1

| # | Decision | Options | Default if silent |
|---|----------|---------|-------------------|
| D1 | Revenue KPI truth | Bitrix WON / Maria / dual+delta | **Dual+delta** (Bitrix primary, Maria secondary) |
| D2 | Evolve vs rewrite `/analytics` | Refactor `dashboard-ui.tsx` / new screen behind route | **New screen component**, keep route `/analytics`, migrate widgets incrementally |
| D3 | Marketing source until Mother cutover | Read Traffic OS export / keep `/ad-analytics` deep-link | **Traffic OS + link**, badge PARTIAL |
| D4 | Period model | Extend `PeriodKey` / use ISO months `YYYY-MM` | **ISO months in Analytics OS**, bridge legacy PeriodKey |
| D5 | Auth | admin+rop only | Keep `canAccessRoute` for `/analytics` as today |

---

## Phase 1 product shape (adjusted to real data)

| Block | Include? | Why |
|-------|----------|-----|
| Analytics Shell + Sidebar + Topbar | Yes | Required chrome |
| Global Filters (period, country, manager) | Yes | Orders/Sales support |
| KPI Cards + status chips | Yes | Core |
| Plan / Fact / Forecast | Yes | Finance + predictive partial |
| Revenue Tree | Yes | Orders/Payments |
| Sales Funnel | Yes | Stage history + leads/deals/payments |
| Managers | Yes | ManagerMetrics / payments |
| Product Analytics | Yes (primary SKU + rows count) | Partial attach |
| Country Analytics | Yes | Orders.country |
| Unit Economics | Yes with PARTIAL | AOV live; CPL/CAC/ROAS partial |
| Production Overview | Yes as **NO DATA / MANUAL** panel | Honesty > fake charts |
| Data Sources + Data Quality | Yes | Trust layer |
| Creatives / Ads deep dive | Link only | No Ads API |
| Conversations | Link to `/rop/conversations` | Already built |
| AI Why/What-if | Stub sand zone “coming” | Architecture only |

---

## STEP 1 — Metric contract + status types

| | |
|--|--|
| **Task** | Introduce shared Analytics OS metric value type and status enum; map existing company-snapshot / metrics-engine outputs into it. No UI yet. |
| **Files** | `src/types/analytics-os.ts` (new); optionally thin `src/lib/analytics-os/metric-status.ts` (new); read `src/lib/company-snapshot/**`, `src/lib/metrics-engine.ts` |
| **Data Source** | Existing typed metrics only |
| **Expected Output** | `AnalyticsMetricValue`, `MetricDataStatus`, catalog ids aligned with `analytics-os-metrics.md` |
| **Risk** | Duplicating formulas — mitigate by wrapping, not re-implementing |

---

## STEP 2 — Read facades (no new warehouse)

| | |
|--|--|
| **Task** | Create read-only loaders for Phase 1 panels: orders aggregate, payments, customers repeat, funnel counts, managers, countries, finance plan/fact, traffic partial. |
| **Files** | `src/lib/analytics-os/load-ceo-snapshot.ts` (new); reuse `src/lib/os-sheets/*`, `src/lib/sales-os/*`, `src/lib/traffic-os/*`, `src/lib/bitrix/snapshot-store.ts` as appropriate |
| **Data Source** | Mother Orders/Customers/Payments; Sales export or foundation; Finance daily; Traffic export or GA4 snapshots |
| **Expected Output** | One `CeoControlCenterSnapshot` JSON shape with `asOf` + per-metric status |
| **Risk** | Sheets quota / latency — cache with explicit `last_sync_at`; prefer already-synced snapshots where possible |

---

## STEP 3 — API route (auth-gated)

| | |
|--|--|
| **Task** | `GET /api/analytics/ceo-snapshot?period=YYYY-MM` returning Step 2 payload. |
| **Files** | `src/app/api/analytics/ceo-snapshot/route.ts` (new); check `src/middleware.ts`, `src/lib/auth/access.ts` — **not public** |
| **Data Source** | Facades from Step 2 |
| **Expected Output** | Authenticated JSON for admin/rop |
| **Risk** | Heavy sync inside GET — **forbid**; only read stored Sheets/snapshots; optional `?refresh=1` later admin-only |

---

## STEP 4 — Analytics Shell UI

| | |
|--|--|
| **Task** | Build desktop-first shell: navy topbar «RETRO PRESSA ANALYTICS OS / CEO Control Center», left sidebar (Overview + sections), 12-col content ~1440–1600px, global filters. |
| **Files** | `src/components/analytics-os/analytics-os-shell.tsx` (new); `analytics-os-sidebar.tsx`; `analytics-os-topbar.tsx`; `src/app/analytics/page.tsx` (wire new screen); CSS tokens in `src/app/globals.css` **only if missing** |
| **Data Source** | N/A (chrome) |
| **Expected Output** | Empty layout navigable; old dashboard accessible via feature flag or `/analytics/legacy` temporary if needed |
| **Risk** | Breaking current `/analytics` users — keep legacy route or toggle until parity |

**Sidebar Phase 1 links (enabled vs stub):**

- Overview — enabled  
- Growth → Revenue Tree — enabled; Marketing — partial; Creatives — stub  
- Sales → Funnel, Managers — enabled; Conversations — external link  
- Products → Product Analytics — enabled  
- Customers → Customers/Repeat — enabled; Cohorts/Gift — stub  
- Finance → Unit Economics — enabled; P&L — link/partial financial-report  
- Operations → Production — NO DATA panel  
- Markets → Countries — enabled  
- AI Analyst — stub sand cards  
- Management — Daily Brief stub  
- Data → Sources, Quality, Metrics — enabled  

---

## STEP 5 — KPI Row

| | |
|--|--|
| **Task** | Compact KPI cards: Revenue, Gross Profit (PARTIAL), Leads, Orders, AOV, CAC (PARTIAL), Repeat, Production Load (NO DATA), Overdue (pipeline PARTIAL), Cash (MANUAL/PARTIAL). Each with status chip. |
| **Files** | `src/components/analytics-os/kpi-row.tsx`; reuse `eur`/`number`/`pct` from `src/lib/format.ts` |
| **Data Source** | CEO snapshot API |
| **Expected Output** | First viewport management strip |
| **Risk** | Showing 0 for NO DATA — render em dash + status instead |

---

## STEP 6 — Plan / Fact / Forecast strip

| | |
|--|--|
| **Task** | Plan completion, MTD, run-rate, forecast from Finance + predictive fields when present. |
| **Files** | `src/components/analytics-os/plan-fact-forecast.tsx`; read finance columns / predictive export helpers |
| **Data Source** | Mother `07_Finance_Daily`; Sales prediction export if available |
| **Expected Output** | Traffic-light vs plan |
| **Risk** | Conflicting plans (Maria vs Settings) — label source |

---

## STEP 7 — Main grid: Revenue Tree + Funnel + Managers

| | |
|--|--|
| **Task** | Left: Revenue Tree (total → country → product → manager). Center: System Overview 12 areas with readiness dots. Right: Sales Funnel + Managers table. |
| **Files** | `revenue-tree.tsx`, `system-overview-grid.tsx`, `sales-funnel-panel.tsx`, `managers-panel.tsx`; charts via **Recharts** only |
| **Data Source** | Payments/Orders aggregates; leads/deals/invoices/payments; ManagerMetrics |
| **Expected Output** | Decision path: where money is / who closes / where funnel drops |
| **Risk** | Performance on large Sheets — aggregate server-side in facade |

---

## STEP 8 — Product + Country + Unit Economics

| | |
|--|--|
| **Task** | Product mix (primary SKU), avg product_rows_count, country revenue/CR, unit economics cards (AOV LIVE; CPL/CAC/ROAS PARTIAL). |
| **Files** | `product-analytics-panel.tsx`, `country-analytics-panel.tsx`, `unit-economics-panel.tsx` |
| **Data Source** | Orders/Payments; Foundation product_rows_count; ad_spend sheets; Customers repeat |
| **Expected Output** | Growth levers without claiming attach/COGS precision |
| **Risk** | Over-claiming Gross Profit — keep PARTIAL badge |

---

## STEP 9 — Owner Intelligence + Data Foundation zones

| | |
|--|--|
| **Task** | Bottom sand zone: 5 cards WHY / WHAT TO DO / WHAT IF / WHERE IS THE MONEY / WHAT BREAKS AT ×10 — **rule-based stubs** from signals (`signal-rules.ts`), not Gemini. Light-blue Data Foundation zone listing sources + sync freshness. |
| **Files** | `owner-intelligence-strip.tsx`, `data-foundation-strip.tsx`; reuse `buildSignals` |
| **Data Source** | Snapshot + signals |
| **Expected Output** | Management narrative without AI Phase 3 |
| **Risk** | Users confuse stubs with AI — label «правила / сигналы» |

---

## STEP 10 — Data Sources + Data Quality pages (sidebar)

| | |
|--|--|
| **Task** | Panels: connection matrix (Bitrix, GA4, СВОД, Maria, Product Hub, Ads API not connected); quality: missing country %, missing product %, missing UTM %, dual-revenue delta. |
| **Files** | `data-sources-panel.tsx`, `data-quality-panel.tsx`; optional read Foundation `69_Bitrix_Data_Quality` |
| **Data Source** | Sync metadata + fill-rates |
| **Expected Output** | Trust dashboard for owner |
| **Risk** | Stale quality tab — show `sync_updated_at` |

---

## STEP 11 — Wire office hub + access + smoke tests

| | |
|--|--|
| **Task** | Update hub card copy to Analytics OS; ensure middleware/access; add focused tests for facade aggregations (not full UI). |
| **Files** | `src/components/office-hub.tsx`; `src/lib/auth/access.ts` if needed; `src/tests/analytics-os-*.test.ts` |
| **Data Source** | Fixtures from existing os-orders / metrics tests |
| **Expected Output** | `npm test` green; manual login → `/analytics` |
| **Risk** | Scope creep into Twin/AI — reject in review |

---

## STEP 12 — Hardening & docs sync

| | |
|--|--|
| **Task** | Document status of Analytics OS in `docs/SYSTEMS.md` / `READINESS.md` as Partial; link from `00_START_HERE` optional; no new markdown unless asked beyond audit set. |
| **Files** | `docs/SYSTEMS.md`, `docs/READINESS.md` (small status rows) |
| **Data Source** | N/A |
| **Expected Output** | Governance alignment: Analytics OS = Executive UI adapter |
| **Risk** | Docs drift — keep one paragraph each |

---

## Explicit non-goals (guardrail)

- No Prisma/Postgres introduction in Phase 1  
- No Meta/Google Ads API project (track as Phase 2)  
- No rewriting Sales/Traffic sync  
- No Production OS invention  
- No Gemini Why-engine (optional later reuse `/api/analytics/ask` as link)  
- No duplicate Mother tabs  

---

## Suggested file touch list (Phase 1)

**New**

- `src/types/analytics-os.ts`
- `src/lib/analytics-os/**` (facade + status helpers)
- `src/app/api/analytics/ceo-snapshot/route.ts`
- `src/components/analytics-os/**`
- `src/tests/analytics-os-ceo-snapshot.test.ts`

**Modify**

- `src/app/analytics/page.tsx`
- `src/components/office-hub.tsx`
- `src/app/globals.css` (tokens only if needed)
- `src/lib/auth/access.ts` / `src/middleware.ts` (only if new API prefix rules needed)
- `docs/SYSTEMS.md`, `docs/READINESS.md` (status)

**Reuse as-is (do not recreate)**

- `metrics-engine.ts`, `signal-rules.ts`, company-snapshot  
- `orders-mapper` / Customers / Payments columns  
- Sales Foundation stage history  
- Recharts patterns from `dashboard-ui.tsx` / `ad-analytics-screen.tsx`  
- `/rop/conversations`, `/ad-analytics`, `/utm`, financial-report components  

---

## Definition of Done (Phase 1)

1. Logged-in admin/rop opens `/analytics` and sees CEO shell with KPI row.  
2. Every KPI shows a data-status chip; NO DATA never displays as `0` pretending live.  
3. Revenue / Orders / AOV / Leads / Managers / Countries work from real sync data.  
4. Funnel uses Bitrix-derived counts; stage timing available or explicitly partial.  
5. Production & Refunds panels explain gap, not fake charts.  
6. Data Sources panel lists Connected / Partial / Not connected.  
7. No new external SaaS; no public API; tests cover aggregations.  
8. Owner can answer same day: plan pace, where revenue is, which managers/countries/products, what data is missing.

---

## Effort sketch (planning only)

| Step | Relative effort |
|------|-----------------|
| 1–3 contracts + API | M |
| 4 shell | M |
| 5–8 panels | L |
| 9–10 trust/owner strips | S–M |
| 11–12 polish | S |

Total: roughly one focused engineering sprint after D1–D5, assuming Sheets sync already healthy for target months.

---

## Immediate next action after approval

1. Lock D1–D5 in chat or ADR.  
2. Implement STEP 1–3.  
3. Shell + KPI (STEP 4–5) for first clickable demo.  
4. Fill grid panels STEP 6–10.  
5. Stop and review data honesty before Phase 2 (Ads / order_items / COGS).
