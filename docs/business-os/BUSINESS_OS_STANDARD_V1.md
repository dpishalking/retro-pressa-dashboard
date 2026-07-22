# Business OS Standard v1

Canonical architecture for every domain OS in Retro Pressa Business OS.

Related: [Current State Audit](./BUSINESS_OS_CURRENT_STATE_AUDIT.md) · [Compliance Matrix](./BUSINESS_OS_COMPLIANCE_MATRIX.md) · [Metric Standard](./METRIC_STANDARD_V1.md) · [Data Quality](./DATA_QUALITY_STANDARD_V1.md) · [Sync Standard](./SYNC_STANDARD_V1.md) · [Roadmap](./ROADMAP.md)

Code: `src/types/business-os-standard.ts` · `src/lib/business-os/compliance-validator.ts` · `src/config/os-manifests/*`

---

## 1. Purpose

Stop inventing a new architecture per OS.

Finance OS and Product OS must implement this template — not start from zero.

This standard is **logical**. Existing Sales/Traffic sheet numbers are **not** mass-renamed in this sprint.

---

## 2. Five logical layers (+ support)

| Layer | Purpose | External read? |
|-------|---------|----------------|
| **Warehouse** | Raw, staging, normalized, events, maps | Internal only |
| **Management** | Facts, alerts, attention lists | Role UIs; not Mother canon |
| **Prediction** | Plan / fact / run rate / gap / required | Role UIs after quality gate |
| **Dashboard** | Human interface | Never source of truth |
| **Export** | `99_EXPORT` (or documented export) | **Only** official cross-OS exchange |

Support layers:

| Layer | Purpose |
|-------|---------|
| Settings | Config, thresholds, approvals |
| Registry / Readme | What the OS is; pointers to registries |
| Data Quality | Completeness, freshness, unknown, gates |
| Reconciliation | Dual-run / source compare |
| Sync Health | Runs, errors, idempotency |

---

## 3. Settings Layer

Required setting fields:

`setting_id`, `setting_group`, `setting_name`, `setting_value`, `value_type`, `owner`, `approval_status`, `is_active`, `updated_at`

`approval_status`: `approved` | `draft` | `default_not_approved` | `deprecated`

**Rule:** technical default ≠ approved business norm.

---

## 4. Registry / Readme

Minimum concepts (may live on Mother for shared registries):

- OS Readme  
- Sheet Registry  
- Data Sources Registry  
- Metrics Registry  
- Change Log  
- Sync Runs  

Each child OS must **point** to where each registry lives.

---

## 5. Warehouse Layer

Rules:

- clear grain + primary key  
- `source`, `source_updated_at`, `sync_updated_at`  
- missing ≠ silent zero  
- raw not silently “fixed”  
- manual enrichment explicit  
- minimize PII  
- sync idempotent (no duplicate PK)

Table types: `raw` | `staging` | `normalized_core` | `event_log` | `mapping` | `dictionary` | `identity` | `attribution`

---

## 6. Management Layer

Answers: what happened, where deviation, what needs attention, can we trust data.

Metric elements: `metric_id`, `metric_name`, `value`, `value_type`, `period`, `grain`, `source`, `coverage`, `confidence`, `data_quality_status`, `source_updated_at`

Does **not** invent plan/forecast.

---

## 7. Prediction Layer

Contract fields:

`model_id`, `model_name`, `scope_type`, `scope_id`, `period_type`, `period`, `metric_id`, `metric_group`, `metric_role`, `plan_value`, `fact_value`, `run_rate_value`, `gap_to_plan`, `required_value`, `forecast_method`, `forecast_as_of`, `plan_source`, `fact_source`, `confidence`, `status`, `comment`, `sync_updated_at`

`metric_group`: `lagging` | `leading`  
`metric_role`: `result` | `driver` | `conversion` | `capacity` | `quality` | `constraint`  
`value_type`: `FACT` | `PLAN` | `FORECAST` | `SCENARIO` | `UNKNOWN`

Rules:

- PLAN only with confirmed approved source; else `NO_PLAN`  
- FORECAST requires `forecast_method`  
- SCENARIO ≠ forecast  
- UNKNOWN ≠ 0  
- run rate marks incomplete current day  
- % and AOV not summed  
- snapshots not summed over days  
- no forecast if quality gate fails  

### Plan / Fact / Run Rate

**gap_to_plan = run_rate − plan**  
- positive → above plan  
- negative → below plan  

**required_value** (additive): `max(plan − fact, 0)`  
**required_per_remaining_unit**: remaining / remaining working days (not for %/snapshot without formula)

Run-rate methods: `calendar_run_rate` | `working_day_run_rate` | `weekly_pace` | `funnel_based` | `manual_forecast` | `unsupported`

Do not auto-create plan from last year’s fact.  
Do not invent pipeline probabilities without approval.

---

## 8. Dashboard Layer

Reads Management / Prediction / Export-ready facts only.

Declare: `dashboard_id`, `audience`, `purpose`, `source_contracts`, `refresh_frequency`, `critical_metrics`, `drilldowns`, `limitations`

Audiences: CEO, ROP, Marketer, Finance, Product Owner, Analyst  
**One dashboard → one management job.**

---

## 9. Export Layer

Official name: **`99_EXPORT`**

Version: `<domain>_export_v<number>`  
Examples: `sales_export_v1`, `traffic_export_v3`, `finance_export_v1`

Required: `contract_version`, grain, primary key, `source_updated_at`, `sync_updated_at`, `data_quality_score`, confidence/status, column contract + tests

Schema change ⇒ new version + migration note + compatibility decision + contract test.

Mother / Executive **must not** read internal child sheets as canon.

---

## 10. Leading / Lagging

- **Lagging** — realized business result  
- **Leading** — process signal that can be managed to change future lagging results  

Each OS defines its own list after source audit. Candidate groups (not approved Finance/Product lists) — see Compliance Matrix / blueprints.

---

## 11. Manual fields

Types: `business_mapping` | `plan` | `threshold` | `owner` | `comment` | `status_override` | `approval`

Sync must not overwrite manual fields. Owner + `updated_at` required. Mapping overrides preserved.

---

## 12. Naming (new OS)

| Band | Role |
|------|------|
| 00–09 | readme / settings / registries |
| 10–19 | raw / staging / maps |
| 20–29 | normalized / events / attribution |
| 30–39 | management |
| 40–49 | prediction |
| 50–59 | reconciliation / quality / readiness |
| 80–89 | dashboards |
| 99 | export |

Columns: `snake_case` · Dates: `YYYY-MM-DD` · Month: `YYYY-MM` · Boolean: `true`/`false` · Unknown: empty or explicit `unknown` per contract

Existing Sales/Traffic: **migration map only**, no mass rename.

---

## 13. Definition of Done — new OS

**Foundation Ready:** audited sources · manifest · Settings · Registry · Warehouse · normalized core · DQ · Reconciliation · versioned `99_EXPORT` · safe sync · tests · docs  

**Management Ready:** management facts · role summary · alerts · coverage/confidence  

**Prediction Ready:** approved plans · fact · approved run-rate method · quality gate · prediction contract · no fake forecast  

**Dashboard Ready:** stable Management + Prediction contracts · dashboard does not read raw  

---

## 14. Code manifests

| OS | File |
|----|------|
| Sales | `src/config/os-manifests/sales-os.ts` |
| Traffic | `src/config/os-manifests/traffic-os.ts` |
| Finance | `src/config/os-manifests/finance-os.template.ts` |
| Product | `src/config/os-manifests/product-os.template.ts` |

Validator: `validateBusinessOsManifest` — audit/reporting only; does **not** block production sync.
