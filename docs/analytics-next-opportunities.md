# Analytics OS — Next Opportunities Audit

**Date:** 2026-08-08 (after Sales Cycle, gift-type fallback, Product Hub COGS, cohort maturity)  
**Method:** Code + live Bitrix/Sheets capability check. Documentation overridden where stale.  
**Rule:** Prefer trustworthy financial decisions over decorative BI.

Related: [analytics-os-connections-audit-for-gpt.md](./analytics-os-connections-audit-for-gpt.md) · [analytics-sales-cycle.md](./analytics-sales-cycle.md) · [SPREADSHEETS.md](./SPREADSHEETS.md)

---

## 1. Executive Summary

Since the previous Analytics OS audit, the system gained real **Sales Cycle / Cohort Maturity**, **Product Hub COGS → gross margin**, and **gift-type SPA fallback** for empty product rows. CEO hub (`/os`) is no longer a stub shell: cash vs cohort, Lead→WON cycle, product economics (partial), and plan-from-Sheets are live.

The next constraint is **not “more dashboards”** — it is **using underused Bitrix fields already in CRM** (delivery price, open pipeline, stage/activity age) and **surfacing decision metrics** already half-built in the sales-cycle engine (Revenue/Lead, manager/country benchmarks, pricing vs list).

**Do not build next:** Production SLA dashboards, Creatives, lifetime LTV, contribution margin as “net profit”, Ads-driven ROAS as truth — data still misleading.

---

## 2. Current Analytics OS State

### ALREADY IMPLEMENTED (usable)

| Area | Surface |
|------|---------|
| CEO hub + 12 contours | `/os`, `/analytics` → `AnalyticsOsScreen` |
| Bitrix cash revenue (WON/CLOSEDATE) | `load-ceo-snapshot` + period JSON snaps |
| Plan/fact/forecast from CEO Plan sheet | `pullMonthlyPlanIndicators` |
| Funnel / managers / geography | Live contours |
| Sales Cycle + Cohorts | `/api/analytics/sales-cycle`, `/os/sales-cycle`, `/os/cohorts` |
| Cash month vs lead cohort | In sales-cycle payload |
| Product mix + COGS/gross (mapped) | Product Hub + gift-type fallback |
| Maria dual-truth delta | Month overlay |
| Conversations | Live module at `/rop/conversations` (not inlined in CEO metrics) |
| Ad spend PARTIAL | Sheets/СВОД → CPL/CAC/ROAS low confidence |

### PARTIALLY IMPLEMENTED

- Unit economics (COGS yes; shipping/fees/commissions no)
- Products (mix + margin; pricing vs list not in UI yet)
- Customers / repeat (period-level from paid deals; weak LTV windows)
- Marketing (spend Sheets only; no Ads API)
- Pipeline (only invoice deals still open `P`; weighted/overdue NO DATA)
- Created Lead CR (no unique-phone/email dedup)

### DATA EXISTS, UI DOES NOT

| Data | Where it lives | Missing scenario |
|------|----------------|------------------|
| `UF_CRM_1739981844877` «Доставка цена» | Bitrix live (Jan–Aug ~5–7% of cash) | Net product revenue, pricing after shipping |
| Open pipeline `STAGE_SEMANTIC_ID=P` | `loadOsBitrixDealUniverse` / Foundation pipeline tab | Pipeline age, stalled € |
| Stage history durations | Foundation `63_Bitrix_Stage_History` | Days in stage, stall |
| Activities | Foundation activities | Days since last touch |
| Unique lead dedup | `scripts/bitrix-leads-day.mjs` | Unique Lead CR in OS |
| List vs sold price | Product Hub retail + Bitrix line `PRICE` | Pricing analytics contour |
| Manager/country/source Revenue/Lead + cycle | Sales-cycle breakdowns | CEO compact + opportunity gaps |
| Lost deals among invoice set | Bitrix semantic `F` | Lost revenue (reason weak) |

