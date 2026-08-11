# Analytics OS — Sales Cycle & Cohort Maturity

Hub: [00_START_HERE.md](./00_START_HERE.md) · [analytics-os-connections-audit-for-gpt.md](./analytics-os-connections-audit-for-gpt.md)

## Goal

Answer: **are today’s leads bad, or simply not mature yet?**

Three views:

| View | Meaning |
|------|---------|
| **Cash (P&L)** | Payments with `paid_at` in the period |
| **Cohort** | Payments from leads created in the period |
| **Maturity** | How much of cohort CR / revenue already realized by D0…D30 |

## Sources (Phase 1)

Primary runtime source: **`data/bitrix-snapshots/{period}.json`** (merge May–Aug).

- Leads: `DATE_CREATE` in period (+ `recentLeads`)
- Paid deals: WON + `CLOSEDATE` in period → `paidAt`
- Join: `deal.leadId` → lead; fallback contact via deals sharing `contactId`

Mother `60_Bitrix_Leads_Raw` / `61_Bitrix_Deals_Raw` and Sales OS `03/04/08` remain warehouses; Analytics OS does not call Sheets per request.

### Historical backfill

```bash
npx tsx --env-file=.env.local src/scripts/backfill-bitrix-snapshots.ts
```

Refreshes period snapshots without deleting other periods.

Foundation sync for leads/deals now **upserts by `lead_id` / `deal_id`** (merge existing sheet rows before replace) so a short period sync does not wipe older history.

## Definitions

### Lead → WON (`lead_to_won_cycle`)

```text
lead_to_won_hours = first_successful_payment_at − lead.created_at
```

Phase 1 payment truth: Bitrix WON + `CLOSEDATE`.

### Deal → WON (`deal_to_won_cycle`)

```text
deal_to_won_hours = paid_at − deal.created_at
```

Never mixed silently in UI.

### D0 definition (elapsed hours)

| Bucket | Hours |
|--------|------:|
| D0 | [0, 24) |
| D1 | [24, 48) |
| D2–3 | [48, 96) |
| … | … |

Calendar day buckets are **not** used for cycle distribution.

Timezone for cohort calendar keys: **`Europe/Riga`**.

### Join confidence

| Method | Confidence |
|--------|------------|
| `deal.lead_id` → lead | high |
| same `contact_id`, latest lead ≤ payment/deal create, lookback 90d | medium |
| no match | unmatched (`deal_only`) |

### Cohort CR (PARTIAL)

```text
Created Lead CR = paid unique leads (first payment) / created leads in cohort
```

Not unique-phone dedup yet — labeled **PARTIAL**, never “Unique Lead CR”.

### Final revenue window

D30 revenue = Phase 1 “final” for maturity ratios. **Not LTV.**

### Not matured cells

If cohort age &lt; checkpoint → show `—`, never `0`.

## API

`GET /api/analytics/sales-cycle?period=YYYY-MM&cohort_grain=day|week|month`

Session auth (middleware). Read-only.

## UI

- CEO hub compact card → `/os`
- Full contour → `/os/sales-cycle` and `/os/cohorts`
- Also embedded under Funnel

## Known limitations

- ~16–24% WON without `lead_id` → contact fallback / unmatched
- Old snapshots may lack `lead.contactId` (new syncs store it)
- May/June snapshots must be refreshed for full history (use backfill script)
- Forecast needs ≥5 D30-mature cohorts (`SALES_CYCLE_MIN_MATURE_COHORTS`)
- Repeat / LTV / CAC payback = Phase 2

## Code

| Piece | Path |
|-------|------|
| Engine | `src/lib/analytics-os/sales-cycle/` |
| API | `src/app/api/analytics/sales-cycle/route.ts` |
| UI | `src/components/analytics-os/sales-cycle-panel.tsx` |
| Tests | `src/tests/sales-cycle.test.ts` |
