# Traffic Identity Report

Sprint: **Identity Layer** for Traffic OS  
Periods: `2026-05`, `2026-06`, `2026-07`  
Workbook: `1jBUvTiDC-m9xK6ho0TJky2CLEWIMwrrDpjT1dvZA9Wg`  
Code: `src/lib/traffic-os/taxonomy.ts`, `country-map.ts`, `source-map.ts`, `landing-map.ts`, `build-model.ts`

Constraints honored: no forecasts, no CPL/CAC/ROAS, no dashboard/UI, no Mother cutover, no invented classifications.

---

## 1. Before → After (coverage)

| Metric | Before (Foundation) | After (Identity) |
|--------|---------------------|------------------|
| Unknown % | **67.25%** | **14.50%** |
| Landing Coverage | 42.27% | 47.70% |
| Channel Coverage | 32.75% | 85.50% |
| Country Coverage | 43.99% (raw filled) | 44.84% (**ISO normalized**) |
| Language Coverage | 0% | 32.58% |
| Deal Linkage | 44.47% | 44.47% |
| Revenue Linkage | 7.50% | 7.50% |
| Source Coverage | 100% | 100% |
| Campaign Coverage | 40.11% | 44.64% |
| UTM pair | 44.45% | 44.45% |

Leads in scope: **10 024**. Fully attributed (source + landing + campaign evidence): **~35.2%**.

Deal / revenue linkage unchanged — Identity Layer does not change Sales join grain.

---

## 2. What was found

### Bitrix SOURCE catalog (verified)

| SOURCE_ID | Name | traffic_type | channel |
|-----------|------|--------------|---------|
| `UC_I4VZXD` | WhatsApp | messenger | WhatsApp |
| `UC_MA9866` | Telegram retro-pressa | messenger | Telegram |
| `UC_LKPUT4` | В ручную | offline | Offline |
| `EMAIL` | E-Mail | email | Email |
| `WEB` | Website Retro Pressa.com | **unknown** (without UTM) | Website |
| Many `UC_*` | Landing URL as name | **unknown** (without UTM) | Website |
| Paid allow-list Facebook/Instagram | Meta | paid | Meta Ads |

### Bitrix country enum (`UF_CRM_1737995147`)

`country_raw` stores **enum IDs** (e.g. `1402`), not names. Catalog of 57 values mapped ID → Russian label → ISO code (`LV`, `RU`, …). Unmapped IDs stay empty / unknown — no invention.

### Residual unknown UTM (honest)

| UTM pair | Leads (approx.) | Decision |
|----------|-----------------|----------|
| empty \| empty | ~900+ | No evidence → unknown |
| `instagram\|social` | ~412 | Ambiguous (organic vs paid) → **unknown** |
| `ig\|social` | ~25 | Same → **unknown** |
| Meta placement + `cpc` (`instagram_reels\|cpc`, …) | classified | Evidence → **paid / Meta Ads** |
| Broken macros (`cpc\|{{placement}}`, …) | small | Insufficient → unknown |

---

## 3. What auto-classified (derived / verified)

- **Messenger** from Bitrix SOURCE (WhatsApp, Telegram connectors)
- **Email / Offline** from Bitrix SOURCE
- **Paid Meta / Google** from UTM when source+medium match documented rules (including Meta placement-in-source + paid medium)
- **Country ISO** from Bitrix enum IDs + name aliases
- **Language** only from URL path prefixes (`/ru/`, `/lv/`, …) or CRM `language_raw` when present
- **Landing / domain / website** from WEB scan: `landing_url`, Bitrix WEB, `source_description`, source name URL, `utm_content` / `utm_campaign`, form hints — without inventing missing landings (`status=missing` for unknown)

Central rules: `src/lib/traffic-os/taxonomy.ts` + `country-map.ts`. Not sheet IF formulas.

---

## 4. What required map enrichment (not guessed)

| Area | Action |
|------|--------|
| `02_Source_Map` | Every observed SOURCE_ID + UTM pair row: name, channel, traffic_type, is_paid, mapping_status, confidence, mapping_rule, comment |
| `03_Landing_Map` | Observed URLs enriched; missing landing = `landing:unknown` / `status=missing` |
| Country | Full Bitrix enum snapshot embedded; text aliases centralized |
| Attribution | `attribution_status`, `attribution_confidence`, `reason` on `08_Attribution` |

