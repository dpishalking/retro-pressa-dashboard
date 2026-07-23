# Development Guide — building a new OS

How to add a domain OS under Business OS Standard v1. Do **not** skip layers to “ship faster.”

Hub: [00_START_HERE.md](./00_START_HERE.md) · Standard: [business-os/BUSINESS_OS_STANDARD_V1.md](./business-os/BUSINESS_OS_STANDARD_V1.md)

## Order of work

1. **Coverage Audit** — what exists in Bitrix / Sheets / GA4 / app; gaps; SSOT.
2. **Foundation (Warehouse)** — evidence grain, IDs, maps, DQ; no fake forecasts.
3. **Management** — facts, alerts, join quality, operating views.
4. **Prediction** — plan / run-rate / `gap_to_plan`; isolated from warehouse grain.
5. **Dashboard** — app screen and/or sheet Home; Russian UI.
6. **Export** — versioned `99_EXPORT` (`<domain>_export_vN`); contract tests.
7. **Mother Integration** — dual-run first; cutover only after policy + audit.
8. **Executive Integration** — read contracts only (ADR-007); no raw recalculation.

## Engineering checklist

- [ ] Manifest under `src/config/os-manifests/`
- [ ] Types / validators as needed
- [ ] Sync route or script; separate loading states in UI
- [ ] Docs: OS overview + playbook + audit + dual-run if Mother-facing
- [ ] Update [SYSTEMS.md](./SYSTEMS.md), [SPREADSHEETS.md](./SPREADSHEETS.md), [DATA_FLOW.md](./DATA_FLOW.md), [READINESS.md](./READINESS.md)
- [ ] ADR if architectural choice is new
- [ ] Auth: middleware + `canAccessRoute` for new routes
- [ ] Never commit `data/**`, `.env*`

## Templates

Use [business-os/templates/](./business-os/templates/) and `src/templates/os/` if present.

## Anti-patterns

- Writing Mother from internal child tabs (bypass `99_EXPORT`)
- Mixing warehouse and prediction grains in one sheet
- Silent zeros as “plan”
- Public API without explicit product request
