# Business OS — энциклопедия проекта

Главный описательный документ Retro Pressa **Business OS**.  
Вход для людей: [00_START_HERE.md](./00_START_HERE.md).

Связано: [ARCHITECTURE.md](./ARCHITECTURE.md) · [SYSTEMS.md](./SYSTEMS.md) · [business-os/BUSINESS_OS_STANDARD_V1.md](./business-os/BUSINESS_OS_STANDARD_V1.md) · [business-os/ROADMAP.md](./business-os/ROADMAP.md)

---

## Миссия

Собрать операционные данные компании (продажи, трафик, финансы, продукт) в управляемые дочерние OS и сводить их в Mother / Executive **только через versioned export**, без хаоса IMPORTRANGE и без «правды в голове».

## Назначение

| Для кого | Зачем |
|----------|-------|
| ROP / маркетинг / finance | Ежедневные факты и (позже) prediction по своим контурам |
| Owner / CEO | Сводка через Mother / Executive, не через сырой Bitrix |
| Инженер | Восстановимый репозиторий: sync, контракты, docs, tests |

Приложение Next.js (`/hub`, `/analytics`, `/ad-analytics`, `/rop`, …) — **UI и оркестратор sync**, не единственный склад данных. Склад — Google Sheets OS + файловые snapshots (не коммитятся).

## Концепция

```text
Sources (Bitrix, СВОД, GA4, Maria, …)
        ↓
   Child OS (Sales / Traffic / …)
   Warehouse → Management → Prediction → Dashboard
        ↓
   99_EXPORT (versioned contract)
        ↓
   Mother (dual-run → later cutover)
        ↓
   Executive (planned: reads contracts only)
```

Пять логических слоёв каждой OS — см. [BUSINESS_OS_STANDARD_V1.md](./business-os/BUSINESS_OS_STANDARD_V1.md).

## Основные принципы

1. **SSOT по домену** — Bitrix для CRM-событий; дочерняя OS — нормализованная правда домена; Mother не читает внутренние листы ребёнка как канон.  
2. **Только `99_EXPORT`** для обмена child → Mother (или явно документированный export).  
3. **Unknown честный** — не подменять нулём.  
4. **Plan ≠ Fact ≠ Forecast ≠ Scenario** — отдельные типы; NO_PLAN если плана нет.  
5. **Technical default ≠ approved business norm** (`default_not_approved`).  
6. **Dry-run + идемпотентность** перед production sync.  
7. **Минимальный diff / без commit без команды**.  
8. **Документация = часть платформы**, не опция.

## Архитектура (кратко)

| Система | Роль | Статус |
|---------|------|--------|
| Mother OS | Hub registries, dual-run ingest, company aggregates | Active |
| Sales OS | CRM warehouse + facts + export | Active (dual-run) |
| Traffic OS | Traffic warehouse + management + GA4 foundation + export | Active (Mother cutover blocked) |
| Finance OS | — | Planned (blueprint) |
| Product OS | — | Planned (blueprint) |
| Executive OS | — | Planned |
| Production OS | — | Blocked (no stable source) |

Детали границ: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Уровни готовности

Foundation → Management → Prediction → Dashboard Ready — определения в Standard.  
Матрица: [READINESS.md](./READINESS.md).

## Roadmap

Актуальный список: [business-os/ROADMAP.md](./business-os/ROADMAP.md).

Текущий фокус после Governance: **Sales Prediction Layer Alignment**, затем Traffic Prediction (если gates) или Finance Coverage Audit.

## Ссылки на OS

| OS | Документы |
|----|-----------|
| Sales | [SALES_OS.md](./business-os/SALES_OS.md) · [SALES_OS_DUAL_RUN.md](./business-os/SALES_OS_DUAL_RUN.md) · [BITRIX_SALES_FOUNDATION.md](./business-os/BITRIX_SALES_FOUNDATION.md) |
| Traffic | [TRAFFIC_OS.md](./business-os/TRAFFIC_OS.md) · [MARKETING_OS.md](./business-os/MARKETING_OS.md) · [GA4_AUDIT.md](./business-os/GA4_AUDIT.md) |
| Finance | [FINANCE_OS_BLUEPRINT.md](./business-os/FINANCE_OS_BLUEPRINT.md) |
| Product | [PRODUCT_OS_BLUEPRINT.md](./business-os/PRODUCT_OS_BLUEPRINT.md) |

## Ссылки на стандарты

- [BUSINESS_OS_STANDARD_V1.md](./business-os/BUSINESS_OS_STANDARD_V1.md)  
- [METRIC_STANDARD_V1.md](./business-os/METRIC_STANDARD_V1.md)  
- [DATA_QUALITY_STANDARD_V1.md](./business-os/DATA_QUALITY_STANDARD_V1.md)  
- [SYNC_STANDARD_V1.md](./business-os/SYNC_STANDARD_V1.md)  
- [BUSINESS_OS_COMPLIANCE_MATRIX.md](./business-os/BUSINESS_OS_COMPLIANCE_MATRIX.md)  

## Ссылки на операции

[RECOVERY.md](./RECOVERY.md) · [SECURITY.md](./SECURITY.md) · [DEVELOPMENT.md](./DEVELOPMENT.md) · [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) · [REPOSITORY.md](./REPOSITORY.md) · [SPREADSHEETS.md](./SPREADSHEETS.md) · [DATA_FLOW.md](./DATA_FLOW.md) · [ARTIFACTS.md](./ARTIFACTS.md) · [DOCUMENT_INDEX.md](./DOCUMENT_INDEX.md) · [decisions/](./decisions/)

## Code anchors

| Что | Где |
|-----|-----|
| Manifests | `src/config/os-manifests/` |
| Standard types | `src/types/business-os-standard.ts` |
| Compliance validator | `src/lib/business-os/compliance-validator.ts` |
| Sales sync | `src/lib/sales-os/`, `npm run sync:sales-os` |
| Traffic sync | `src/lib/traffic-os/`, `npm run sync:traffic-os` |
| Mother sync | `npm run sync:os-*`, foundation, ingest |

---

[00_START_HERE](./00_START_HERE.md) · [ARCHITECTURE](./ARCHITECTURE.md) · [DOCUMENT_INDEX](./DOCUMENT_INDEX.md)
