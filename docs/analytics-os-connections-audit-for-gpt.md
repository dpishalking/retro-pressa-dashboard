# Retro Pressa — Deep System Connections & Sources-of-Truth Audit

**Purpose of this file:** self-contained brief for an external reviewer (e.g. GPT).  
**Ask the reviewer:** Is every critical metric wired to the correct source of truth? Where are dual-truth conflicts, missing joins, or unsafe calculations? What should be fixed first?

**As-of date:** 2026-08-08  
**Product:** Retro Pressa Business OS + Analytics OS (CEO Control Center)  
**Live app:** `https://rp-bi.site` · Analytics hub `https://rp-bi.site/os`  
**Stack:** Next.js 15 App Router + TypeScript · **no SQL/Prisma** · Google Sheets + Bitrix REST + JSON snapshots under `data/**`

---

## 0. How to review this (instructions for GPT)

Please return feedback in this structure:

1. **Verdict** — overall architecture soundness (1–10) and top 5 risks.
2. **Source-of-truth map** — for each metric below, say: *correct / wrong / ambiguous / unsafe*.
3. **Connection graph gaps** — missing joins, blocked cutovers, dual canons.
4. **Analytics OS honesty** — where UI may overstate confidence.
5. **Priority fix list** — P0 / P1 / P2 with rationale.
6. **Questions for the owner** — only if a decision is required.

Do **not** invent APIs or warehouses that are not listed. Prefer “NO DATA / PARTIAL” over fake precision.

---

## 1. One-sentence architecture

Retro Pressa is a **Business OS**: Bitrix and Google Sheets are operational warehouses; the Next.js app syncs, snapshots, and presents an **executive Analytics OS** that must **read contracts**, not invent a second CRM.

Locked principles (from project ADRs / practice):

- **Order v1 = Bitrix Deal** (`order_id = deal.ID`).
- **Primary paid revenue for Analytics OS = Bitrix WON** (`CLOSEDATE` in period + `STAGE_SEMANTIC_ID=S`).
- **Maria** = operational/manual paid truth shown separately (dual + delta).
- **Traffic → Mother cutover is BLOCKED** — do not treat Traffic `99_EXPORT` as Mother canon.
- **No Ads API** (Meta/Google Ads) — spend comes from Sheets (СВОД / company snapshot).
- **Metric statuses must be honest:** `live | calculated | manual | demo | no_data`.

---

## 2. System map (layers)

```text
┌─────────────────────────────────────────────────────────────────┐
│  UI / Executive                                                 │
│  /os  Analytics OS (CEO hub + /os/[contour])                    │
│  /analytics  same hub · /analytics/legacy  old dashboard        │
│  /ad-analytics  GA4 + Sheets · /rop/**  sales ops + dialogs     │
│  /digital-twin  scenarios (admin) · /utm  public UTM tool       │
└────────────────────────────▲────────────────────────────────────┘
                             │ read facades / snapshots / Sheets
┌────────────────────────────┴────────────────────────────────────┐
│  Sync / API layer (Next.js route handlers, cron via x-cron-secret)│
│  Bitrix sync · GA4 sync · OS daily · Sales/Traffic OS sync        │
└──────────────▲──────────────────────────────▲───────────────────┘
               │                              │
     ┌─────────┴─────────┐          ┌─────────┴──────────┐
     │ Bitrix24 CRM      │          │ Google Sheets OS   │
     │ (event SSOT)      │          │ Mother / Sales /   │
     └───────────────────┘          │ Traffic / Plan /   │
                                    │ Product Hub / Maria│
                                    └────────────────────┘
               │
     ┌─────────┴─────────┐
     │ Local JSON SSOT   │
     │ data/bitrix-snapshots, ga4-snapshots, company-snapshots,
     │ conversation-*, auth/users.json, .cache/
     └───────────────────┘
```

---

## 3. Spreadsheet & system registry (IDs)