Manual overrides in Source Map (`mapping_status=manual`) are preserved on sync.

---

## 5. TOP unknown (after Identity) — honest residual

Sorted by lead count. Classification forbidden without evidence.

| Source | Leads | Share | Why unknown | Auto possible? |
|--------|------:|------:|-------------|----------------|
| `WEB` / Website Retro Pressa.com | ~800+ | ~8% | Website entry point; no clear paid/organic UTM | Only if UTM improves at capture |
| `UC_SLHKKC` /ru/new | ~400+ | ~4% | Landing known; UTM mostly `instagram\|social` | No — ambiguous medium |
| Other named landings (`UC_*` URLs) | small | <2% | Landing known; acquisition type not evidenced | No without UTM/referrer |
| Empty / weak UTM macros | small | <1% | Broken tags | Fix at ad tagging |

**Do not** treat “Facebook sells better” vs “Telegram” as proven for the residual unknown slice — channel comparisons must filter `traffic_type != unknown` or use `attribution_confidence`.

---

## 6. Source Taxonomy (locked)

**traffic_type:**  
`paid | organic_social | organic_search | direct | referral | partner | messenger | email | offline | unknown | excluded`

**channel (human):**  
`Meta Ads | Google Ads | Instagram Organic | Telegram | Threads | Website | SEO | Referral | WhatsApp | Email | Direct | Offline | Unknown | Excluded`

---

## 7. Attribution quality (`08_Attribution`)

Statuses used:

| status | Meaning |
|--------|---------|
| `fully_attributed` | source class + landing + campaign evidence |
| `source_only` | traffic_type/channel known; landing/campaign weak |
| `landing_only` | landing known; traffic_type still unknown |
| `campaign_only` | campaign key present; source class weak |
| `unknown` | no usable identity |
| `conflict` | reserved for contradictory manual vs derived |

---

## 8. Data Quality (`14_Data_Quality`)

Sheet now includes:

- Field coverage: source, channel, landing, campaign, country_raw, country_normalized, language, utm, deal / payment / revenue linkage
- Before → after Identity baseline rows (`IDENTITY_BASELINE` → current)
- Unknown / conflicts / missing landing

---

## 9. What cannot be determined (by design)

1. **Bare WEB / landing SOURCE without UTM** — site of conversion ≠ acquisition channel.  
2. **`instagram|social`** — Bitrix/Meta do not prove paid vs organic.  
3. **Language** when URL has no locale segment and CRM language empty.  
4. **Country** when Bitrix country field empty (path `/ru/` does **not** invent `RU`).  
5. **Revenue attribution parity with Sales calendar** — join grain, not Identity scope.

---

## 10. Readiness for Traffic Management Layer

| Layer | Readiness |
|-------|-----------|
| Warehouse structure | ~85% |
| Identity / attribution trust | ~72% |
| Channel analysis (excl. unknown) | **usable** for paid / messenger / email / offline |
| Landing analysis | **partial** (~48% coverage) |
| Country / language | country OK for filled enums; language only path-based |
| Spend → CRM → revenue management | **not ready** (revenue linkage ~7.5%; no Management Layer yet) |
| Predictive / ROAS / CPL | **out of scope** / blocked until Management Layer + better joins |

**Verdict:** Identity Layer goals met. Management Layer v1 adds sheets 16–22 + `traffic_export_v2`.  
Traffic OS is usable for **classified** channel/landing lead management with coverage warnings.  
**Not** ready for spend governance or predictive until attribution enrichment raises revenue linkage.

Next recommended sprint: **Traffic ↔ Sales Attribution Enrichment v1**.

---

## 11. Sync

```bash
npm run sync:traffic-os:dry -- --periods=2026-05,2026-06,2026-07
npm run sync:traffic-os -- --periods=2026-05,2026-06,2026-07
```

Unit tests: `npx tsx src/tests/traffic-os.test.ts`