### DATA MISSING (blocked without new source)

- Meta/Google Ads API (campaign spend truth)
- Production timestamps (paid→ship→deliver)
- Refunds / rework / NPS SSOT
- Payment fees / full OPEX order-level
- Traffic→Mother attributed revenue (cutover blocked)

---

## 3. Current Data Sources (reality)

| Source | Available to Analytics OS now | Notes |
|--------|-------------------------------|-------|
| Bitrix period snapshots | **Primary** | `data/bitrix-snapshots/*` May–Aug; leads, invoice deals, paidDeals, products, giftTypes |
| Product Hub Sheets | Live read | COGS + retail model |
| Monthly Plan sheet `16ocj…` | Live read | All plan indicators |
| СВОД / company-snapshot spend | PARTIAL | No Ads API |
| Maria truth | Overlay | Dual cash |
| Sales OS / Mother warehouses | Sheets only | Not CEO first hop |
| GA4 | Parallel `/ad-analytics` | Not CEO spine |
| Open Lines | ROP module | Not joined into CEO KPIs |
| Delivery price UF | **In Bitrix, not in snapshots** | Discovered; wire = small sync change |
| Foundation pipeline/stage/activities | Sheets | Underused by Analytics OS |

---

## 4. Data Capability Map

| Domain | Status | Comment |
|--------|--------|---------|
| Sales (cash, funnel, managers) | **READY** | Strong |
| Sales Cycle / Cohorts | **READY** (PARTIAL CR) | Engine live; unique leads still PARTIAL |
| Marketing | **PARTIAL** | Spend Sheets; payback weak |
| Product economics | **PARTIAL** | COGS + mix; net of delivery not yet |
| Pricing | **READY** (UI missing) | List vs sold already computable |
| Customer / Repeat | **PARTIAL** | Contact-based in period; long LTV thin |
| LTV 30/60/90 | **PARTIAL** | Need longer snap history + contact identity |
| Finance / P&L | **PARTIAL** | Cash + COGS; fees/refunds/OPEX incomplete |
| Conversations | **PARTIAL** | Rich ROP; not CEO join |
| Operations | **BLOCKED** | No production event spine |
| Quality | **BLOCKED** | No refunds/NPS SSOT |

---

## 5. Analytics Opportunity Matrix

Scores 0–5. Effort: 5 = hard.  
`Priority ≈ (Readiness × Decision × Confidence) / max(Effort,1)` — adjusted when unsafe.

| Analytics Contour | Data | Decision | Effort | Conf. | Priority | Status |
| ----------------- | ---: | -------: | -----: | ----: | -------: | ------ |
| Delivery-net revenue + AOV | 5 | 5 | 1 | 4 | **100** | BUILD NOW |
| Pricing: list vs sold | 5 | 5 | 2 | 4 | **50** | BUILD NOW |
| Manager benchmark (P80 vs median) | 5 | 5 | 2 | 4 | **50** | BUILD NOW |
| Revenue / Lead (CEO + cuts) | 4 | 5 | 2 | 3 | **30** | BUILD NOW |
| Pipeline age / stalled € | 4 | 5 | 2 | 4 | **40** | BUILD NOW* |
| Unique Lead CR | 4 | 5 | 2 | 4 | **40** | BUILD NOW |
| Country monetization gaps | 4 | 4 | 2 | 3 | **24** | BUILD PARTIAL |
| Opportunity Engine (CR gaps €) | 4 | 5 | 3 | 3 | **20** | BUILD PARTIAL |
| Sales Cycle polish / trust | 4 | 4 | 2 | 4 | **32** | BUILD PARTIAL |
| Forecast = cash+pipeline+maturity | 3 | 5 | 3 | 3 | **15** | BUILD PARTIAL |
| Cross-sell / attach | 3 | 3 | 3 | 2 | **6** | BUILD PARTIAL |
| Marketing payback D7/D30 | 2 | 5 | 4 | 2 | **5** | INSTRUMENT FIRST |
| Repeat 30/60/90 | 3 | 4 | 3 | 2 | **8** | BUILD PARTIAL |
| Conversation→payment join in CEO | 3 | 4 | 4 | 3 | **9** | BUILD PARTIAL |
| Lost revenue + reasons | 2 | 4 | 3 | 2 | **5** | INSTRUMENT FIRST |
| Contribution / full P&L | 2 | 5 | 4 | 1 | **2.5** | BLOCKED† |
| Ops / production load | 1 | 4 | 5 | 1 | **0.8** | BLOCKED |
| Creatives / Ads creative | 1 | 3 | 5 | 1 | **0.6** | BLOCKED |
| Lifetime LTV | 2 | 4 | 4 | 1 | **2** | BLOCKED† |

