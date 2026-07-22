# Traffic OS — Coverage Audit

**Дата пробы:** 2026-07-22  
**Режим:** read-only (Sheets не изменялись, Traffic OS книга не создавалась, production sync не запускался).  
**Проба:** код `src/lib/**` + live Google Sheets API.

## Verdict

Traffic OS **ещё не существует** как дочерняя книга. Есть разрозненные источники и тонкий mother-слой `01_Traffic_Daily` / `Органика`, плюс Sales OS CRM-воронка. Для полноценной Traffic OS данных **частично достаточно** по paid/organic CRM-лидам и связке Lead→Deal→Payment, но **недостаточно** по visits/sessions, campaign grain, единой taxonomy и landing URL как каноническому полю.

---

## 1. Какие источники существуют

| # | Источник | Spreadsheet | Статус |
|---|----------|-------------|--------|
| A | Marketing СВОД | `1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M` | live, много листов |
| B | Mother Business OS | `1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8` | live |
| C | Sales OS | `1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY` | live |
| D | Bitrix Foundation 60–69 | на Mother | live (staging) |
| E | Facebook подрядчик ALX | `1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM` | live, доступен |
| F | Facebook подрядчик ART | `1TW6WJFQGs-E1TUNLUYKDCULkHDLyagg8tZMCyx--yuA` | live, доступен |
| G | Predictive front | `1_bVqzLXOrIsV9A3UaD7UnRFPYp74FT4kXfw370Cx820` | live (Sales predictive, не Traffic OS) |
| H | GA4 API | через `ga4-connector` / `/api/sync/ga4` | код есть; локальных снапшотов в пробе нет |
| I | Clarity | `clarity-connector` | UX, не CRM attribution |
| J | UTM generator + `public/retro-pressa-utm.js` | сайт | стандарт меток, не warehouse |

Конфиг источников трафика для mother sync: `src/config/google-sources.ts`  
СВОД / mother / Sales OS IDs: `src/config/os-sheets.ts`, `src/config/sales-os.ts`

---

## 2. Какие листы реально заполнены

### 2.1 Marketing СВОД (все вкладки на момент пробы)

| Sheet | Rows (data) | Заполненность (наблюдение) |
|-------|-------------|----------------------------|
| `График` (gid `341885213`) | ~18 | Месячные KPI: Расход, Выручка, ROAS, Лиды, CPL, продажи, CAC, средний чек |
| `day` | 365 календарных дней 2026 | KPI-день; «Лиды CRM» non-zero ≈ 202 дней, sum≈6517 |
| `Органика` | 365 дней 2026 | «Лиды CRM» non-zero ≈ 69 дней, sum≈1343 |
| `week` / `month` / `year` | есть | агрегаты с формулами |
| `План/факт` | ~137 | планы Facebook / Органика / ОБЩИЕ |
| `ALX`, `Артем` | есть | подрядчики внутри СВОД |
| `Sum_Direct_contractors_*` | есть | своды подрядчиков |
| `Программатик_*` | есть | programmatic |
| `Tizer_Dem` | есть | тизеры |
| `vkADS_MTP*` | header `#REF!` на пробе | **conflict / broken formulas** |
| `справочник` | календарь месяцев | есть ошибка строк («июля2026» дважды / июнь-июль) |

### 2.2 Mother

| Sheet | Rows | Комментарий |
|-------|------|-------------|
| `01_Traffic_Daily` | **41** | только paid_social (21) + organic (20); grain day×source sheet, не полный СВОД day |
| `Органика` | 20 | копия organic-строк из traffic sync |
| `11_Channels` | 4 канала | `paid_social`, `organic`, `organic_other`, `unknown` |
| `30_Company_Daily` | live | paid/organic leads + spend + sales |
| `60_Bitrix_Leads_Raw` | ~3000–3500 | period-limited foundation (не весь Sales OS объём) |
| `61`–`69` | live | Sales Foundation |

### 2.3 Sales OS

