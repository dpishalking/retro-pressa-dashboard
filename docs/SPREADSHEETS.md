# Spreadsheet Registry

Hub: [00_START_HERE.md](./00_START_HERE.md) · [SYSTEMS.md](./SYSTEMS.md) · [DATA_FLOW.md](./DATA_FLOW.md)

IDs — **defaults from code / `.env.example`**. Overrides via env.  
Service Account: `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` (or JSON) — Sheets + GA4 readonly.

---

## Mother Business OS

| Field | Value |
|-------|-------|
| Spreadsheet ID | `1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8` |
| Env | `MOTHER_OS_SPREADSHEET_ID` → `GOOGLE_OS_SHEET_ID` |
| Purpose | Registries, orders, company aggregates, foundation 60–69, dual-run |
| Status | Active |
| Sync | `sync:os-orders`, `os-traffic`, `os-finance`, `os-sales`, `os-core`, `bitrix-sales-foundation`, `sales-os-ingest`, `/api/sync/os-daily` |
| Exports used | Ingests Sales `99_EXPORT` (`sales_export_v1`) → `32_Sales_OS_Daily` |
| Manual | Finance plan fields; registry notes (preserve-on-sync patterns) |
| Automatic | Orders, customers, payments, foundation, company, recon |

Tabs: [business-os/ARCHITECTURE.md](./business-os/ARCHITECTURE.md) · [business-os/BUSINESS_OS_CURRENT_STATE_AUDIT.md](./business-os/BUSINESS_OS_CURRENT_STATE_AUDIT.md)

---

## Sales OS (child)

| Field | Value |
|-------|-------|
| Spreadsheet ID | `1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY` |
| Env | `SALES_OS_SPREADSHEET_ID` |
| Purpose | CRM warehouse + facts + ROP board + export |
| Status | Active |
| Sync | `npm run sync:sales-os` · `POST /api/sync/sales-os` |
| Export | `99_EXPORT` / `sales_export_v1` |
| Manual | `15_Maria_Daily`, `16_Maria_Snapshot`, plan keys in Settings, stage map |
| Automatic | Leads, deals, events, facts, DQ, export |

---

## Traffic OS (child)

| Field | Value |
|-------|-------|
| Spreadsheet ID | `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg` |
| Env | `TRAFFIC_OS_SPREADSHEET_ID` |
| Purpose | Traffic warehouse, management, GA4, marketing home |
| Status | Active |
| Sync | `npm run sync:traffic-os` (+ modules) · `POST /api/sync/traffic-os` |
| Export | `99_EXPORT` / `traffic_export_v3` (Mother cutover **blocked**) |
| Manual | Source / Landing / Campaign map overrides |
| Automatic | Raw, CRM leads, attribution, management, GA4, home, DQ, export |

---

## Dialogs (transcripts)

| Field | Value |
|-------|-------|
| Spreadsheet ID | `1mQEcDnybKM6HLfJbOkgdNu3hMo3_3kxLbmRp_6DcQmo` |
| Env | `GOOGLE_DIALOGS_SHEET_ID` |
| Purpose | Full message bodies by period |
| Status | Active |
| Sync | Dialog/index scripts — **bodies not copied into Mother** |
| Note | Exact write ownership: see ADR-003; some paths **Requires clarification** |

---

## СВОД (marketing)

| Field | Value |
|-------|-------|
| Spreadsheet ID | `1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M` |
| Env | `GOOGLE_TRAFFIC_SHEET_ID` / `SVOD_PLAN_SPREADSHEET_ID` |
| Purpose | `График`, `day`, `Органика`, plans |
| Status | Active source (read by OS) |
| Manual | Plans / day rows (marketing) |
| Automatic | Read-only for OS |

---

## Maria truth

| Field | Value |
|-------|-------|
| Spreadsheet ID | `1nNC48IfiUgO86YGvyLH05o6DrBq3jKKprChT09HN2Mc` |
| Env | `MARIA_TRUTH_SPREADSHEET_ID` |
| Purpose | Operational paid truth |
| Status | Active |
| Manual | **Yes** |
| Automatic | Read into Sales / predictive |

---

## Predictive Sales front

| Field | Value |
|-------|-------|
| Spreadsheet ID | `1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820` |
| Env | `PREDICTIVE_SALES_SPREADSHEET_ID` |
| Tabs | `Предиктивка продажи` (+ Paid/Organic) |
| Purpose | Plan / Fact / PTF for ROP |
| Status | Active; placement **legacy** vs Standard Prediction |
| Manual | Plan cells |
| Automatic | Fact / PTF |

---

## Other (env)

| Env | Purpose | Status |
|-----|---------|--------|
| `GOOGLE_FINANCE_SHEET_ID` | Finance source | requires_audit |
| `GOOGLE_PAYROLL_SHEET_ID` | Payroll | requires_audit |
| `GOOGLE_PRODUCTION_SHEET_ID` | Production | blocked / requires_audit |
| ALX/ART contractor books | Landing URL evidence | Used in Traffic sync code |

## Not spreadsheets

`data/ga4-snapshots/`, `data/bitrix-snapshots/`, `data/google-snapshots/` — local cache, **gitignored**.

[SYSTEMS](./SYSTEMS.md) · [DATA_FLOW](./DATA_FLOW.md) · [SECURITY](./SECURITY.md)
