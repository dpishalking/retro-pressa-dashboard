# Traffic OS — Source Map

Карта доказательных источников для будущей книги **RP | Traffic_OS**.  
Проба: 2026-07-22, read-only. Статусы полей: `ok` | `partial` | `empty` | `missing` | `conflict` | `unknown`.

---

## A. Spreadsheet registry

| ID | Role | Env |
|----|------|-----|
| `1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8` | Mother | `MOTHER_OS_SPREADSHEET_ID` / `GOOGLE_OS_SHEET_ID` |
| `1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M` | Marketing СВОД | `GOOGLE_TRAFFIC_SHEET_ID` |
| `1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY` | Sales OS | `SALES_OS_SPREADSHEET_ID` |
| `1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820` | Predictive Sales front | `PREDICTIVE_SALES_SPREADSHEET_ID` |
| `1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM` | FB contractor ALX | hardcoded `google-sources` |
| `1TW6WJFQGs-E1TUNLUYKDCULkHDLyagg8tZMCyx--yuA` | FB contractor ART | hardcoded `google-sources` |

---

## B. Source cards

### B1. СВОД · `График`

| Attribute | Value |
|-----------|--------|
| Spreadsheet | Marketing СВОД |
| Sheet | `График` |
| gid | `341885213` |
| Grain | month |
| Primary key | month label (e.g. `мая2026`) |
| Period | monthly rows (~18) |
| Event date | month (not day) |
| Owner | Marketing |
| Update | manual / sheet formulas |
| Canonical scope | **monthly paid media KPI overlay** (spend, SVOD leads, SVOD revenue) — **not** Sales OS money |
| Fields | Месяц, Расход, Выручка, ROAS, Лиды, CPL, Кол-во продаж, CAC, Средний чек |
| Limitations | No campaign/landing/UTM; revenue definition ≠ Bitrix payments |

### B2. СВОД · `day`

| Attribute | Value |
|-----------|--------|
| Grain | day |
| PK | date (`День` in row2/colA pattern; dates `01.01.2026`…`31.12.2026`) |
| Event date | calendar day |
| Owner | Marketing |
| Update | formulas + CRM imports (operational) |
| Canonical scope | **paid media daily spend/clicks + «Лиды CRM» marketing count** |
| Key fields | Расход, Выручка, ROAS, Клики, Лиды CRM, Квал. лиды, CR лендинга, CPL, … |
| Fill | Лиды CRM non-zero ≈202/365 days |
| Limitations | No UTM/campaign/source_id; «CR лендинга» without landing dimension in row |

### B3. СВОД · `Органика`

| Attribute | Value |
|-----------|--------|
| Grain | day |
| PK | date |
| Canonical scope | **organic CRM leads daily (marketing)** |
| Key fields | Выручка, Клики, Лиды, Лиды CRM, Квал. лиды, продажи, … |
| Fill | Лиды CRM non-zero ≈69/365 |
| Limitations | Media metrics often empty; not searchable organic vs social vs direct |

### B4. СВОД · `План/факт`

| Attribute | Value |
|-----------|--------|
| Grain | month × section (ОБЩИЕ / Facebook / Органика / …) |
| PK | section + metric + month |
| Canonical scope | **plans only** (later Traffic plan-fact) — out of Foundation v1 metrics compute |
| Fields | Выручка, Лиды, Счета, Оплаты, конверсии Лид→счет/оплату, AOV |
| Limitations | No deals plan; no traffic_type taxonomy |

### B5. СВОД · contractor / channel tabs

| Sheet | Status | Notes |
|-------|--------|-------|
| `ALX`, `Артем` | partial | contractor slices inside СВОД |
| `Sum_Direct_contractors_{day,week,month}` | partial | rollups |
| `Программатик_{month,week,abdm}` | partial | programmatic |
| `Tizer_Dem` | unknown | needs field audit next sprint |
| `vkADS_MTP*` | conflict | header `#REF!` on probe |
| `week` / `month` / `year` | ok structure | aggregates |
| `справочник` | partial | month calendar; duplicate/wrong «июля2026» rows |

### B6. Mother · `01_Traffic_Daily`

| Attribute | Value |
|-----------|--------|
| Code | `traffic-sync.ts` ← `traffic-connector` ← `google-sources` |
| Grain | date × source_sheet (lead_kind) |
| PK | date + source (+ lead_kind) practical |
| Rows | **41** |
| Columns | `TRAFFIC_COLUMNS`: date, channel, lead_kind, source, campaign, country, spend, clicks, leads, qualified_leads, cpl, orders, revenue, data_status, last_sync_at, source_sheet |
| Fill | date/channel/lead_kind/source/leads **ok**; campaign/country **empty**; spend/clicks/cpl **partial** (~51%) |
| Channel values | `paid_social` (21), `organic` (20) |
| Canonical scope | thin mother bridge — **not** Traffic OS raw |
| Limitations | Does not ingest full СВОД `day` 365; no UTM; no landing |

