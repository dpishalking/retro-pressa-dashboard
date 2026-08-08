# Retro Pressa Analytics OS — Technical & Analytical Audit

**Date:** 2026-08-08  
**Scope:** Read-only audit of the existing repository. No Analytics OS code was written.  
**Related hubs:** [00_START_HERE.md](./00_START_HERE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [DATA_FLOW.md](./DATA_FLOW.md) · [SYSTEMS.md](./SYSTEMS.md)  
**Companion docs:** [analytics-os-metrics.md](./analytics-os-metrics.md) · [analytics-os-data-map.md](./analytics-os-data-map.md) · [analytics-os-phase1.md](./analytics-os-phase1.md)

---

## 1. Executive Summary

Retro Pressa уже является **Business OS на Next.js 15 + Google Sheets + Bitrix**, а не «пустым» дашбордом. Аналитическая операционная система собственника (`/analytics` → Analytics OS) должна строиться как **Executive / adapter layer** над уже существующими Sales OS, Traffic OS, Mother OS и Bitrix Sales Foundation — не как новая CRM и не как замена Sheets.

**Что уже сильно:**

- Bitrix REST sync: leads, deals, contacts, **stage history**, activities, dialog links.
- Нормализованные модели заказов/клиентов/оплат в Mother (`03_Orders`, `21_Customers_Core`, `24_Payments_Core`).
- Sales OS warehouse + `sales_export_v1` + dual-run.
- GA4 Data API, UTM standards/generator, conversation intelligence (ROP).
- Metrics engine, company snapshot, financial engine (частично на defaults), predictive sales front.

**Что блокирует полноценный CEO Control Center:**

- Нет SQL/Prisma warehouse — joins и history живут в Sheets + JSON snapshots.
- Meta Ads / Google Ads API **не подключены** (spend через СВОД Sheets).
- Traffic → Mother cutover **blocked**.
- Finance OS / Product OS / Production OS — planned/blocked.
- Order = Deal (v1); нет полноценных `order_items` (только primary product).
- Production/delivery — ручные поля, не live pipeline.
- Refunds / NPS / reviews — нет SSOT.
- `/analytics` уже существует как legacy company dashboard — Analytics OS должен **эволюционировать**, а не дублировать слепо.

**Рекомендация:** Phase 1 = Analytics Shell поверх **уже считаемых** KPI (Sales + Mother + GA4 + partial finance), с явными статусами `LIVE / CALCULATED / MANUAL / DEMO / NO DATA`. Не строить AI Analyst / Scale Simulator до стабилизации data contracts.

---

## 2. Current Tech Stack

| Layer | Reality |
|-------|---------|
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind 4 |
| Charts | **Recharts** (already in `/analytics`, `/ad-analytics`) |
| UI primitives | Custom CSS + Tailwind; `class-variance-authority`, `clsx`, `tailwind-merge`, Lucide; **не** MUI / Ant / shadcn kit as primary |
| Backend | Next.js Route Handlers (`src/app/api/**`) |
| Database / ORM | **None** — no Prisma, no SQL schemas |
| Persistence | Google Sheets (SSOT warehouses) + JSON under `data/**` + `.cache/` |
| Auth | Cookie session (`src/lib/auth/`), users in `data/auth/users.json`; roles `admin` \| `rop` \| `mop` \| `partner` |
| Validation | Zod |
| AI | Gemini (`GEMINI_*`), Vertex optional |
| Deploy | GitHub Actions → Timeweb (`AUTO_DEPLOY.md`) |
| Queues | **None** |
| Cron | GitHub Actions → SSH curl with `x-cron-secret`: daily ROP sync, OS daily sync, predictive hourly/daily |
| Webhooks | Bitrix inbound webhook URL as REST client (`BITRIX_WEBHOOK_URL`); no separate event bus |

---

## 3. Existing Architecture

```text
Bitrix CRM (SSOT events)
    → Sales Foundation (Mother 60–69)
    → Sales OS (warehouse + 99_EXPORT)
    → Mother dual-run ingest

СВОД Sheets + GA4
    → Traffic OS (warehouse + management)
    → Mother cutover BLOCKED

Bitrix deals mapper
    → Mother 03_Orders / 21_Customers / 24_Payments

App UI (parallel):
  /analytics          — company KPIs + Bitrix snapshots + signals
  /ad-analytics       — GA4 + Sheets traffic + Gemini ask
  /rop/**             — sales ops + conversations
  /digital-twin       — scenario / financial twin (admin)
  /utm                — UTM generator
```

**Ключевой принцип (ADR-007):** Executive layer **читает contracts**, не пересчитывает бизнес-логику заново. Analytics OS должен следовать тому же правилу: consume Sales/Traffic/Mother exports + company snapshot, а не invent a second metrics engine.

Existing docs already define Business OS layers — Analytics OS ≈ **Executive OS UI** planned in `SYSTEMS.md`.

---

## 4. Data Inventory

| Entity | Table / Model | Purpose | Important fields | Relations | Analytics value |
|--------|---------------|---------|------------------|-----------|-----------------|
| Lead | `60_Bitrix_Leads_Raw` / Sales OS leads | CRM lead staging | `lead_id`, status, source, UTM*, country, `customer_key`, assigned | → Contact, Deal (weak `deal_id` fill) | Funnel top, CPL, source mix |
| Deal | `61_Bitrix_Deals_Raw` / Sales OS deals | CRM deal = sales unit | `deal_id`, stage, opportunity, invoice_*, country, primary_product, `product_rows_count` | ← Lead, Contact; → Products rows | Core sales funnel |
| Order | Mother `03_Orders` | **v1 order_id = Bitrix deal.ID** | amount, paid_at, payment_status, manager, country, UTM, production_* (manual) | = Deal; ← Lead; → Customer, Payment | Revenue spine |
| Order item | Deal productrows (Bitrix) | Line items in CRM | product id/name; **Orders sheet stores only primary** | Deal → products[] | Attach/cross-sell **partial** |
| Contact | `62_Bitrix_Contacts_Raw` | Identity (hashed PII) | `contact_id`, phone_hash, email_hash, `customer_key` | → Leads/Deals | Repeat / LTV identity |
| Customer | Mother `21_Customers_Core` | Aggregated buyer | `customer_key`, paid_orders_count, total_paid_revenue, first/last order | ← Orders | Repeat rate, LTV |
| Payment | Mother `24_Payments_Core` / Sales `08_Payment_Events` | Paid order grain | `payment_id`, paid_at, amount, manager, product, country | ← Order/Deal | Revenue, AOV, manager rev |
| Stage history | `63_Bitrix_Stage_History` | Funnel timing | stage_id, entered_at, duration_minutes | ← Deal | Funnel analytics **available** |
| Pipeline | `65_Bitrix_Pipeline` | Open deals snapshot | days_open, overdue, weighted_amount | Deal | Pipeline / backlog |
| Activity | `66_Bitrix_Activities` | CRM activities | type, deadline, responsible | Lead/Deal | Response / overdue ops |
| Dialog link | `67_Bitrix_Dialog_Links` | OL session meta | messages_count, lead/deal/manager | → Conversations workbook | Conversation join |
| Product (hub) | Product Hub Sheets `01–08` | Catalog + prices + SLA | product_id, category, status, market prices, production/delivery | Variants, prices | Product analytics (when filled) |
| Product (order) | Orders `product_sku/name` | Primary SKU on order | from deal productrows[0] | Order | Mix / AOV by product |
| Manager | Bitrix user + `12_Employees` + metrics types | Sales owner | `manager_id` (= ASSIGNED_BY_ID), name | Leads/Deals/Orders | Manager performance |
| Traffic daily | Mother `01_Traffic_Daily` / Traffic OS | Leads + spend aggregates | paid/organic leads, ad_spend | Sheets + GA4 | Marketing efficiency |
| Finance daily | Mother `07_Finance_Daily` | Cash / plan / margin thin | fact_revenue, ad_spend, payroll, opex, margin | Manual + sync | Unit econ partial |
| Company monthly | Mother company monthly cols | Recon KPIs | os_paid_revenue, svod_*, cpl, cac, roas, gross_profit | Multi-source | CEO monthly |
| Conversation | `data/conversation-snapshots/` + dialogs sheet | Messages | channel, manager, stage, outcome | Dialog links → CRM | Conversation intel |
| GA4 snapshot | `data/ga4-snapshots/` | Site traffic | sessions, newUsers, channel/campaign | Parallel to Traffic GA4 foundation | Top-of-funnel |
| Maria truth | Maria spreadsheet | Manual ROP day truth | invoices/sales/revenue | Overlay on Sales OS | Dual-truth risk |

**No relational DB entities.** Analytics layer must treat Sheets tabs + typed mappers as the schema.

---

## 5. CRM / Bitrix

### Integration surface

| Piece | Path |
|-------|------|
| REST client | `src/lib/bitrix/rest-client.ts` |
| Analytics connector → monthly snapshots | `src/lib/bitrix/connector.ts` |
| Snapshot store | `src/lib/bitrix/snapshot-store.ts` → `data/bitrix-snapshots/` |
| Metric field canon | `src/lib/bitrix/metric-definitions.ts` |
| Sales Foundation | `src/lib/bitrix/sales-foundation/*`, `src/config/sales-foundation.ts` |
| Conversations | `conversation-connector.ts`, `openline-crm-connector.ts` |
| Sync API | `POST /api/sync/bitrix`, `POST /api/sync/bitrix-sales-foundation` |
| Scripts | `npm run sync:bitrix-sales-foundation` (+ module flags) |
| Cron | ROP daily-sync; OS daily; foundation mostly on-demand |

### Bitrix entity matrix

| Bitrix Entity | Available | Stored locally | Fields (high level) | Sync frequency | Issues |
|---------------|-----------|----------------|---------------------|----------------|--------|
| Lead | Yes | Foundation 60 + snapshots | UTM*, source, country UF, assignee, contact | On-demand / bundle TBD | Conversion→deal_id often empty; qualified leads from Sheets not Bitrix |
| Deal | Yes (CATEGORY_ID=0) | Foundation 61 + Orders | stage, opportunity, invoice UF, country, source, productrows | On-demand + os-orders | Order = Deal; other categories out of scope |
| Contact | Yes | Foundation 62 | hashes only, no open PII | On-demand | Privacy-safe but harder ad-hoc debug |
| Company | Partial | IDs on lead/deal | company_id | Via lead/deal | Thin |
| User | Yes | Names via `user.get` | assigned_by_id/name | With sync | App auth users ≠ Bitrix users |
| Product | Via productrows | primary + count on deal; Hub separate | product id/name/qty in Bitrix rows | With deals | Hub ↔ Bitrix SKU mapping incomplete |
| Activity | Yes | Foundation 66 | type, deadline, completed | On-demand | Not full timeline UI |
| Timeline | Partial | Activities + stage history | — | — | Not full Bitrix timeline stream |
| Stage History | **Yes** | Foundation 63 | entered/left, duration | `--stage-history` | Critical for funnel — **exists** |
| Open Lines | Yes (counts) | Foundation 67 + dialogs workbook | counts; bodies elsewhere | Daily ROP + on-demand | Bodies not in Mother (ADR-003) |

---

## 6. Orders

### Representation

- **Canonical v1:** `order_id` = Bitrix `deal.ID` (`ORDERS_COLUMNS` in `src/config/os-sheets.ts`).
- **Created by:** Bitrix deal create → synced via Bitrix snapshot / `sync:os-orders` → Mother `03_Orders` (`orders-mapper.ts`).
- **Lifecycle (real):**

```text
Lead (Bitrix)
  → Deal created (CATEGORY_ID=0)
  → Qualification / offer (stages + activities + dialogs)
  → Invoice (UF invoice date/amount/flag OR stage history STAGE_ID=1)
  → Paid = STAGE_SEMANTIC_ID=S + CLOSEDATE → paid_at
  → Production / Shipping (manual columns on Orders — often empty)
  → Delivered (manual — not automated)
```

Lost path: `STAGE_SEMANTIC_ID=F` → `payment_status=lost`.

### Field checklist

| Question | Answer |
|----------|--------|
| Where created? | Bitrix CRM deal; mapped in `mapDealToOrdersRow` |
| ID | `order_id` = deal id |
| Customer link | `customer_key` (+ type): contact → phone hash → email hash → lead → deal |
| CRM lead/deal | `lead_id`, `deal_id` (= order_id) |
| Product items | Bitrix productrows exist; **Orders stores primary only** |
| Quantity | In Bitrix rows; **not** in Orders sheet columns |
| Price / amount | `amount`, `opportunity`, `invoice_amount` |
| Discount | **Not modeled** as first-class field |
| Currency | `currency` (default EUR) |
| Country | Deal UF → else lead UF |
| Manager | `manager_id` / `manager_name` from ASSIGNED_BY |
| Source | `source_channel` (paid_social vs organic_other from SOURCE_ID) |
| UTM | `utm_source/medium/campaign` from **lead** (campaign also deal); **content/term not on Orders** |
| Payment status | `unpaid \| invoiced \| paid \| lost` (+ order_status) |
| created_at | Deal DATE_CREATE |
| paid_at | CLOSEDATE when won |
| Delivery status | Manual column — often empty |
| Production status | Manual column — often empty |

### Decision impact

Owner can already answer: revenue, paid orders, AOV, manager revenue, country revenue, primary product mix — **if** sync freshness is trusted. Cannot reliably answer production SLA / multi-SKU basket without enrichment.

---

## 7. Customers

### Identity

Priority (`customer-identity.ts` / Sales Foundation):

1. `contact:{id}`
2. `phone:{sha256(normalized)}`
3. `email:{sha256(normalized)}`
4. `lead:{id}`
5. `deal:{id}` / `order:{id}`

Open phones/emails **not** stored in Foundation contacts (hashes + presence flags). Instagram/WhatsApp/Telegram as stable customer IDs — **not** first-class; channels appear on conversations.

### Repeat purchase

**Yes, calculatable** via Mother `21_Customers_Core`:

- `paid_orders_count`
- `first_order_id` / `last_order_id`
- `total_paid_revenue`

First vs repeat for an order: join order → customer → `paid_orders_count > 1` or order_id ≠ first_order_id among paid.

**Caveats:** identity collapses if contact missing and phone/email absent (fallback to lead/deal → false uniques). Messenger-only clients may fragment.

---

## 8. Products

### Sources

1. **Product Hub** Sheets (`PRODUCT_HUB_SHEET_ID`): `01_PRODUCTS`…`08_READINESS` — product_id, category, status, market prices by country, production/delivery SLA, playbook, assets.
2. **Passports** — economy fields: retail_price, cost_price, cogs_* (`src/types/product-passports.ts`).
3. **Bitrix productrows** on deals — operational attach to sales.
4. **Training / PDF products** — separate catalogs (education UX, not sales SSOT).
5. **Product OS** — template only (`product-os.template.ts`).

### Attach to order

Orders mapper takes **first** productrow with name/id → `product_sku` / `product_name`. `product_rows_count` exists on deal raw → Products per Order **partially** available from Foundation, not from Orders sheet alone.

| Metric | Feasibility |
|--------|-------------|
| Products per Order | CALCULATABLE from deal productrows / `product_rows_count` |
| Attach Rate | PARTIAL — need definition of “base vs attach” SKU taxonomy |
| Cross-sell | PARTIAL — need full order_items projection |

---

## 9. Managers

| Field | Source |
|-------|--------|
| manager_id | Bitrix `ASSIGNED_BY_ID` |
| name | Bitrix user name |
| CRM user id | = manager_id |
| App user | Separate `data/auth/users.json` (role mop ≠ CRM identity) |
| Employees sheet | Mother `12_Employees` (`bitrix_user_id`) |

**Chain Manager → Lead → Deal → Order → Revenue:** YES for assigned owner on CRM entities. Lead→Deal conversion link sometimes weak (`is_converted` / `deal_id` gaps). Revenue attribution = deal assignee at close (no multi-touch manager model).

Existing: `ManagerMetrics`, `ManagerInvoiceMetrics`, predictive-by-manager, motivation module, ROP board.

---

## 10. Marketing

| Source | Status | Metrics available |
|--------|--------|-------------------|
| Meta Ads API | **NOT CONNECTED** | — |
| Facebook/IG spend (Sheets СВОД) | **PARTIAL** | Spend, leads (contractor summary) |
| Instagram messaging | **PARTIAL** via Open Lines / conversations | Dialog quality, not ads |
| Google Ads API | **NOT CONNECTED** | — |
| GA4 | **CONNECTED** | newUsers, sessions, engagedSessions; channel/campaign/landing |
| Google Search Console | **NOT CONNECTED** | — |
| TikTok | **NOT CONNECTED** | — |
| UTM tracking | **CONNECTED** (standards + Bitrix lead fields + generator) | Source/medium/campaign (+ content/term on leads) |
| Website forms | **PARTIAL** | Land in Bitrix as leads with form_name / UTM |
| Clarity | **OPTIONAL** | UX heatmaps if token set |

Traffic OS is strong warehouse; **Mother cutover blocked** → CEO app must not treat Mother traffic as sole canon yet.

---

## 11. Finance

| Data | Status |
|------|--------|
| Payments (CRM won) | LIVE via Sales/Orders |
| Invoices (UF / Maria) | Dual truth — engineering vs ROP operational |
| Refunds | NOT in Orders/Finance spine (Partners only niche) |
| Discounts | NOT first-class |
| Commissions | Motivation module — separate |
| Production costs | Product passport COGS partial; twin defaults |
| Shipping costs | Hub / twin — not order-level actuals |
| Payment fees | NOT modeled |
| Bank balance | Manual / file env — not live API |

### Calculability

| Metric | Status |
|--------|--------|
| Revenue (paid CRM) | LIVE READY |
| Gross Revenue | LIVE READY (≈ paid opportunity) |
| Net Revenue | PARTIAL (no refunds) |
| Refunds | NOT AVAILABLE |
| Gross Profit | PARTIAL (company monthly / finance margin / passport COGS) |
| Contribution Margin | PARTIAL |
| CAC | CALCULATABLE when ad_spend + new customers trusted |
| AOV | LIVE READY |

---

## 12. Operations

| Entity | Reality |
|--------|---------|
| production_status / deadline | Manual on Orders |
| shipment_id / delivery_* | Manual on Orders |
| Mother `04_Production_Jobs` | Stub |
| Product Hub production/delivery SLA | Normative days by country/variant |
| Production OS | **Blocked** — no live status source |
| Editor/designer roles | Not first-class analytics entities |

| Metric | Status |
|--------|--------|
| Production funnel | NO DATA / MANUAL only |
| Order Processing Time | PARTIAL (created→paid via stage history; post-pay ops weak) |
| Production Time | NOT AVAILABLE (live) |
| Backlog | PARTIAL (open pipeline deals) |
| Overdue Orders | PARTIAL (pipeline `is_overdue` / activity overdue; not production overdue SSOT) |

---

## 13. Data Quality

### Known systemic issues

- Dual truth: Bitrix WON vs Maria day numbers vs СВОД attributed revenue.
- Lead→Deal conversion fields underfilled.
- UTM missing on organic/messenger leads (expected, not a Bitrix bug).
- Orders without product when productrows empty.
- Country missing when both deal/lead UF empty.
- Currency assumed EUR operationally.
- PeriodKey in app UI still `may-2026|june-2026|july-2026` — rolling months need extension for OS longevity.
- Traffic→Mother blocked → recon deltas expected.
- No open PII in foundation → harder manual QA without Bitrix UI.

### Data Readiness Score (audit judgment)

| Domain | Score (0–100) | Notes |
|--------|---------------|-------|
| Sales Analytics | **78** | Stage history + payments + managers solid |
| Marketing Analytics | **48** | No Ads API; Sheets spend; cutover blocked |
| Product Analytics | **42** | Hub schema yes; order line grain weak; COGS partial |
| Financial Analytics | **45** | CRM revenue strong; costs/refunds weak |
| Operations Analytics | **28** | Production/delivery not automated |
| **Overall Data Readiness** | **52** | Enough for Phase 1 CEO cockpit with honest NO DATA zones |

---

## 14. Metric Matrix

See full definitions in [analytics-os-metrics.md](./analytics-os-metrics.md). Summary:

| Metric | Status | Source | Formula (short) | Missing data | Confidence |
|--------|--------|--------|-----------------|--------------|------------|
| Revenue | LIVE READY | Payments / Orders paid | SUM(amount) where paid | Refunds | HIGH |
| Orders | LIVE READY | Orders / Payments | COUNT paid | — | HIGH |
| Leads | LIVE READY | Bitrix leads | COUNT by DATE_CREATE | Dupes need script | HIGH |
| Qualified Leads | PARTIAL | Sheets / dialogue rules | Period sheets / quality % | Bitrix native qual | MEDIUM |
| Paid Orders | LIVE READY | STAGE_SEMANTIC=S | COUNT | — | HIGH |
| Conversion Rate | CALCULATABLE | Leads→Payments | payments/leads | Lead-deal link gaps | MEDIUM |
| AOV | LIVE READY | Revenue/Orders | SUM/COUNT | — | HIGH |
| Products per Order | PARTIAL | product_rows_count | AVG(rows) | Line grain in Orders | MEDIUM |
| Repeat Rate | CALCULATABLE | Customers Core | customers with paid>1 | Identity gaps | MEDIUM |
| LTV | PARTIAL | total_paid_revenue | AVG / cohort | Time windows | MEDIUM |
| CAC | PARTIAL | ad_spend / new paid customers | spend÷new | Ads API | MEDIUM |
| CPL | PARTIAL | ad_spend / paid leads | Sheets | Ads API | MEDIUM |
| ROAS | PARTIAL | revenue / ad_spend | cash/invoice ROAS in engine | Ads API | MEDIUM |
| Gross Profit | PARTIAL | Finance / passport | rev − COGS | Actual COGS | LOW–MED |
| Contribution Margin | PARTIAL | rev − variable | — | shipping/fees | LOW |
| Refund Rate | NOT AVAILABLE | — | — | refunds entity | — |
| Production Time | NOT AVAILABLE | — | — | ops timestamps | — |
| Delivery Time | NOT AVAILABLE | — | — | delivery stamps | — |
| Manager Response Time | LIVE READY / PARTIAL | Conversations + dialogue quality | median minutes | Coverage sample | MEDIUM |
| Upsell Rate | PARTIAL | productrows / offer markers | needs taxonomy | — | LOW |
| Attach Rate | PARTIAL | productrows | needs base SKU | — | LOW |
| Country Revenue | LIVE READY | Orders.country | SUM by country | Missing country | MEDIUM–HIGH |
| Country CR | CALCULATABLE | leads/deals by country | — | Country fill | MEDIUM |

---

## 15. Data Lineage

### Happy path (paid social)

```text
Meta Ad (spend in СВОД Sheets — API gap)
  → UTM on landing / form
  → Bitrix Lead (UTM_* fields)
  → Bitrix Deal (LEAD_ID; UTM_CAMPAIGN sometimes)
  → Invoice UF / stages
  → WON + CLOSEDATE (Payment)
  → Mother Order + Payment row
  → Revenue KPI
```

### Break points

1. **Ads API missing** — creative/campaign cost not joinable at ad-id grain.
2. **Messenger leads** — often no UTM; source = WhatsApp/Telegram/Wazzup.
3. **Lead→Deal** — `deal_id` / `is_converted` underfilled; join via contact/customer_key.
4. **UTM on Order** — content/term dropped; depends on lead still linked.
5. **Traffic→Mother blocked** — marketing export not executive canon.
6. **Post-payment ops** — production/delivery lineage stops at manual columns.
7. **Maria overlay** — ROP day numbers may diverge from Bitrix WON.

Full diagrams: [analytics-os-data-map.md](./analytics-os-data-map.md).

---

## 16. Missing Data

### P0 — cannot manage the business cleanly without

1. Trusted **daily paid revenue** contract (Bitrix WON vs Maria — pick display policy + show both).
2. **Ad spend grain** usable with UTM/campaign (API or hardened СВОД mapping).
3. **Order ↔ full product lines** (project productrows into analytics order_items).
4. Stable **Traffic export → Executive** path (unblock or bypass via Traffic OS read).
5. Extensible **period model** beyond hard-coded PeriodKey trio for UI.

### P1 — strongly improves analytics

1. Product cost history / actual COGS on order.
2. Delivery & shipping cost actuals.
3. Refunds + reasons.
4. Production timestamps (started/completed) from real ops tool.
5. utm_content/utm_term on Orders projection.
6. Qualified lead definition locked in Bitrix or Sales OS.
7. Country fill-rate improvement.

### P2 — later

1. Conversation sentiment / Gift Graph AI.
2. Search Console / TikTok.
3. Payment processor fees.
4. Multi-touch attribution.
5. Scale simulator inputs automation.

---

## 17. Analytics Readiness Score

| Scorecard | Value |
|-----------|-------|
| Overall Data Readiness | **52 / 100** |
| Sales | 78 |
| Marketing | 48 |
| Product | 42 |
| Finance | 45 |
| Operations | 28 |
| Phase 1 UI feasibility | **HIGH** if NO DATA honesty enforced |
| Full Analytics OS (all 12 areas live) | **LOW** until P0 closed |

---

## 18. Recommended Analytics Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Analytics OS UI  (/analytics)  — Executive adapter          │
│  KPI status: LIVE | CALCULATED | MANUAL | DEMO | NO DATA    │
└───────────────────────────┬─────────────────────────────────┘
                            │ read-only facades
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 Company Snapshot      Sales export        Traffic OS
 + metrics-engine      + Orders/Payments   + GA4 snapshots
 + finance thin        + Stage history     + СВОД spend
        │                   │                   │
        └────────────┬──────┴───────────────────┘
                     ▼
              Existing sync / Sheets SSOT
                     ▲
              Bitrix / GA4 / Maria / Hub
```

**Do not:** create parallel Postgres of all CRM facts in Phase 1.  
**Do:** typed read adapters (`src/lib/analytics-os/` later) over company-snapshot, os-sheets rows, sales-os export, traffic-os export.  
**Do:** reuse Recharts + existing card/`SectionHead` patterns; navy topbar + status chips per metric.

---

## 19. Recommended Data Model

Canonical analytics entities (logical — adapters, not new CRM):

| Entity | Backing today | Phase 1 action |
|--------|---------------|----------------|
| customers | `21_Customers_Core` | Read |
| leads | Foundation 60 / Sales leads | Read |
| deals | Foundation 61 / Sales deals | Read |
| orders | `03_Orders` | Read |
| order_items | Bitrix productrows / deals raw | **Project view** (new adapter, not new CRM table) |
| products | Product Hub + Bitrix names | Read + SKU map |
| managers | ASSIGNED_BY + Employees | Read |
| marketing_sources | Traffic taxonomy + SOURCE_ID | Read |
| campaigns | UTM campaign + СВОД | Read partial |
| payments | `24_Payments_Core` / Sales payments | Read |
| refunds | — | NO DATA stub |
| production_jobs | Orders manual + stub tab | NO DATA / MANUAL |
| shipments | Orders manual | NO DATA / MANUAL |
| reviews | — | NO DATA stub |

Event model: see metrics companion + phase1 — derive from stage history, payments, dialogs where possible.

---

## 20. Phase 1 Scope

Working CEO Control Center on `/analytics`:

- Analytics Shell (navy header, sidebar, filters, 12-col desktop layout)
- KPI row with data-status chips
- Plan / Fact / Forecast (from finance + predictive where available)
- Revenue Tree (paid revenue → country → product → manager)
- Sales Funnel (leads → deals → invoices → payments; stage history)
- Managers board (reuse metrics types)
- Product Analytics (primary SKU + product_rows_count)
- Country Analytics
- Unit Economics (AOV, CPL/CAC/ROAS with PARTIAL badges)
- Production Overview (**explicit NO DATA / MANUAL**)
- Data Sources + Data Quality panels

**Out of Phase 1:** AI Analyst, Conversation Intelligence deep UI (keep link to `/rop/conversations`), Predictive Forecasting v2, Anomaly Detection, Gift Graph, Scale Simulator.

Detail: [analytics-os-phase1.md](./analytics-os-phase1.md).

---

## 21. Phase 2 Scope

- Ads API or hardened spend↔campaign join
- order_items first-class projection + attach/cross-sell
- Traffic export consumed as marketing canon in UI
- COGS join → Gross Profit / Contribution Margin LIVE/CALCULATED
- Refunds model
- Rolling periods in UI
- Production status source integration (unblock Production OS)

---

## 22. Phase 3 Scope

- AI Analyst (Why / What To Do / What If) on top of stable metrics
- Conversation Intelligence inside Analytics OS
- Cohorts / Gift Graph
- Scale Simulator (×10 bottlenecks)
- Anomaly detection + Alerts / Daily Brief automation

---

## 23. Risks

1. **Dual-canon revenue** confuses owner if UI hides Maria vs Bitrix.
2. Building a **second metrics engine** drifts from ADR-007.
3. Treating empty production fields as zeros → false overdue alarms.
4. Sheets latency / quota → “LIVE” that is hours stale — need `last_sync_at` everywhere.
5. PeriodKey hard-code blocks August+ without code change.
6. Scope creep into Finance/Product OS cutover inside Analytics UI sprint.
7. Privacy: never surface open PII from hashes in Analytics OS.

---

## 24. Questions / Decisions Required

1. **Revenue truth for CEO KPI:** Bitrix WON, Maria day, or dual display with delta?
2. **Is Analytics OS the planned Executive OS**, or a parallel brand under `/analytics`?
3. **Replace vs evolve** current `dashboard-ui.tsx` (~2900 lines)?
4. Accept **Traffic OS direct read** until Mother cutover unblocked?
5. Priority of **Ads API** vs improving СВОД mapping?
6. Who owns **production status** source of truth (Bitrix custom fields vs external sheet)?
7. Should Phase 1 include **lead dedupe** metrics (existing `bitrix-leads-day.mjs` logic) on Overview?
8. Currency: lock EUR-only for Phase 1?

---

## Appendix A — Existing dashboards to reuse

| Route | Component | Reuse |
|-------|-----------|-------|
| `/analytics` | `dashboard-ui.tsx` | KPI patterns, Recharts, signals — refactor into shell |
| `/ad-analytics` | `ad-analytics-screen.tsx` | Marketing widgets / ask AI link |
| `/rop` | `rop-hub.tsx` | Sales ops deep-dive link |
| `/rop/conversations` | `rop-conversations-screen.tsx` | Conversation Intelligence (Phase 2/3) |
| `/digital-twin` | digital-twin app | What-if later; admin-only |
| Financial report comps | `financial-report/*` | Unit economics / P&L panels |
| `/utm` | utm generator | Data → Sources tool link |
| Office hub | `office-hub.tsx` | Entry card copy update |

## Appendix B — UI stack for Analytics OS

- Tailwind 4 + existing global tokens (`src/app/globals.css`)
- Recharts only (already dependency)
- Proposed palette (if tokens missing): Background `#F6F8FB`, Cards `#FFFFFF`, Navy `#0E2344`, Blue `#3478F6`, Green `#2F9E62`, Orange `#F59E0B`, Red `#DC4C4C`, Purple `#7257D5`, Sand `#FFF7E6`, Light Blue `#EFF6FF`, Borders `#E4E9F1`
- Desktop-first 1440–1600px, 12 columns; sidebar + topbar
- Metric status chip architecture: `LIVE | CALCULATED | MANUAL | DEMO | NO DATA`

## Appendix C — Search keyword coverage

Audited code/docs for: analytics, dashboard, order(s), lead(s), deal(s), customer/client/contact, manager, product, payment, revenue, price, cost, margin, utm, source, country, shipping/delivery, production, status, refund, review, Bitrix/CRM, Meta/Facebook/Instagram, Google/GA4. No separate SQL schema found for these terms.