\* Needs open-pipeline pull into Analytics snap (field exists in Bitrix; code path `loadOsBitrixDealUniverse` already).  
† Unsafe if presented as truth without fees/refunds/longer history.

---

## 6. Top 5 Build Now

### 1) Delivery-net cash & product AOV
- **What:** Sync `UF_CRM_1739981844877`; show cash, delivery €, **product revenue**, delivery % of cash (already measured Jan–Aug ~4–7%).
- **Source:** Bitrix deal UF (live today).
- **Decision:** True product pricing / margin; stop treating shipping as product revenue.
- **Effort:** XS (selectDeal + snapshot field + KPI).
- **Limit:** ~10–17% deals empty field → treat as 0 with coverage %.

### 2) Pricing: витрина vs факт продажи
- **What:** Product Hub `retail_model` vs Bitrix line `PRICE` (and opp−delivery).
- **Source:** Already computed ad-hoc Aug; Hub + snaps.
- **Decision:** Where we under/over-price; regional/up-sell patterns.
- **Effort:** S (products contour columns + alerts).
- **Limit:** Multi-SKU deals; gift-type fallback uses opportunity.

### 3) Manager benchmark (top 20% vs team)
- **What:** CR, AOV, Revenue/Lead, median Lead→WON, products/order — P80 vs median.
- **Source:** Sales-cycle breakdowns + CEO managers.
- **Decision:** Coaching / staffing / who sets the bar.
- **Effort:** S.
- **Limit:** Small samples for some managers.

### 4) Unique Lead CR into Sales Cycle
- **What:** Reuse `bitrix-leads-day` phone/email history rules → Unique Leads denominator.
- **Source:** Bitrix leads + contact fields / foundation hashes.
- **Decision:** Honest conversion; stop messenger-dupe inflation.
- **Effort:** S–M.
- **Limit:** Need contact phones on leads (foundation stronger than period snap).

### 5) Pipeline age + “money stuck”
- **What:** Open `P` deals by age buckets; € inactive >7d (stage or last activity).
- **Source:** Bitrix open pipeline (+ foundation stage/activities if available).
- **Decision:** Daily ROP focus list; leading indicator before cash dips.
- **Effort:** S–M (extend analytics snapshot beyond invoice+paid).
- **Limit:** Activity quality varies by manager.

---

## 7. Available But Not Calculated (in UI)

| Metric | Data ready? |
|--------|-------------|
| Delivery € / % of cash by month | Yes (Bitrix UF; not in snap) |
| Product revenue = cash − delivery | Yes after wire |
| List price vs sold (avg/median/Δ%) | Yes |
| Revenue / Lead D7/D14/D30 by manager/country/source | Yes in sales-cycle engine |
| Manager P80 vs median | Yes from breakdowns |
| Open pipeline € by age 0–1…30+ | Almost (need open-P in OS snap) |
| Unique leads / day / month | Script exists; not OS |
| Cash vs cohort (CEO band always) | API yes; hub card partial |
| Multi-product attach rate by pair | Weak taxonomy / sample |

---

