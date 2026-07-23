# Data Flow

Hub: [00_START_HERE.md](./00_START_HERE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SPREADSHEETS.md](./SPREADSHEETS.md) · [business-os/SYNC.md](./business-os/SYNC.md)

Frequencies below: cron where documented; otherwise **on-demand / manual npm** unless noted. Exact cron schedule: see `.github/workflows` / `AUTO_DEPLOY.md` — if unclear → **Requires clarification**.

---

## A. Sales path (CRM → Mother)

```text
Bitrix CRM  (SSOT events)
    ↓  webhook / REST  (BITRIX_WEBHOOK_URL)
Sales Foundation  Mother tabs 60–69
    ↓  sync:bitrix-sales-foundation · POST /api/sync/bitrix-sales-foundation
Sales OS child  (03_Leads … 13_Funnel, 99_EXPORT)
    ↓  sync:sales-os · POST /api/sync/sales-os
    contract: sales_export_v1
Mother 32_Sales_OS_Daily + 51/52 recon
    ↓  sync:sales-os-ingest · POST /api/sync/sales-os-ingest
Executive (planned) — reads contracts only
```

| Step | Source | Contract | Sync | Frequency |
|------|--------|----------|------|-----------|
| Bitrix → Foundation | Bitrix API | `sales_foundation_v1` | foundation scripts/API | on-demand / daily bundle **Requires clarification** |
| Foundation → Sales OS | Mother 60–69 | sales-os model | `sync:sales-os` | on-demand |
| Sales → Mother | `99_EXPORT` | `sales_export_v1` | `sync:sales-os-ingest` | on-demand / dual-run |
| Maria overlay | Maria sheet | manual truth | read in sales/predictive | on-demand |

---

## B. Traffic path

```text
СВОД (day / Органика)     GA4 Data API      Sales OS / Sales payments
        ↓                      ↓                      ↓
Traffic OS warehouse (05–08, 26–36 GA4, maps)
        ↓
Management + Marketing Home (16–22, 30–33)
        ↓
99_EXPORT  traffic_export_v3
        ↓
Mother   ✗ cutover BLOCKED (do not treat as canon)
```

| Step | Source | Contract | Sync | Frequency |
|------|--------|----------|------|-----------|
| СВОД → Traffic raw | Google Sheet | parse-svod-raw | inside `sync:traffic-os` | on-demand |
| GA4 → Traffic 26–36 | GA4 property | `ga4_foundation_v1` | module `ga4_foundation` | on-demand |
| CRM join | Sales sheets | lead/deal/payment keys | inside traffic-os | on-demand |
| Traffic export | derived | `traffic_export_v3` | written on sync | on-demand |
| → Mother | — | — | **blocked** | — |

Legacy Mother traffic: `sync:os-traffic` → Mother `01_Traffic_Daily` (thin; dual-canon with СВОД — policy sensitive).

---

## C. Mother company spine

```text
Bitrix deals/orders mapper → Mother 03_Orders
Traffic/СВОД sync         → Mother 01_Traffic_Daily / Органика
Finance sheet sync        → Mother 07_Finance_Daily
        ↓
Customers / Payments core → Company Daily/Monthly → Reconciliation
```

Sync: `sync:os-orders`, `sync:os-traffic`, `sync:os-finance`, `sync:os-core`, `/api/sync/os-daily`.

---

## D. Dialogs

```text
Dialog workbook (transcripts)
    ↓ index only
Mother 08_Dialog_Export (pointer, no message bodies)
```

ADR: [decisions/ADR-003-no-raw-dialogs-in-mother.md](./decisions/ADR-003-no-raw-dialogs-in-mother.md)

---

## E. App analytics (not child OS warehouse)

```text
GA4 → data/ga4-snapshots → /ad-analytics UI
Clarity / UTM audit / Gemini ask → API routes
```

Parallel to Traffic GA4 foundation; do not confuse UI snapshots with Traffic sheets 26–36.

---

## F. Prediction (current)

```text
SVOD plans + Maria + Sales facts
    ↓
Predictive Sales spreadsheet (external book)
```

Not yet Standard Prediction Layer inside Sales OS numbering — [RELEASES.md](./RELEASES.md) · next: Sales Prediction Alignment.

[ARTIFACTS](./ARTIFACTS.md) · [SYSTEMS](./SYSTEMS.md)