| Sheet | Rows (проба) | Роль для Traffic |
|-------|--------------|------------------|
| `03_Leads` | **10 024** | UTM, source_id, form_name |
| `04_Deals` | **4 883** | lead_id → deal |
| `07_Invoice_Events` | **1 190** | deal_id |
| `08_Payment_Events` | **1 062** | deal_id, amount |
| `99_EXPORT` | manager×date | **без** channel/campaign/landing |
| `12_Daily_Fact` / `13_Funnel_Fact` | sales grain | не traffic grain |

---

## 3. Paid traffic — что есть

| Слой | Что доказано | Ограничение |
|------|--------------|-------------|
| СВОД `day` / `График` | spend, clicks, CRM leads, sales, revenue, CPL/ROAS (в СВОД) | **не** campaign/adset; revenue в СВОД ≠ Sales OS payment events |
| Mother `01_Traffic_Daily` | day × source «Facebook · сводная подрядчиков», spend/clicks/leads partial | campaign/country **empty** (0%) |
| Sales OS leads | `PAID_LEAD_SOURCE_IDS` = 2 350 / 10 024 (**23.4%**) | список Meta SOURCE_ID узкий |
| UTM на CRM | facebook/instagram/cpc/paid_social часто | **все** 2 350 paid-by-SOURCE_ID в пробе без UTM (`paidSourceNoUtm = 2350`) |
| Подрядчики ALX/ART | отдельные книги + вкладки = URL лендингов | spend/leads по URL-листам не нормализованы в OS |
| Predictive `Продажи — Paid` | Bitrix paid+UTM funnel | binary paid/organic, не Traffic OS |

**Не считать в этом аудите:** CPL/CAC/ROAS как канон Traffic OS (они есть в СВОД, но определения конфликтуют с Sales OS money).

---

## 4. Organic traffic — что есть

| Слой | Что доказано | Ограничение |
|------|--------------|-------------|
| СВОД `Органика` | дневные «Лиды CRM», выручка/продажи в листе | clicks/impressions часто 0 / «-» |
| Mother organic tab | 20 дней из traffic sync | тонкий срез |
| Sales OS | всё, что **не** в `PAID_LEAD_SOURCE_IDS`, сейчас сыпется в «organic» в predictive | **conflict:** WEB, messengers, UC_* без map ≠ organic_search |
| UTM | почти нет для «истинной» органики | empty UTM ≠ organic |

---

## 5. Социальные сети — что есть

| Доказательство | Статус |
|----------------|--------|
| Meta SOURCE_ID (`UC_GQ92V4`, `UC_PXE40M`, …) | ok (paid list в коде) |
| UTM source facebook/instagram/ig/fb | partial (~3 k+ строк с utm) |
| UTM medium placement-like (`Facebook_Mobile_Reels`, …) | **conflict** со стандартом `utm-taxonomy` (`paid_social`/`cpc`) |
| VK ADS листы в СВОД | sheet есть, header `#REF!` → **unknown/broken** |
| TikTok / YouTube в UTM | единичные значения | не warehouse |
| Organic social vs paid social | taxonomy в UTM presets есть; в CRM warehouse **не** проведена |

---

## 6. Лендинги — что есть

| Источник | Поле | Статус |
|----------|------|--------|
| Sales OS `03_Leads` | `landing_url` / `landing_page` / `web` | **missing** |
| Mother `60_Bitrix_Leads_Raw` | `landing_page` / `web` | **missing** как колонки |
| Mother `60_…` `source_description` | часто URL лендинга | **partial** ~50%; top: `/ru/new`, `/ru`, `/`, `/life`, `/lv`, … |
| Bitrix API (`connector`) | `WEB` → `landingPage` | есть в runtime/snapshot Bitrix, **не** в Foundation columns |
| GA4 | dimension `landingPage` | код есть; снапшот в пробе **не найден** |
| UTM presets | `retro-pressa.com`, `/lv`, `/10ideas`, `/ideas`, `/gifts` | словарь, не факт |
| ALX sheet titles | URL доменов/лендингов | inventory подрядчика |
| ART sheet titles | `familia-studio.com`, PartyPage, клипы | inventory подрядчика |
| `form_name` | формы, не URL | partial 53% |