## 8. Underused Data Assets

| Asset | Suggested use |
|-------|----------------|
| Gift-type SPA + product rows | Pricing + mix + COGS (done partial) |
| Deal line `PRICE` variance | Pricing analytics |
| Delivery UF | Net product economics |
| Foundation stage history | Stall / velocity |
| Foundation activities | Days since last touch |
| Foundation pipeline weighted/overdue | Risked pipeline |
| `bitrix-leads-day` dedup | Unique Lead CR |
| Open Lines ↔ deal links | Conversation outcome × payment (CEO) |
| Sales-cycle matrix lead×pay month | Already built — promote to CEO |
| UTM on leads | Source Revenue/Lead (partial today) |

---

## 9. Unsafe Metrics

| Metric | Why unsafe | To make trustworthy |
|--------|------------|---------------------|
| Contribution margin | No shipping/fees/commissions in formula | Wire delivery + fee model |
| CAC / ROAS | Spend from Sheets, not Ads API; lead≠unique | Ads API + unique leads |
| Lifetime LTV | Short snap history | Multi-year paid + stable customer_key |
| Production load / SLA | No real timestamps | Ops event log |
| Marketing payback D30 | Weak spend↔cohort join | Ads API + cohort spend allocation |
| Lost revenue € | Lost reason poorly filled | Mandatory lost-reason enum |

---

## 10. Data Gaps

1. Delivery UF not in Analytics snapshots.  
2. Open pipeline not in period Analytics snapshot (only invoice∩P).  
3. Unique lead identity not in CEO/sales-cycle.  
4. Ads platform spend.  
5. Refunds / payment fees.  
6. Production/delivery event timestamps.  
7. Traffic attributed revenue blocked from Mother.

---

## 11. Instrumentation Priorities (max leverage)

1. **Add `UF_CRM_1739981844877` to `selectDeal` + snapshot** — unlocks net product cash/pricing.  
2. **Persist open pipeline (`P`) into Analytics snapshot** (or read foundation pipeline) — unlocks stall/leading indicator.  
3. **Unique-lead keys on snap or from foundation contacts** — unlocks honest CR.  
4. **Last activity / stage entered_at on open deals** — unlocks stalled €.  
5. **Ads API spend daily by campaign** — unlocks payback (larger project).

---

## 12. Recommended Next Sprint

### NEXT #1 — Delivery-net revenue + Pricing (list vs sold)
**Why:** Immediately improves every product/AOV/margin decision; field already in Bitrix; Aug showed avg sold ≫ list partly due to shipping/upsell mix.  
**Data:** Deal UF delivery + Product Hub retail + line PRICE.  
**Files:** `connector.ts`, `snapshot-store.ts`, `sku-margin-catalog.ts` / products panel, `load-ceo-snapshot.ts`.  
**CEO gets:** “Product cash”, delivery %, sold vs list by SKU/gift type.  
**Infra:** Minimal sync field + UI columns.

### NEXT #2 — Manager benchmark + Revenue/Lead
**Why:** Sales-cycle already computes cuts; CEO still manages on cash/CR period.  
**Data:** Existing sales-cycle API.  
**Files:** `sales-cycle-panel.tsx`, CEO card, managers contour.  
**CEO gets:** Who is slow vs weak; €/lead by manager.  
**Infra:** UI + small aggregation polish.

### NEXT #3 — Unique Lead CR
**Why:** Messenger dupes inflate leads; Created Lead CR PARTIAL.  
**Data:** `bitrix-leads-day.mjs` rules + Bitrix phones.  
**Files:** sales-cycle aggregate + optional foundation contacts.  
**CEO gets:** Unique CR D7/D30.  
**Infra:** Port dedup into lib; no new CRM.

### NEXT #4 — Pipeline age / money stuck
**Why:** Leading indicator before cash drop; open deals already fetchable.  
**Data:** Bitrix `P` + stage/activity.  
**Files:** `connector` analytics snap path; new pipeline panel.  
**CEO gets:** € open, € >7d idle.  
**Infra:** Extend snapshot, not new warehouse.

