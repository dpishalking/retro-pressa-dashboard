# GA4 Audit — Google Analytics Foundation v1

Workbook target: Traffic OS `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg`  
Discovery run: `2026-07-22` (Data API + Admin API, read-only)  
Contract planned: `ga4_foundation_v1`

## Executive verdict

| Item | Status |
|------|--------|
| GA4 Data API в репо | **Есть** (`src/lib/google/ga4-connector.ts`) |
| Service Account | **Есть** (JWT, scope `analytics.readonly`) |
| OAuth user flow | **Нет** |
| Measurement Protocol | **Нет** (и не нужен для read-foundation) |
| Property в env | **1** — `GA4_PROPERTY_ID=482241067` |
| Properties в аккаунте SA | **1** — `Retro-Pressa` |
| Data streams | **1** WEB — `G-TW8NGKESCL` → `https://retro-pressa.com` |
| Traffic OS warehouse | **Не подключён** (только `/ad-analytics` + снапшоты) |
| Mother / Sales OS | Не менять в этом спринте |

**GA4 уже используется как UI-источник ad-analytics, но не как сырьё Traffic OS.**

---

## 1. Credentials & secrets

| Item | Where | Notes |
|------|-------|-------|
| `GA4_PROPERTY_ID` | `.env.local` / `.env.example` | Numeric property id |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `.env.local` | SA for Sheets + Analytics |
| `GOOGLE_PRIVATE_KEY` | `.env.local` | JWT signing |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | optional | Not set locally; EMAIL+KEY used |
| Measurement ID | Admin API only | `G-TW8NGKESCL` — **not in env** |
| OAuth client | — | Absent |
| GA4 API secret (MP) | — | Absent |

Secrets live only in `.env.local` / server env / GitHub Secrets — not in git.

---

## 2. Properties & streams

### Account

- Account: `accounts/349240386` — **Retropressa**
- Visible properties for SA: **1**

### Property

| Field | Value |
|-------|-------|
| Property ID | `482241067` |
| Display name | Retro-Pressa |
| Time zone | `Europe/Riga` |
| Currency | EUR |
| Type | PROPERTY_TYPE_ORDINARY |

### Data stream

| Field | Value |
|-------|-------|
| Stream | `properties/482241067/dataStreams/10398937603` |
| Type | WEB_DATA_STREAM |
| Measurement ID | `G-TW8NGKESCL` |
| Default URI | `https://retro-pressa.com` |
| Connected | Yes (live data May–Jul 2026) |
| API Access | Yes (Data API + Admin API readonly) |
| Last data probed | Through `2026-07-21` |

---

## 3. Site map (Retro Pressa)

### Observed in GA4 (May–Jul 2026)

| Domain | Sessions | Users | Views | In GA4 stream | Active |
|--------|---------:|------:|------:|:-------------:|:------:|
| `retro-pressa.com` | 66 465 | 60 777 | 84 604 | Yes | Yes |
| `project9147165.tilda.ws` | 3 | 3 | 4 | Yes (noise) | Tiny |

### Known business domains (Traffic OS / Bitrix taxonomy) vs GA4

| Domain | In CRM/Taxonomy | In GA4 hostName | Gap |
|--------|:---------------:|:---------------:|-----|
| `retro-pressa.com` | Yes | Yes | — |
| `retro-pressa.net` | Yes | **No** | Not in this property |
| `partypagee.com` | Yes | **No** | Not connected |
| `familia-studio.com` | Yes | **No** | Not connected |
| `story-passport.com` | Yes | **No** | Not connected |
| `yourstorymagazine.com` | Roadmap | **No** | Not connected |
| `retro-pressa.by` (repeat-sale) | Excluded ops | **No** | Expected |

**Conclusion:** текущий GA4 property покрывает **только основной сайт** `retro-pressa.com` (+ крошечный Tilda). Остальные лендинговые домены **отсутствуют** в этом property.

### Language / country landings on `retro-pressa.com` (top)

| Path | Lang/Country signal | Sessions |
|------|---------------------|--------:|
| `/ru`, `/ru/new`, `/ru/new2` | RU | high |
| `/lv`, `/lv/individual` | LV | high |
| `/life`, `/10ideas`, `/ideas`, `/gifts` | RU marketing | high |
| `/es/new`, `/est/new`, `/lt/new`, `/de/new` | ES/ET/LT/DE | mid–low |
| `/thanks*` | post-lead | mid |

Country/Language в GA4 **не property-level enum** — выводятся из path / landing map.

---

## 4. Events inventory (May–Jul 2026)

| Event | Status | Event count | Notes |
|-------|--------|------------:|-------|
| `page_view` | Есть | 84 608 | Core |
| `session_start` | Есть | 67 181 | Core |
| `first_visit` | Есть | 60 947 | Core |
| `scroll` | Есть | 32 614 | Enhanced measurement |
| `click` | Есть | 3 003 | Generic |
| `generate_lead` | Есть | 5 717 | Key conversion candidate |
| `submit_form` | Есть | 5 034 | Form |
| `video_start` | Есть | 29 790 | |
| `video_progress` | Есть | 4 682 | |
| `video_complete` | Есть | 133 | |
| `click_tg` | Есть | 199 | Custom Telegram |
| `click_whatsapp` | Есть | 40 | Custom WhatsApp |
| `purchase` | **Нет** | 0 | Not observed |
| `view_item` | **Нет** | 0 | |
| `file_download` | **Нет** | 0 | |
| `contact` | **Нет** | 0 | |
| `phone_click` | **Нет** | 0 | |
| `email_click` | **Нет** | 0 | |
| `whatsapp_click` | Частично | — | Есть `click_whatsapp` |
| `telegram_click` | Частично | — | Есть `click_tg` |
| `form_submit` | Частично | — | Есть `submit_form` |

