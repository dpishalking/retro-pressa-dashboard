# Architecture Map — Business OS

Hub: [00_START_HERE.md](./00_START_HERE.md) · [BUSINESS_OS.md](./BUSINESS_OS.md)  
Детальный слойный стандарт: [business-os/BUSINESS_OS_STANDARD_V1.md](./business-os/BUSINESS_OS_STANDARD_V1.md)  
Исторический обзор Mother tabs: [business-os/ARCHITECTURE.md](./business-os/ARCHITECTURE.md)

---

## ASCII — система целиком

```text
┌─────────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐
│ Bitrix CRM  │  │ СВОД     │  │ GA4 API │  │ Maria    │
│ (SSOT CRM)  │  │ marketing│  │ visits  │  │ truth    │
└──────┬──────┘  └────┬─────┘  └────┬────┘  └────┬─────┘
       │              │             │            │
       ▼              │             │            │
┌──────────────┐      │             │            │
│ Sales Found. │      │             │            │
│ Mother 60–69 │      │             │            │
└──────┬───────┘      │             │            │
       ▼              ▼             ▼            │
┌──────────────┐  ┌──────────────────────────┐   │
│  Sales OS    │  │      Traffic OS           │◀──┘ (leads join)
│  warehouse   │  │ warehouse+mgmt+GA4+home  │
│  99_EXPORT   │  │ 99_EXPORT (v3)           │
└──────┬───────┘  └────────────┬─────────────┘
       │ dual-run              │ cutover BLOCKED
       ▼                       ▼ (not canon yet)
┌──────────────────────────────────────────────┐
│                 Mother OS                      │
│ registries · company · recon · 32 Sales daily │
└──────────────────────┬───────────────────────┘
                       ▼ planned
              ┌─────────────────┐
              │  Executive OS   │  (reads contracts only)
              └─────────────────┘
```

---

## Mother OS

| | |
|--|--|
| **Назначение** | Hub: registries, dictionaries, company aggregates, dual-run ingest, reconciliation |
| **Границы** | Не хранит сырые переписки; не SSOT CRM; не считает Executive-прогнозы |
| **Читает** | Sales `99_EXPORT` (dual-run); Bitrix foundation sync; СВОД/Orders sync scripts; env sheet IDs |
| **Пишет** | Tabs `00_*`, `01–08`, `10–12`, `21`, `24`, `30–32`, `50–52`, `60–69`, `99_Bitrix_Map` |
| **Экспорт** | Не child-export; является **приёмником** |
| **SSOT?** | SSOT для **company registry / dual-run surface**, не для Bitrix events |
| **Производная?** | Да, относительно Bitrix + child exports |

Spreadsheet: см. [SPREADSHEETS.md](./SPREADSHEETS.md).

---

## Sales OS

| | |
|--|--|
| **Назначение** | Нормализованный склад CRM-лидов/сделок/оплат + факты + ROP board + export |
| **Границы** | Не GA4 warehouse; prediction front сейчас во **внешней** книге (alignment pending) |
| **Читает** | Mother Foundation 60–69; Maria manual; dialogs links |
| **Пишет** | Child workbook `00–16`, `99_EXPORT` |
| **Экспорт** | `sales_export_v1` → Mother dual-run |
| **SSOT?** | SSOT **нормализованной sales model** для Business OS (после dual-run trust) |
| **Производная?** | Да, от Bitrix via Foundation |

Docs: [business-os/SALES_OS.md](./business-os/SALES_OS.md). Manifest: `src/config/os-manifests/sales-os.ts`.

---

## Traffic OS

| | |
|--|--|
| **Назначение** | Warehouse трафика + identity + management + attribution + GA4 foundation + marketing home |
| **Границы** | Не Ads spend canon; не ROAS/CPL; Mother cutover **blocked** |
| **Читает** | СВОД day/Органика; Sales leads/deals/payments; GA4 Data API; maps |
| **Пишет** | Child workbook `00–36`, `99_EXPORT` |
| **Экспорт** | `traffic_export_v3` (written; Mother not ingesting as canon) |
| **SSOT?** | SSOT **traffic classification & attributed sales linkage** inside Traffic OS |
| **Производная?** | Да, от СВОД + CRM + GA4 |

Docs: [business-os/TRAFFIC_OS.md](./business-os/TRAFFIC_OS.md). Manifest: `src/config/os-manifests/traffic-os.ts`.

---

## Finance OS (planned)

| | |
|--|--|
| **Назначение** | Cash / P&L operational OS (будущее) |
| **Границы** | Не начинать Foundation без Coverage Audit |
| **Читает / пишет / export** | `requires_audit` |
| **SSOT?** | unknown |
| Blueprint | [business-os/FINANCE_OS_BLUEPRINT.md](./business-os/FINANCE_OS_BLUEPRINT.md) |

---

## Product OS (planned)

| | |
|--|--|
| **Назначение** | Product / offer performance (будущее) |
| **Границы** | Mother `06_Products` — stub; catalog source blocked |
| Blueprint | [business-os/PRODUCT_OS_BLUEPRINT.md](./business-os/PRODUCT_OS_BLUEPRINT.md) |

---

## Executive OS (planned)

| | |
|--|--|
| **Назначение** | Управленческие экраны поверх контрактов |
| **Правило** | **Ничего не считает из raw** — только Management/Prediction/Export contracts |
| **ADR** | [decisions/ADR-007-executive-does-not-compute.md](./decisions/ADR-007-executive-does-not-compute.md) |

---

## App UI (Next.js)

Не отдельная OS. Читает snapshots/API sync; роли `admin` / `rop` / `mop`. Карта маршрутов: [`AGENTS.md`](../AGENTS.md).

---

[00_START_HERE](./00_START_HERE.md) · [SYSTEMS](./SYSTEMS.md) · [DATA_FLOW](./DATA_FLOW.md) · [SPREADSHEETS](./SPREADSHEETS.md)
