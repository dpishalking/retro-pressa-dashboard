# Traffic OS — Roadmap

Дочерняя система **RP | Traffic_OS**.  
Опирается на `TRAFFIC_OS_COVERAGE_AUDIT.md` и `TRAFFIC_OS_SOURCE_MAP.md`.  
Проба данных: 2026-07-22.

## Non-goals (сейчас запрещено)

- прогнозы / PTF  
- plan-fact UI и планы в расчётах  
- CPL / CAC / ROAS / ROMI как канон Traffic OS  
- weighted attribution  
- AI-рекомендации  
- создание книги / production sync / commit без отдельной команды  

---

## Цель Traffic OS

1. Собрать paid, organic_social, organic_search, referral, direct, partner, messenger, **unknown**.  
2. Резы: channel, campaign, domain, landing, form.  
3. Связка Lead → Deal → Invoice → Payment → Revenue (через Sales OS keys).  
4. Сырая доказательная база.  
5. `99_EXPORT` → mother.  
6. Позже — план-факт и predictive **без выдуманных данных**.

---

## Фактическая карта данных (executive)

```text
Marketing СВОД ──day/Органика/График──► thin Mother 01_Traffic_Daily (41 rows)
        │
        ├── contractors ALX/ART (landing sheets)
        └── План/факт (plans only; later)

Bitrix ──Foundation 60–69──► Sales OS 03/04/07/08 ──99_EXPORT──► Mother (sales)
        │
        └── UTM ~45% · landing_url missing · source_description~URL 50%

GA4 API ──(code)──► ad-analytics UI   ✗ not in OS warehouse yet
```

Binary paid/organic в predictive **≠** целевая taxonomy.

---

## Fill-rate ключевых полей (Sales OS `03_Leads`, n=10 024)

| Field | Rate | Status |
|-------|------|--------|
| lead_id / created_at / source_id | 100% | ok |
| utm_source | 44.6% | partial |
| utm_medium | 44.5% | partial |
| utm_campaign | 40.1% | partial |
| utm_content | 43.9% | partial |
| utm_term | 39.4% | partial |
| form_name | 52.9% | partial |
| country_raw | 44.0% | partial |
| landing_url | — | **missing** |
| visits / spend / clicks on lead | — | **missing** |
| traffic_type | — | **missing** |

Mother Traffic_Daily: campaign/country **0%**; spend/clicks **~51%**.  
Foundation `language_raw`: **0%**.  
Foundation `source_description` (URL proxy): **~50%**.

---

## Domains & landings (observed)

**Domains:** `retro-pressa.com`, `retro-pressa.net`, `yourstorymagazine.com`, `partypagee.com`, `familia-studio.com`, (+ clip/PartyPage ART sheets).

**Landings (examples):** `/ru/new`, `/ru`, `/`, `/life`, `/lv`, `/ru/new2`, `/lt/new`, `/est/new`, `/de/new`, `/es/new`, `/wedding`, familia clips.

Полный список — в Source Map §D.

---

## Sources & channels

- CRM `source_id`: WEB, Meta UC_*, крупные unmapped UC_*, WhatsApp/Telegram WZ, EMAIL/CALL/REPEAT_SALE.  
- Paid allow-list в коде покрывает **23.4%** лидов; остальное сегодня ошибочно зовётся «organic» в predictive.  
- Mother channels: 4 значения — недостаточно.  
- UTM unmarked: **55.4%**.  
- Strong unknown candidate (no paid SOURCE_ID + no UTM): **31.9%**.

---

## Связка с Sales OS

| Вопрос | Ответ |
|--------|--------|
| Lead→Deal→Invoice→Payment? | **Да** (keys доказаны) |
| Revenue канон? | Sales OS `08_Payment_Events` / export `paid_revenue` |
| Channel на payment? | Только через join к lead |
| Sales `99_EXPORT` заменяет Traffic export? | **Нет** |

---

## Gaps (приоритет)

1. Нет книги Traffic OS / нет raw warehouse.  
2. Нет `landing_url` в Sales/Foundation columns (есть proxy + Bitrix WEB в API).  
3. Нет `visits` в OS (GA4 не складируется).  
4. Нет Source Map SOURCE_ID → traffic_type.  
5. Binary paid/organic conflict.  
6. UTM non-compliant (placement in medium).  
7. Mother Traffic_Daily слишком тонкий (41 vs 365).  
8. СВОД revenue ≠ Sales revenue.  
9. vkADS `#REF!`.  
10. Foundation row volume < Sales OS leads (period cut).

---

## Risks