| System | Spreadsheet ID | Env | Role | Sync / read path |
|--------|----------------|-----|------|------------------|
| **Mother Business OS** | `1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8` | `MOTHER_OS_SPREADSHEET_ID` / `GOOGLE_OS_SHEET_ID` | Company registries, orders, foundation 60–69, recon | `sync:os-*`, `/api/sync/os-daily` |
| **Sales OS (child)** | `1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY` | `SALES_OS_SPREADSHEET_ID` | CRM warehouse + facts + `99_EXPORT` | `sync:sales-os` |
| **Traffic OS (child)** | `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg` | `TRAFFIC_OS_SPREADSHEET_ID` | Traffic warehouse; Mother cutover **blocked** | `sync:traffic-os` |
| **Monthly CEO Plan/Fact** | `16ocjHOlOjnJacYhlLxhdF-so5FclgIijImC_vsMlsLM` tab `План/факт` gid `2079098693` | `MONTHLY_PLAN_SPREADSHEET_ID` | **Primary monthly plan** for Analytics OS | Live read via Sheets API |
| **СВОД (marketing traffic)** | `1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M` | `GOOGLE_TRAFFIC_SHEET_ID` / `SVOD_PLAN_SPREADSHEET_ID` | Daily paid/organic leads (`day`, `Органика`); legacy plan copy | Traffic OS + daily leads |
| **Maria truth** | `1nNC48IfiUgO86YGvyLH05o6DrBq3jKKprChT09HN2Mc` | `MARIA_TRUTH_SPREADSHEET_ID` | Manual operational paid truth | Sales / predictive / Analytics recon |
| **Predictive Sales front** | `1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820` | `PREDICTIVE_SALES_SPREADSHEET_ID` | ROP Plan/Fact/PTF UI in Sheets | Predictive sync |
| **Product Hub (passports / COGS)** | `1NsVbsv2YZbehiYTtSP1Waf0gYf1nCnocszonQyppKAE` | `BITRIX_GIFT_TYPES_SHEET_ID` | `00_INDEX` + `SKU_MAP` COGS for margin | Live read in Analytics OS |
| **Dialogs workbook** | `1mQEcDnybKM6HLfJbOkgdNu3hMo3_3kxLbmRp_6DcQmo` | `GOOGLE_DIALOGS_SHEET_ID` | Full chat bodies (not in Mother) | ROP conversation sync |
| **Bitrix CRM** | webhook URL | `BITRIX_WEBHOOK_URL` | Leads, deals, products, stage history | `/api/sync/bitrix`, foundation sync |
| **GA4** | property id | `GA4_PROPERTY_ID` | Site analytics | `/api/sync/ga4` → `data/ga4-snapshots` |
| **Clarity** | token | `CLARITY_API_TOKEN` | UX heatmaps (optional) | `/api/sync/clarity` |
| **Gemini** | API key | `GEMINI_API_KEY` | Ask / conversation analysis | API routes |

Auth users: `data/auth/users.json` (roles `admin | rop | mop | partner`). Deploy: GitHub Actions → Timeweb; shared server data under `/opt/retro-pressa-shared/data`.

---

## 4. Source-of-truth matrix (what should win)