### B7. Mother · `Органика`

| Attribute | Value |
|-----------|--------|
| Grain | same as traffic organic filter |
| Rows | 20 |
| Canonical scope | organic subset of B6 |

### B8. Mother · `11_Channels`

| Attribute | Value |
|-----------|--------|
| Grain | channel dictionary |
| Rows | 4: `organic_other`, `paid_social`, `unknown`, `organic` |
| Canonical scope | starter dict — **insufficient** for target taxonomy |

### B9. Mother · `60_Bitrix_Leads_Raw`

| Attribute | Value |
|-----------|--------|
| Grain | lead |
| PK | `lead_id` |
| Rows | ~3.0–3.5k (period-limited vs Sales OS 10k) |
| Event date | `created_at` |
| Owner | CRM sync (`sync:bitrix-sales-foundation`) |
| Canonical scope | **raw CRM evidence** for Traffic OS `07_CRM_Leads` ingest |
| Field fill (probe) | lead_id/source_id **ok**; UTM ~37–42% **partial**; form_name ~49% **partial**; language_raw **empty**; landing_page/web columns **missing**; source_description ~50% (**often landing URL**) |
| Limitations | No dedicated landing_url column; deal_id empty |

### B10. Mother · `61`–`69` Foundation

| Sheet | Grain | PK | Traffic relevance |
|-------|-------|-----|-------------------|
| `61_Bitrix_Deals_Raw` | deal | deal_id | join lead_id, source_id |
| `62_Contacts` | contact | contact_id | PII hashes only |
| `63_Stage_History` | event | event_id | not traffic |
| `64_Stages` | stage | stage_id | map |
| `65_Pipeline` | open deal | deal_id+date | not traffic |
| `66_Activities` | activity | activity_id | weak |
| `67_Dialog_Links` | session | session_id | messenger context |
| `68_Field_Catalog` | field | entity+field | discover WEB/UF |
| `69_Data_Quality` | period×field | composite | fill monitoring |

### B11. Sales OS · `03_Leads`

| Attribute | Value |
|-----------|--------|
| Grain | lead |
| PK | `lead_id` |
| Rows | **10 024** |
| Event date | `created_at` |
| Canonical scope | **working CRM leads for attribution join** (child Sales OS) |
| Fields | see `LEADS_COLUMNS` — UTM, source_id, form_name, country_raw; **no** landing_url, language, traffic_type |
| UTM unmarked | 55.4% |
| Owner | Sales OS sync from Foundation |

### B12. Sales OS · `04_Deals` / `07_Invoice_Events` / `08_Payment_Events`

| Sheet | Grain | PK | Link fields | Status |
|-------|-------|-----|-------------|--------|
| `04_Deals` | deal | deal_id | lead_id ~94% | ok |
| `07_Invoice_Events` | invoice event | event_id | deal_id 100% | ok |
| `08_Payment_Events` | payment event | event_id | deal_id 100%; amount = paid_revenue atom | ok |

### B13. Sales OS · `99_EXPORT`

| Attribute | Value |
|-----------|--------|
| Grain | date × manager_id |
| Contract | `sales_export_v1` |
| Traffic dims | **none** |
| Canonical scope | Sales → mother only; Traffic OS must have **own** export |

### B14. External contractor books (ALX / ART)

| Attribute | Value |
|-----------|--------|
| Grain | day / week / month + **one sheet per landing URL** (titles = URLs) |
| Canonical scope | media buying evidence; landing inventory |
| Domains observed (titles) | see §D |
| Limitations | not in mother sync path except summary gids in `google-sources` |

### B15. GA4

| Attribute | Value |
|-----------|--------|
| Code | `src/lib/google/ga4-connector.ts` |
| Grain | day × channel / landingPage (API dependent) |
| Fields | sessions, channel group, landingPage, … |
| Local snapshot on probe | **missing** |
| Canonical scope (target) | visits/sessions + landing paths |
| Status | **unknown** until Traffic OS stores snapshots |

### B16. Clarity / UTM JS

| Source | Role | Not |
|--------|------|-----|
| Clarity | UX heatmaps/sessions | CRM attribution |
| `retro-pressa-utm.js` | writes UTM + landing_page into forms | warehouse |

---

## C. Required field matrix (cross-source)