### NEXT #5 — Opportunity gaps (country/manager)
**Why:** Turns maturity/CR into € actions.  
**Data:** Sales-cycle benchmarks + lead volume × AOV.  
**Files:** opportunity rules + CEO owner panel.  
**CEO gets:** “Germany −2.3pp × volume × AOV ≈ €X”.  
**Infra:** Rules engine light; sample thresholds required.

---

## Target model checklist (24 contours)

| # | Contour | Status |
|---|---------|--------|
| 1 | Cash / P&L | PARTIAL (cash yes; P&L thin) |
| 2 | Revenue | IMPLEMENTED |
| 3 | Sales Funnel | IMPLEMENTED |
| 4 | Sales Cycle | IMPLEMENTED (partial trust) |
| 5 | Cohorts | IMPLEMENTED (partial) |
| 6 | Marketing | PARTIAL |
| 7 | Marketing Payback | BLOCKED / INSTRUMENT |
| 8 | Product Economics | PARTIAL → READY TO BUILD net-of-delivery |
| 9 | Pricing | READY TO BUILD |
| 10 | Cross-sell | PARTIAL |
| 11 | Customer | PARTIAL |
| 12 | Repeat | PARTIAL |
| 13 | LTV | BLOCKED (honest 30d only PARTIAL) |
| 14 | Managers | IMPLEMENTED → READY benchmark |
| 15 | Conversations | IMPLEMENTED (external) |
| 16 | Lost Revenue | PARTIAL / unsafe |
| 17 | Countries | IMPLEMENTED → READY gaps |
| 18 | Operations | BLOCKED |
| 19 | Capacity | BLOCKED |
| 20 | Quality | BLOCKED |
| 21 | Forecast | PARTIAL |
| 22 | Opportunity Engine | READY TO BUILD (light) |
| 23 | Decision Log | BLOCKED (process) |
| 24 | Scale Model | PARTIAL (digital-twin separate) |

---

## What can we build tomorrow without new data?

1. **Pricing table** list vs sold (from current snaps + Product Hub).  
2. **Manager / country Revenue/Lead + cycle** cards from sales-cycle API.  
3. **Cash vs cohort** always on CEO band (already API).  
4. **Promote maturity forecast** when ≥5 mature cohorts (logic exists).  
5. **Delivery % report** via one-off Bitrix query (or same-day sync field).  
6. **Open pipeline age** via existing `loadOsBitrixDealUniverse` without Ads/Production.

---

## What single new data source unlocks the most value?

**Not a new vendor — wire Bitrix fields we already pay for:**

1. **Delivery price UF** + **full open pipeline (+ last activity)** into Analytics snapshots.

If forced to pick one *external* system after that: **Ads API (Meta/Google)** — only then CAC/ROAS/payback become decision-grade. Production events are #2 external if ops control is the goal.

---

## What should we not build yet?

- Creatives analytics (no creative↔lead join / Ads API)  
- Production / capacity dashboards (no timestamps)  
- Lifetime LTV / full contribution margin as “truth”  
- Marketing payback presented as high-confidence  
- Fake lost-revenue without lost-reason quality  
- New AI Opportunity theater before € gaps are rule-based and sample-gated  

---

## Collecting but underused / possibly redundant

| Collected | Issue |
|-----------|-------|
| Foundation stage history, activities, pipeline | Synced to Sheets; Analytics OS barely reads |
| Traffic OS export | Mother cutover blocked; dual thin traffic |
| CEO “Open Lines connected” badge | No metrics attached |
| Invoice-stage history peek | Only for invoice date; durations discarded |
| Digital-twin / scale | Parallel admin surface; not OS spine |

Do not delete; **reuse before collecting more**.

---

*End of audit. No implementation started — await owner priority choice.*