| Metric / decision | Declared primary SSOT | Secondary / overlay | What Analytics OS `/os` actually uses today | Risk |
|-------------------|----------------------|---------------------|---------------------------------------------|------|
| **Paid revenue (CEO)** | Bitrix WON deals (`CLOSEDATE` + semantic S) | Maria month total | Bitrix snapshot `paidDeals` sum `opportunity` | Dual-truth vs Maria; show delta |
| **Invoices count/amount** | Bitrix invoice date field + stage history | — | Bitrix snapshot invoice deals | Definition complexity |
| **Leads** | Bitrix `DATE_CREATE` in period | СВОД day CRM leads | Bitrix snapshot leads | Messenger duplicates inflate “created” |
| **Lead uniqueness** | Phone/email history rules (ops script) | — | **Not in Analytics OS KPI** | Ops uses `bitrix-leads-day.mjs` separately |
| **Monthly plan (all indicators)** | CEO Plan/Fact sheet `16ocj…` | Old СВОД plan tab (legacy) | `pullMonthlyPlanIndicators` → `16ocj…` | Env mispoint to old book |
| **Ad spend** | СВОД / company-snapshot Sheets | — | `company-snapshot.canonical.adSpend` | No Ads API; PARTIAL |
| **CPL / ROAS** | Spend Sheets + leads/revenue Bitrix | Traffic OS management | Calculated in facade; confidence **low** | Spend/lead join imperfect |
| **Product mix** | Bitrix deal product rows | Mother primary SKU only | Bitrix `products[]` on paid deals | ~30% August deals empty products |
| **COGS / gross margin** | Product Hub `SKU_MAP` + `00_INDEX` | Passport ranges | Live join Bitrix productId → COGS | Margin only on mapped deals |
| **AOV** | Paid revenue / paid orders | — | Bitrix calculated | OK if revenue definition stable |
| **Managers** | Bitrix `ASSIGNED_BY_ID` | — | Aggregated from snapshot | Response time mostly NO DATA |
| **Countries** | Deal country UF / lead country UF | — | Snapshot country fields | Lead vs deal country mismatch |
| **Customers / repeat** | `customer_key` from contact hashes | Mother `21_Customers_Core` | Computed from Bitrix paid deals in period | Not full LTV warehouse |
| **Conversations** | Open Lines + dialog workbook | — | Link out to `/rop/conversations` | Separate stack |
| **Production SLA** | Product Hub norms (static) | — | **NO DATA** live timestamps | Contour stub |
| **Cash / runway** | Finance sheets | — | **NO DATA** in Analytics OS | Finance OS incomplete |
| **Traffic attributed revenue** | Traffic OS attribution | — | Often NO DATA / partial in CEO recon | Mother cutover blocked |
| **Creatives / Ads** | — | — | Contour **stub** | No Ads API |
| **Cohorts / LTV 365** | — | — | Contour **stub** | Needs customer history warehouse |

---

## 5. Data flows (connections)

### 5.1 Sales / CRM path

```text
Bitrix CRM
  → REST (BITRIX_WEBHOOK_URL)
  → data/bitrix-snapshots/{period}.json     ← Analytics OS primary read for CEO KPIs
  → Sales Foundation (Mother tabs 60–69)
  → Sales OS warehouse
  → 99_EXPORT (sales_export_v1)
  → Mother ingest (32_Sales_OS_Daily + recon)
```

**Analytics OS shortcut:** `/api/analytics/ceo-snapshot` reads **Bitrix JSON snapshots** (+ Sheets for plan/COGS/spend), **not** Mother Orders as the first hop.  
That means CEO numbers can diverge from Mother company monthly until both are reconciled.

### 5.2 Plan path

```text
Google Sheet 16ocj… / План/факт
  → pullMonthlyPlanIndicators(YYYY-MM)
  → Analytics OS plan block + 100+ indicator rows
  → also feeds predictive / marketing plan registry helpers
```

August 2026 example (ОБЩИЕ): revenue plan ≈ **€46,676**, leads **3,334**, sales **667**, AOV **€70**, budget **€4,500**.

### 5.3 Margin path (new)

```text
Product Hub 1NsV… 
  00_INDEX (gid 1186454014) — PRODUCT_ID + COGS
  SKU_MAP — bitrix_product_id → cogs_eur
        ↓
Bitrix paidDeals[].products[] (productId, qty)
        ↓
gross = mappedRevenue − Σ(cogs × qty)
margin = gross / mappedRevenue
```

**Honesty rule implemented:** margin is computed **only on deals with mapped product lines**.  
Deals without product rows contribute to total revenue but **not** to margin denominator.

August 2026 snapshot check (local): total revenue ≈ €10.7k; mapped revenue ≈ €8.2k (72/106 deals); COGS ≈ €1.7k; gross ≈ €6.5k; margin ≈ **80%**; line coverage among present product lines ≈ 100%.