| Field | СВОД day | Mother Traffic | Foundation 60 | Sales 03_Leads | GA4 | Contractor |
|-------|----------|----------------|---------------|----------------|-----|------------|
| date | ok | ok | ok (created_at) | ok | unknown | ok |
| source (utm) | missing | missing | partial | partial | n/a | missing |
| medium | missing | missing | partial | partial | n/a | missing |
| campaign | missing | empty | partial | partial | n/a | unknown |
| content | missing | missing | partial | partial | n/a | unknown |
| term | missing | missing | partial | partial | n/a | unknown |
| source_id | missing | missing | ok | ok | missing | missing |
| form_name | missing | missing | partial | partial | missing | missing |
| landing_url | missing | missing | missing* | missing | unknown | sheet title |
| domain | missing | missing | missing* | missing | unknown | derive |
| country | missing | empty | partial | partial | unknown | missing |
| language | missing | missing | empty | missing | unknown | missing |
| traffic_type | missing | missing | missing | missing | missing | missing |
| channel | missing | partial | missing | missing | partial (API) | missing |
| leads | ok (CRM count) | ok | 1/row | 1/row | missing | partial |
| visits | missing | missing | missing | missing | unknown | missing |
| clicks | ok | partial | missing | missing | missing | partial |
| spend | ok | partial | missing | missing | missing | partial |
| deal_id | missing | missing | empty | missing | missing | missing |
| payment_id | missing | missing | via 08 | via 08 | missing | missing |
| paid_revenue | conflict (Выручка) | conflict | via 08 | via 08 | missing | conflict |

\*Proxy: `source_description` often holds URL (partial).

---

## D. Domains & landings inventory (observed)

### From Foundation `source_description` (top URLs)

- `retro-pressa.com` — `/ru/new`, `/ru`, `/`, `/life`, `/lv`, `/ru/new2`, `/lt/new`, `/ru/individual`, `/pressa`, …
- `retro-pressa.net` — `/`, `/new`
- `yourstorymagazine.com` — `/`, `/new`
- `partypagee.com` — `/new2/ru`

### From ALX sheet titles

- `retro-pressa.com` — `/ru/`, `/ru/new`, `/life`, `/est/new`, `/de/new`, `/es/new`, `/ru/new2`
- `yourstorymagazine.com`
- `retro-pressa.net`
- `partypagee.com` — `/new2/ru`, `/wedding`

### From ART sheet titles

- `familia-studio.com` (+ `/ru_clip`)
- PartyPage / clip landing sheets (`sustavy_clip_day`, `varikoz*`, `premium`)

### From UTM presets (dictionary only)

- `retro-pressa.com/`, `/lv`, `/10ideas`, `/ideas`, `/gifts`

### Forms (`form_name` top)

| form_name | n |
|-----------|---|
| (empty) | 4722 |
| проверить наличие | 3978 |
| Проверить наличие | 1144 |
| Найти газету | 93 |
| заявка с сайта | 84 |
| главная страница | 2 |
| Квиз | 1 |

→ casing duplicate «проверить наличие» = **conflict** for form dimension.

---

## E. Sources & channels inventory (CRM)

### E1. `source_id` top (Sales OS)

| source_id | n | Tentative traffic_type (NOT assigned in prod) |
|-----------|---|-----------------------------------------------|
| WEB | 2468 | unknown / site — needs UTM/referrer |
| UC_SLHKKC | 1612 | **unknown** (not in paid list) |
| UC_PXE40M | 1604 | paid (Instagram) |
| UC_I4VZXD | 1209 | **unknown** |
| UC_RA0GLX | 849 | **unknown** |
| UC_GQ92V4 | 714 | paid (Facebook) |
| WZ WhatsApp… | 459 | messenger |
| WZ Telegram… | 305 | messenger |
| other WZ / UC_* | … | unknown / messenger |
| REPEAT_SALE / EMAIL / CALL | small | excluded / other |

Paid allow-list in code (`PAID_LEAD_SOURCE_IDS`):  
`UC_GQ92V4`, `UC_PXE40M`, `UC_LL4UYE`, `UC_61GF35`, `UC_YY5741` only.

### E2. Mother channel dict vs target taxonomy

| Current | Target taxonomy |
|---------|-----------------|
| paid_social | → `paid` (subset) |
| organic / organic_other | **do not map blindly** → split later |
| unknown | → `unknown` |

Target enums (fixed):  
`paid | organic_social | organic_search | referral | direct | partner | messenger | unknown | excluded`

**Rule:** no guessing — unmapped SOURCE_ID / empty UTM ⇒ `unknown`.

---

## F. Sales OS linkage summary

| Metric | Value |
|--------|-------|
| Leads | 10024 |
| Deals | 4883 |
| Invoice events | 1190 |
| Payment events | 1062 |
| Deals with lead_id | 94.4% |
| Those leads present in 03_Leads | 96.9% |
| Payments with deal_id in 04_Deals | 91.5% |