---

## 5. UTM & attribution dimensions (API availability)

| Dimension | In metadata | Sampled in reports | Notes |
|-----------|:-----------:|:------------------:|-------|
| `sessionSource` | Yes | Yes | Filled (facebook, ig, google, direct…) |
| `sessionMedium` | Yes | Yes | cpc / paid / organic / referral… |
| `sessionCampaignName` | Yes | Yes | Often set; some Meta IDs as names |
| `sessionManualAdContent` | Yes | Yes | ≈ utm_content |
| `sessionManualTerm` | Yes | Yes | ≈ utm_term |
| `firstUserSource` | Yes | Not pulled yet | Available |
| `firstUserMedium` | Yes | Not pulled yet | Available |
| `landingPage` | Yes | Yes | Path only |
| `hostName` | Yes | Yes | Needed for multi-domain later |
| `pageLocation` | Yes | Not in foundation v1 grain | Available |
| `pageReferrer` | Yes | Available for DQ | |
| `sessionDefaultChannelGroup` | Yes | Yes | |
| `gclid` | Not as free dim | — | Via Google Ads / traffic source extras; **not CRM-linked today** |
| `fbclid` | Not standard dim | — | Not in GA4 standard schema as first-class |
| `clientId` | Not in Data API dims | — | Needs BigQuery export or User-ID |
| `session_id` | Not joinable to CRM | — | CRM `session_id` = Bitrix chat, not GA4 |

**UTM сохраняется в session-scope.** Качество неоднородно: часть paid идёт как `ig|paid` / `cpc|Instagram_Reels` (перепутанные source/medium).

---

## 6. CRM linkage readiness (GA4 → Traffic OS → Sales OS)

| Key | GA4 | Traffic/Sales OS | Linkable today? |
|-----|-----|------------------|-----------------|
| landing (+ host) | Yes | Partial (`landing_id` from URL/evidence) | **Soft** (date × landing) |
| utm source/medium/campaign | Yes | Partial (~45% leads) | **Soft** |
| date | Yes | Yes (`created_at`) | Soft cohort only |
| client_id | No in CRM | No | **No** |
| GA4 session_id | No in CRM | CRM session_id ≠ GA4 | **No** |
| gclid | Weak/ads | Not stored on lead | **No** |
| fbclid | No | Not stored | **No** |

### What must be done for hard join later

1. **Сайт / GTM:** писать `client_id` (или first-party id) в hidden field формы → Bitrix.  
2. **CRM:** поле `ga_client_id` / `ga_session_id` в lead.  
3. **Опционально:** BigQuery export GA4 для user-level joins.  
4. **Domains:** отдельные streams/properties или один property с всеми доменами + cross-domain.

**Честный coverage v1:** только агрегатное сравнение `generate_lead` (GA4) vs CRM leads по дням/лендингам — **не** user-level attribution.

---

## 7. Sheet numbering decision

Sprint draft proposed `16_GA4_*`…`22_GA4_*`.  
These numbers are **already occupied** by Traffic Management / Alerts (16–22) and Marketing Control (30–33).

**GA4 Foundation sheets (non-colliding):**

| Sheet | Role |
|-------|------|
| `26_GA4_Page_Daily` | fact |
| `27_GA4_Channel_Daily` | fact |
| `28_GA4_Source_Daily` | fact |
| `29_GA4_Campaign_Daily` | fact |
| `34_GA4_Landing_Daily` | fact |
| `35_GA4_Event_Daily` | fact |
| `36_GA4_Data_Quality` | service |

---

## 8. Current ad-analytics usage (not warehouse)

- `POST /api/sync/ga4` → `data/ga4-snapshots/{period}.json`
- UI `/ad-analytics`: channels, campaigns, landings (top-N), daily
- Ask Gemini / UTM audit / daily-sync cron

This remains. Foundation adds **Traffic OS sheets** as the warehouse path.

---

## 9. Gaps summary

### Missing data / connections

- Other domains not in property
- No purchase / ecommerce events
- No phone/email click events
- No hard CRM↔GA4 identity
- No multi-property registry in Settings yet

### Missing engineering (before this sprint’s code)

- Traffic OS ingest of day-grain GA4 facts
- GA4 DQ sheet
- Export aggregates (sessions/views) — not raw GA4 dump
- Map refresh for new host/path/source values without auto-classification

---

## 10. Readiness preview (post-foundation intent)

| Capability | After Foundation v1 |
|------------|---------------------|
| Landing Analytics (visits) | **Ready to start** on `retro-pressa.com` |
| Channel Analytics (sessions) | **Ready to start** |
| Conversion Analytics (GA4 events vs CRM) | **Partial** (soft only) |
| Predictive Traffic | **Blocked** (no spend canon, soft joins, single domain) |

---

## 11. Dry-run (2026-07-22) — not written to sheets

Command: `npm run sync:ga4-foundation:dry`

| Sheet | Rows (dry) |
|-------|----------:|
| `26_GA4_Page_Daily` | 1 643 |
| `27_GA4_Channel_Daily` | 617 |
| `28_GA4_Source_Daily` | 2 007 |
| `29_GA4_Campaign_Daily` | 2 507 |
| `34_GA4_Landing_Daily` | 1 141 |
| `35_GA4_Event_Daily` | 936 |
| `36_GA4_Data_Quality` | 10 |

Coverage snapshot:

- Hard CRM link: **0%**
- Soft landing rows with path: **95.18%**
- GA4 `generate_lead`: **5 772** vs CRM leads **10 024** (Δ −42.4%, different definition)
- Map candidates (unknown, not auto-classified): Source Map +56 / Landing +34 / Campaign +73

**Production sync not executed** — waiting for explicit confirmation.