### 5.4 Traffic path

```text
СВОД day/Органика + GA4 + Sales CRM joins
  → Traffic OS warehouse + management
  → 99_EXPORT traffic_export_v3
  → Mother   ✗ BLOCKED (do not treat as canon)
```

Parallel UI: `/ad-analytics` uses GA4 snapshots + Sheets — do not confuse with Traffic OS tabs 26–36.

### 5.5 Deploy / snapshot locality

```text
git push main → GitHub Actions → Timeweb
  app code at /opt/retro-pressa
  shared data symlink → /opt/retro-pressa-shared/data
  post-deploy: Bitrix sync for current calendar month (cron secret)
```

Snapshots are **server-local**, not in git. Local laptop snapshots ≠ production until sync runs on the server.

---

## 6. Analytics OS surface (what the owner clicks)

**Hub:** `/os` (also `/analytics`) — mockup-inspired CEO Control Center.

**12 contours** (`/os/[contour]`):

| # | Contour | Route | Data status |
|---|---------|-------|-------------|
| 1 | Revenue tree | `/os/revenue` | LIVE (Bitrix) |
| 2 | Unit economics | `/os/unit-economics` | PARTIAL (COGS live; shipping/fees missing) |
| 3 | Products | `/os/products` | PARTIAL (mix + COGS when lines exist) |
| 4 | Cohorts / LTV | `/os/cohorts` | STUB |
| 5 | Customers | `/os/customers` | PARTIAL |
| 6 | Marketing | `/os/marketing` | PARTIAL (no Ads API) |
| 7 | Creatives | `/os/creatives` | STUB |
| 8 | Funnel | `/os/funnel` | LIVE/PARTIAL |
| 9 | Managers | `/os/managers` | LIVE |
| 10 | Conversations | `/rop/conversations` | LIVE (external module) |
| 11 | Geography | `/os/geography` | LIVE |
| 12 | Production | `/os/production` | STUB / NO DATA |

Extra: `/os/plan` (full plan indicators), `/os/sources` (source cards + quality).

Facade: `GET /api/analytics/ceo-snapshot?period=YYYY-MM` (session auth; not public).  
Loader: `src/lib/analytics-os/load-ceo-snapshot.ts`.

---

## 7. Period model

- Analytics OS periods: ISO `YYYY-MM`.
- Legacy PeriodKey bridge: `may-2026 | june-2026 | july-2026 | august-2026`.
- Bitrix snapshot files: `data/bitrix-snapshots/{periodKey}.json`.
- Default period: current calendar month if snapshot/list allows; else latest available.

---

## 8. Dual-truth & conflict checklist (reviewer focus)

1. **Bitrix WON vs Maria paid** — both shown; delta card exists. Which number does the CEO use for bonuses/plan?
2. **Bitrix snapshot vs Mother `03_Orders` / company monthly** — Analytics OS prefers Bitrix snapshot; Mother may lag or use different invoice rules.
3. **Plan book `16ocj…` vs СВОД plan tab `1nItFm…`** — code now prefers `16ocj…`; old book still used for daily leads. Confirm no process still edits the wrong plan column.
4. **Revenue total vs margin mapped subset** — UI must not imply 80% margin applies to 100% of revenue when ~30% deals lack products.
5. **Lead counts** — CRM created leads ≠ unique customers; WhatsApp/Wazzup duplicates common; Analytics OS does not yet apply the ops duplicate script.
6. **Ad spend** — Sheets aggregate vs channel truth; ROAS/CPL marked low confidence.
7. **Traffic OS export blocked from Mother** — any “company traffic” from Mother may be thin/legacy.
8. **Product Hub COGS** — passport/model COGS, not actual production cost per order; multi-product deals allocate COGS by lines but revenue is deal opportunity (can mismatch line sum).
9. **North Star / targetScenario (€100k)** — still a code fallback if plan sheet fails; should never silently replace real August plan.
10. **Empty Bitrix product rows** — “Без продукта” revenue has no COGS; ops data-quality issue, not only analytics.