---

## G. Code map (ingest today)

| Path | Writes |
|------|--------|
| `src/scripts/sync-os-traffic.ts` | Mother Traffic_Daily + Органика |
| `src/lib/google/traffic-connector.ts` | pull marketing sheets |
| `src/config/google-sources.ts` | source list |
| `src/lib/sales-os/svod-plans.ts` | СВОД plans + day/Органика leads |
| `src/lib/sales-os/traffic-channel-facts.ts` | binary paid/organic for predictive |
| `src/lib/bitrix/sales-foundation/*` | 60–69 |
| `src/lib/sales-os/sync.ts` | Sales OS + predictive |
| `src/lib/google/ga4-connector.ts` | GA4 (dashboard) |
| `src/lib/utm-attribution.ts` | GA4×Bitrix landing audit UI |

---

## H. Target book: RP | Traffic_OS (sheet contracts)

> Книга **не создана**. Ниже — целевой контракт для Foundation.

| Sheet | Purpose | Grain | PK | Source | Key fields | Manual | Sync | Quality limits |
|-------|---------|-------|----|--------|------------|--------|------|----------------|
| `00_Readme` | scope, SoT, non-goals | doc | section | human | text | yes | rare | — |
| `01_Settings` | IDs, periods, flags | key-value | key | human+sync | key,value | yes | upsert | — |
| `02_Source_Map` | SOURCE_ID / UTM → traffic_type | mapping row | source_key | human | source_id, utm_*, traffic_type, confidence | **yes** | read-only runtime | unmapped→unknown |
| `03_Landing_Map` | URL → domain, landing_id, product | landing | landing_id / url | human+derive | url, domain, locale, form hints | yes | merge | URL variants |
| `04_Campaign_Map` | campaign keys | campaign | campaign_key | human+UTM | source, medium, campaign, buyer | yes | merge | UTM chaos |
| `05_Traffic_Raw` | paid media daily raw | day×source_sheet×(landing?) | composite | СВОД day + contractors | date, spend, clicks, leads_crm, source_sheet | no | append/upsert | no UTM |
| `06_Organic_Raw` | organic daily raw | day | date | СВОД Органика | date, leads_crm, sales_svod | no | upsert | weak media cols |
| `07_CRM_Leads` | CRM lead evidence | lead | lead_id | Foundation 60 / Sales 03 | utm_*, source_id, form_name, landing_url*, country | no | upsert | landing often proxy |
| `08_Attribution` | lead→traffic_type + keys | lead | lead_id | rules + Source_Map | traffic_type, channel, campaign_key, landing_id, method | no | rebuild | unknown allowed |
| `09_Landing_Fact` | landing×day facts | landing×day | landing_id+date | 07+08+GA4 | leads, visits, cr | no | rebuild | visits gap until GA4 |
| `10_Channel_Fact` | traffic_type×day | type×day | type+date | 08+05 spend alloc rules | leads, spend?, clicks? | no | rebuild | spend alloc TBD |
| `11_Campaign_Fact` | campaign×day | campaign×day | campaign_key+date | 08+maps | leads | no | rebuild | UTM partial |
| `12_Daily_Fact` | company traffic day | day | date | 09–11 | totals by type | no | rebuild | |
| `13_Monthly_Fact` | month rollup | month | month | 12 | totals | no | rebuild | |
| `14_Data_Quality` | fill-rates | period×field | composite | all | fill_rate, status | no | rebuild | |
| `15_Reconciliation` | vs Sales OS / СВОД | check | check_id | Sales 99 + СВОД | delta leads/revenue | no | rebuild | expect deltas |
| `99_EXPORT` | mother feed | date×dims (TBD contract) | export PK | 12/10 | traffic facts only | no | upsert | **no** CPL/ROAS/plan |

\* `landing_url`: normalize from WEB + `source_description` + form capture.

### Taxonomy (locked)

```text
traffic_type:
  paid
  organic_social
  organic_search
  referral
  direct
  partner
  messenger
  unknown
  excluded
```

Unknown stays unknown. No inferred organic_search from empty UTM.

---

## I. What to extract next (data pull list)

Without creating the book yet, extract/store evidence for Foundation v1:

1. Full `60_Bitrix_Leads_Raw` + Sales `03_Leads` field dump (UTM, source_id, form_name, source_description).  
2. Bitrix `WEB` / landing into a staging column (code change later).  
3. СВОД `day` + `Органика` full year as raw tables.  
4. ALX/ART sheet title → landing registry.  
5. GA4 landingPage×date snapshot into `.cache` / data (read-only store).  
6. Complete SOURCE_ID → description map from Bitrix field catalog / CRM UI.  
7. Sales OS payments join keys for reconciliation harness.