**Вывод:** лендинги **можно восстановить** из `source_description` + подрядческих вкладок + (позже) GA4/WEB, но канонического поля в Sales OS сейчас нет.

---

## 7. UTM — заполненность (Sales OS `03_Leads`, n=10 024)

| Поле | Fill-rate | Статус |
|------|-----------|--------|
| `utm_source` | 44.6% | partial |
| `utm_medium` | 44.5% | partial |
| `utm_campaign` | 40.1% | partial |
| `utm_content` | 43.9% | partial |
| `utm_term` | 39.4% | partial |
| пара source+medium | 44.5% | partial |
| **оба пустые** | **55.4%** | unmarked |

Топ `utm_source` (кроме empty): facebook, cpc, instagram, paid_social, social_paid, ig, fb, …  
Топ `utm_medium`: cpc, social, Facebook_Mobile_Reels, paid_social, Instagram_Reels, …  
→ **conflict** с `utm-standards` / `utm-taxonomy` (placement в medium, source=`cpc`).

---

## 8. Доля unknown / unmarked

Операционные определения для аудита (не финальная taxonomy Traffic OS):

| Сегмент | n | Доля | Комментарий |
|---------|---|------|-------------|
| Нет UTM source и medium | 5 549 | **55.4%** | unmarked UTM |
| Не в `PAID_LEAD_SOURCE_IDS` и без UTM | 3 199 | **31.9%** | сильный кандидат в `unknown` |
| `source_id=WEB` | 2 468 | 24.6% | сайт; без UTM → unknown/direct **не угадывать** |
| Messengers (WZ/WhatsApp/Telegram) | 911 | 9.1% | → `messenger`, не organic_search |
| Крупные `UC_*` вне paid list (`UC_SLHKKC` 1612, `UC_I4VZXD` 1209, `UC_RA0GLX` 849, …) | thousands | — | **unknown until Source Map** |

Mother `11_Channels` уже имеет `unknown`, но Traffic Daily его почти не использует (только paid_social/organic).

---

## 9. Можно ли связать Lead → Deal → Invoice → Payment → Revenue?

| Связка | Доказательство (Sales OS) | Статус |
|--------|---------------------------|--------|
| Lead → Deal | deals with `lead_id`: 94.4%; из них lead найден в `03_Leads`: 96.9% | **ok** |
| Deal → Invoice | invoice events with `deal_id`: 100% | **ok** |
| Deal → Payment | payment with `deal_id`: 100%; deal существует: 91.5% | **ok** (часть платежей вне текущего deals среза) |
| Payment → Revenue | `08_Payment_Events.amount` | **ok** (Sales OS money) |
| Lead.deal_id | колонка в leads **missing** / на raw fill 0% | связь только через deals.lead_id |
| Channel на Payment | нет нативного; только join lead/deal source/utm | **partial** |
| `99_EXPORT` | date×manager aggregates | **не** содержит traffic dims |

**Вывод:** воронка CRM **связываема**. Атрибуция канала на revenue — через join, не через готовый Traffic fact.

---

## 10. Можно ли считать показатели по каналам и лендингам?

| Разрез | Сейчас | Вердикт |
|--------|--------|---------|
| Binary paid/organic (SOURCE_ID ± UTM) | predictive + traffic-channel-facts | partial / conflict |
| Channel taxonomy (paid/organic_search/referral/…) | нет в warehouse | **нет** |
| Campaign | UTM campaign partial; СВОД campaign **empty** в mother | partial |
| Domain / landing | нет канона; proxy `source_description` | partial |
| Form | `form_name` 53% | partial |
| Visits / sessions / clicks by landing | GA4 код; OS sheets **missing** visits | **нет** для Traffic OS |
| Spend by campaign/landing | СВОД/подрядчики day grain | partial, не CRM-joined |

---

## 11. Какие данные отсутствуют (missing)

Обязательные поля аудита:

| Поле | Статус в OS warehouse | Где встречается иначе |
|------|----------------------|------------------------|
| `date` | ok (CRM created_at / СВОД day) | — |
| `source` / `medium` / `campaign` / `content` / `term` | partial (UTM) | — |
| `source_id` | ok | — |
| `form_name` | partial | — |
| `landing_url` | **missing** (канон) | proxy: `source_description`, Bitrix WEB, GA4 |
| `domain` | **missing** | derive from URL |
| `country` | partial (`country_raw` 44%) | mother traffic country empty |
| `language` | **empty** (`language_raw` 0% на raw) | — |
| `traffic_type` | **missing** | binary paid/organic only |
| `channel` | partial / conflict | mother 4 values |
| `leads` | ok | — |
| `visits` | **missing** | GA4 sessions (вне OS) |
| `clicks` | partial (СВОД/mother traffic) | не на lead |
| `spend` | partial (СВОД/mother) | не на lead |
| `deal_id` on lead | missing/empty | на deal ok |
| `payment_id` | event_id на payments | ok как surrogate |
| `paid_revenue` | Sales OS payments / export | ok для sales; conflict со СВОД Выручка |

---

## 12. Конфликты определений (conflict)

1. **«Organic» в predictive** = not `PAID_LEAD_SOURCE_IDS` (+ UTM override). Включает WEB, messengers, неизвестные UC_* → не равно organic_search / organic_social.  
2. **Лиды:** СВОД `day`+`Органика` vs Bitrix `03_Leads` (predictive main overlay vs by-traffic Bitrix-only) → расхождение Paid+Organic vs «Предиктивка».  
3. **Выручка:** СВОД «Выручка» / mother traffic `revenue` vs Sales OS `08_Payment_Events` / `99_EXPORT.paid_revenue`.  
4. **UTM standard** (`utm-taxonomy`) vs фактические medium=placement, source=`cpc`.  
5. **Channel dict** mother (`organic` vs `organic_other`) vs traffic-mapper (`organic` | `paid_social`).  
6. **Paid list** не покрывает крупные SOURCE_ID → ложный organic.  
7. **vkADS** лист с `#REF!`.  
8. **Источник истины планов** СВОД «План/факт» vs invented deals plan в predictive (вне scope Traffic OS, но влияет на «планы трафика»).

---

## 13. Источник истины (предложение канона на метрику)

| Метрика | Canonical source (целевой) | Сейчас использовать осторожно |
|---------|----------------------------|-------------------------------|
| CRM lead fact | Sales OS `03_Leads` / Foundation `60_` | СВОД Лиды CRM — marketing KPI overlay |
| Deal / Invoice / Payment / Revenue | Sales OS `04` / `07` / `08` | не СВОД Выручка |
| Ad spend / clicks (paid media) | СВОД `day` + contractor day sheets | не Bitrix |
| Sessions / visits / landing paths | GA4 (когда снапшот в Traffic OS) | Clarity ≠ conversion |
| UTM raw | Bitrix lead UTM fields as stored | не «исправлять» при ingest |
| traffic_type | **Source Map + rules**, иначе `unknown` | не binary organic |
| Landing URL | Bitrix WEB + normalized `source_description` + GA4 | не form_name |
| Export to mother | будущий Traffic OS `99_EXPORT` | не Sales `99_EXPORT` |

---

## Ответы на контрольные вопросы

1. Источники — §1.  
2. Заполненные листы — §2.  
3. Paid — §3.  
4. Organic — §4.  
5. Social — §5.  
6. Landings — §6.  
7. UTM — §7.  
8. Unknown — §8 (~55% без UTM; ~32% без paid SOURCE_ID и без UTM).  
9. Lead→Payment — **да** (§9).  
10. Channel/landing metrics — **частично / пока нет** для полной taxonomy (§10).  
11. Gaps — §11.  
12. Conflicts — §12.  
13. SoT — §13.

См. также: `TRAFFIC_OS_SOURCE_MAP.md`, `TRAFFIC_OS_ROADMAP.md`.