---

## 9. What is connected well (current strengths)

- Bitrix sync → period snapshots with leads, invoices, paid deals, product rows.
- CEO plan sheet wired with many indicators (not only revenue).
- Product Hub COGS join by `bitrix_product_id` + name/PRODUCT_ID fallback.
- Explicit metric statuses and contour stubs instead of fake creatives/production.
- Auth gating on analytics APIs; cron secret for deploy/ops sync.
- Sales OS / Traffic OS / Mother exist as real warehouses with export contracts.
- Conversation intelligence exists as a separate mature module.

---

## 10. What is weakly connected or missing

- No SQL warehouse / historical query engine.
- Meta Ads / Google Ads API absent.
- Traffic → Mother cutover blocked.
- Production timestamps, delivery, refunds, NPS: no SSOT.
- Order items not first-class in Mother (primary product only).
- Finance OS / cash / full P&L incomplete in Analytics OS.
- Cohorts / creatives contours reserved only.
- Analytics OS does not yet primarily consume Mother contracts (ADR-007 ideal) — it re-aggregates Bitrix snapshots.
- Lead uniqueness / spam filters not in CEO snapshot.
- Some SKUs still missing from `SKU_MAP` (fallback via INDEX name heuristics).

---

## 11. Key code entry points (for auditors)

| Concern | Path |
|---------|------|
| CEO snapshot facade | `src/lib/analytics-os/load-ceo-snapshot.ts` |
| Contours catalog | `src/lib/analytics-os/contours.ts` |
| Bitrix sync / snapshots | `src/lib/bitrix/connector.ts`, `snapshot-store.ts` |
| Monthly plan sheet | `src/lib/sales-os/svod-plans.ts` (`getMonthlyPlanSpreadsheetId`) |
| Product COGS / margin | `src/lib/product-hub/sku-margin-catalog.ts` |
| Sheets registry doc | `docs/SPREADSHEETS.md` |
| Data flow doc | `docs/DATA_FLOW.md` |
| Earlier audit | `docs/analytics-os-audit.md` |
| Auth / routes | `src/middleware.ts`, `src/lib/auth/access.ts` |
| Deploy | `.github/workflows/deploy.yml`, `AUTO_DEPLOY.md` |

---

## 12. Sample “is this correct?” questions for GPT

1. Given Order=Deal and CEO revenue from Bitrix WON snapshots, is it acceptable that Mother Orders is not the first read for `/os`, or should Phase 2 switch the facade to Mother contracts only?
2. Is computing margin only on deals with product lines the right honesty model, or should unmapped deals be estimated / excluded from revenue KPI too?
3. Should monthly plan remain a live Sheets read on every CEO snapshot request, or be snapshotted like Bitrix?
4. With Traffic→Mother blocked, what is the safest source for ad spend and CPL on the CEO dashboard?
5. How should Maria vs Bitrix be presented so the owner does not mix plan completion bases?
6. Rank the P0 fixes to make the 12-contour mockup trustworthy without Ads API and without production OS.

---

## 13. Owner intent (context)

- Want Analytics OS to look like the “12 contours + CEO band + AI scenarios” mockup, with clickable drill-downs.
- Want August enabled and plan taken from the dedicated Plan/Fact workbook every month.
- Want firmer margin numbers from Product Hub COGS (`00_INDEX` / `SKU_MAP`).
- Prefer Russian UI; English code identifiers.
- Prefer minimal diffs and no invented production/ads data.

---

## 14. Appendix — metric status legend used in UI

| Status | Meaning |
|--------|---------|
| `live` | Directly from connected system for the period |
| `calculated` | Derived from live inputs with known formula |
| `manual` | Human/Sheets-entered value |
| `demo` | Placeholder / demo seed |
| `no_data` | Must show empty / “нет данных”, never silent zero |

---

**End of audit package.**  
Reviewer: answer Section 0 using evidence from Sections 3–10. Flag any place where the “declared SSOT” and “Analytics OS actual source” diverge unsafely.