| Risk | Impact |
|------|--------|
| Записать empty UTM как organic_search | ложные решения по каналам |
| Использовать СВОД Выручка как Traffic revenue | расхождение с Sales OS |
| Расширить paid SOURCE_ID «по ощущению» | скрытый unknown |
| Строить CPL/ROAS до SoT | неверные приоритеты бюджета |
| Тянуть Sales predictive binary в Traffic OS | путаница taxonomy |
| IMPORTRANGE mesh между книгами | хрупкость (запрещено архитектурой mother) |

---

## Фазы (после Foundation)

| Phase | Content | Exit criteria |
|-------|---------|---------------|
| **0 — Audit** | этот пакет документов | done 2026-07-22 |
| **1 — Foundation v1** | книга + raw + maps + quality + export stub | see sprint below |
| **2 — Attribution v1** | rules engine → `08_Attribution`, unknown preserved | ≥95% leads classified or explicitly unknown |
| **3 — Facts v1** | Daily/Channel/Landing/Campaign facts + Sales reconcile | deltas explained |
| **4 — GA4 visits** | sessions into Landing_Fact | visits not null for main domains |
| **5 — Plan-fact** | only after SoT stable | plans from СВОД, no invented deals |
| **6 — Predictive traffic** | optional; no fake CR | explicit data contracts |

---

## Один следующий спринт: Traffic Foundation v1

**Цель спринта:** создать доказательный каркас Traffic OS **без** метрик эффективности рекламы и без predictive.

### Deliverables

1. **Создать книгу** `RP | Traffic_OS` (отдельная команда на создание; не в этом аудите).  
2. Листы: `00_Readme`, `01_Settings`, `02_Source_Map`, `03_Landing_Map`, `04_Campaign_Map`, `05_Traffic_Raw`, `06_Organic_Raw`, `07_CRM_Leads`, `14_Data_Quality`, `15_Reconciliation` (скелет), `99_EXPORT` (контракт-заглушка).  
3. **Seed `02_Source_Map`:**  
   - все `PAID_LEAD_SOURCE_IDS` → `paid`;  
   - WZ WhatsApp/Telegram → `messenger`;  
   - EMAIL/CALL/REPEAT_SALE → `excluded` или отдельный rule;  
   - WEB и все прочие UC_* → `unknown` until labeled.  
4. **Seed `03_Landing_Map`:** URL из ALX/ART titles + top `source_description`.  
5. **Ingest read-path (dry-run first):**  
   - СВОД `day` → `05_Traffic_Raw`;  
   - СВОД `Органика` → `06_Organic_Raw`;  
   - Sales/Foundation leads (+ `source_description` / WEB) → `07_CRM_Leads`.  
6. **`14_Data_Quality`:** fill-rate UTM, source_id, form_name, landing_url, unknown share.  
7. **`15_Reconciliation`:** leads(day) Traffic Raw CRM vs Sales OS daily lead counts; list deltas (не «чинить» молча).  
8. **`99_EXPORT` contract draft** (columns only): date, traffic_type, leads, … — **без** CPL/ROAS/plan.  
9. Документация: обновить `ARCHITECTURE.md` ссылкой на эти три файла.

### Explicitly out of sprint

- `08_Attribution` full rebuild (можно stub column `traffic_type=unknown`)  
- `09`–`13` fact sheets (headers only optional)  
- GA4 production pipeline  
- Predictive / plan  
- Mother cutover onto Traffic export  

### Sprint success metrics

| Metric | Target |
|--------|--------|
| Source_Map covers 100% of observed SOURCE_ID values | each row has traffic_type or unknown |
| CRM_Leads row count ≈ Sales OS leads for same periods | delta explained in Reconciliation |
| landing_url fill on CRM_Leads | >40% via WEB/description normalize (measure, don’t invent) |
| unknown share reported daily | published in Data_Quality |
| Zero CPL/ROAS/plan columns in EXPORT v0 | enforced by contract test |

### Suggested owners

| Workstream | Owner type |
|------------|------------|
| Sheet book + contracts | Solution Architect |
| Source_Map labeling | Marketing + ROP |
| Ingest connectors | Data / Engineering |
| Landing_Map | Marketing ops |
| Reconciliation vs Sales OS | Data Architect |

---

## Команды (справочно, не запускать в рамках аудита)

```bash
# existing related (do not use to create Traffic OS)
npm run sync:os-traffic
npm run sync:sales-os
npm run sync:bitrix-sales-foundation:dry
```

Новых npm scripts для Traffic OS в этом аудите **нет**.
