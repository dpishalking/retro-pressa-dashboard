# Marketing Predictive Model

## Value kinds

| Kind | Meaning |
|------|---------|
| FACT | Confirmed source + period |
| PLAN | Approved in Plan Registry |
| FORECAST | Approved method only |
| SCENARIO | What-if — never labeled forecast |
| NO_PLAN | Plan missing |
| BLOCKED | Method/data insufficient |
| NOT_CONNECTED | Integration off |
| UNKNOWN | Insufficient data (not zero) |

## Forecast methods (v1)

### calendar_run_rate

`fact_to_date / elapsed_days × month_days`  
Additive only: sessions, leads, deals, invoices, payments, revenue, spend (if spend FACT exists).

Timezone: Europe/Riga. Incomplete current day excluded via `resolveForecastAsOf`.

### Funnel forecast

Blocked in v1 unless all CR components + AOV confirmed, definitions aligned, unknown share under threshold.

### Paid / Organic

Paid forecast requires spend + stable mapping.  
Organic: run rate only; no invented content growth.

## Weekly UX

Same chrome as Sales Planning (`layoutForMonth`, `applyPredictiveTemplateDesign`):

- Weeks 1–5 when calendar has dates
- Plan / Fact / Forecast rows
- Month column **МЕС**
- **No** automatic monthly→weekly plan split
- Future weeks: fact empty
- Ratios recalculated from numerators/denominators

## Design reference

Spreadsheet `PREDICTIVE_SALES_SPREADSHEET_ID` / tab **Предиктивка продажи** (gid `419868082`).
