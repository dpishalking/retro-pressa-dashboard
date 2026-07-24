# Marketing Predictive Build Audit

Sprint: Marketing Planning / Predictive Layer v1  
Hub: [../00_START_HERE.md](../00_START_HERE.md)

---

## Design reference — Sales Planning

| Field | Value |
|-------|-------|
| Spreadsheet | `1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820` |
| Tab | **Предиктивка продажи** |
| gid | `419868082` |
| Access | OK (Editor via SA) |

Observed layout (July 2026):

- Title row: scope label + month name + «Месяц»
- Header: Неделя 1–5 + day names + **МЕС**
- Date row: week ranges + day labels (`dd.mm`)
- Sections: «Запаздывающие метрики» / «Опережающие метрики»
- Per metric: **план / факт / прогноз** (3 rows)
- Metrics: Revenue, Sale, AOV, Leads, Deals, Invoices, CR chain
- Week blocks: total + Mon–Sun; layout via `layoutForMonth`
- Design: `applyPredictiveTemplateDesign` (colors, merges, CF)
- Empty plan → empty forecast cells (formulas gated)
- Code anchors: `predictive-model.ts`, `predictive-design.ts`

**Copy:** design / UX / week structure / plan-fact-forecast.  
**Do not copy:** sales values.

---

## Target workbook

| Field | Value |
|-------|-------|
| Spreadsheet | `1Ru9H24Hs2WPNcP2TEGpvIEcRtjnDV8l-UyBnWNFakN4` |
| Title | RP \| Marketing \| ROM |
| Access | OK |
| Existing tabs | `Лист1` only (empty shell) |

Safe to create numbered tabs 00–25 + 99_EXPORT. Preserve any future manual cells via preserve patterns.

---

## Available sources (verified)

### Traffic OS `1jBUvTiD…9Wg`

Present: Source/Landing/Campaign maps, Daily/Channel/Type facts, GA4 26–36, Revenue Attribution, 99_EXPORT.

Usable FACT now:

- `12_Daily_Fact`: leads, deals, invoices, payments, paid_revenue, svod_paid/organic leads, svod_spend
- `10_Channel_Fact` / `17_Traffic_Type_Fact`: attributed funnel by channel/type
- `27_GA4_Channel_Daily`: sessions/users by channel_group

### Sales OS `1Zj_jLoJz…RwY`

Canon paid revenue / payments / deals / invoices / leads via Daily Fact / Payment Events.

### Marketing СВОД `1nItFm1e…ey4M`

- `План/факт` ОБЩИЕ / Paid / Organic slices → **PLAN** candidates (`pullSvodPaidOrganicPlans`)
- `day` + `Органика` → CRM lead facts by day
- Spend columns may appear on Traffic Daily as `svod_spend`

### GA4

Foundation sheets exist in Traffic OS. Sessions FACT via GA4 Channel Daily.  
`generate_lead` ≠ CRM lead (no hard join).

### Ads APIs

Meta / Google / Yandex Direct API: **NOT_CONNECTED** (by scope).

---

## Supported vs blocked

| Metric | FACT | PLAN | FORECAST |
|--------|------|------|----------|
| sessions | GA4 channel daily (sum) | NO_PLAN unless registry | calendar_run_rate if sessions FACT |
| leads | Traffic Daily / СВОД paid+organic | СВОД ОБЩИЕ/Paid/Organic if present | calendar_run_rate |
| deals / invoices / payments / paid_revenue | Sales/Traffic attributed | СВОД slices if present | calendar_run_rate |
| spend | Traffic Daily `svod_spend` if filled | NO_PLAN default | run_rate only if spend FACT |
| CPL/CAC/ROAS | only if spend+denom > 0 | — | **BLOCKED** without spend |
| Meta/Google/Yandex channel detail | partial via maps | — | NOT_CONNECTED for APIs |
| Funnel forecast (sessions×CR×AOV) | — | — | **BLOCKED** until CR baselines approved |

---

## Risks

- Attribution incomplete → paid/organic revenue soft
- Unknown traffic share high
- GA4↔CRM hard join 0%
- Weekly plans: none approved → weekly PLAN = NO_PLAN
- Equal week split forbidden
- Spend incomplete → no CPL theater

---

## Target tabs

`00`–`25` + `99_EXPORT` as specified in sprint.  
Contract: `marketing_predictive_v1` / export `marketing_predictive_export_v1`.

---

## Code changes (this sprint)

- `src/config/marketing-planning.ts`
- `src/lib/marketing-planning/*`
- `POST /api/sync/marketing-planning`
- `npm run sync:marketing-planning[:dry|:validate|:reconciliation]`
- docs under `docs/business-os/MARKETING_*`
- `.env.example` Marketing + Predictive Sales IDs

---

## Sync verification (2026-07)

| Step | Result |
|------|--------|
| Dry-run | `ok`, `rows_written: 0` |
| Production sync | `ok`, `rows_written: 815` |
| Second sync | `ok`, `rows_written: 815` (idempotent replace) |
| Design tab | `Предиктивка продажи` OK |
| Yandex | `NOT_CONNECTED` |

July month totals (FACT): sessions 20384 · leads 2256 · deals 1170 · invoices 301 · payments 287 · paid_revenue 21959.2 · spend ~2730.

Mother cutover: **not** performed. Commit/push: **not** performed.
