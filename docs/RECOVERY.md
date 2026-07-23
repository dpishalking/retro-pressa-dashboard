# Recovery Guide

If the production server or local environment is lost — restore Business OS without inventing new architecture.

Hub: [00_START_HERE.md](./00_START_HERE.md) · Security: [SECURITY.md](./SECURITY.md)

## 0. Prerequisites

- Access to GitHub repo
- Secrets: `.env` / GitHub Secrets (do not invent values)
- Google Service Account JSON with access to listed sheets ([SPREADSHEETS.md](./SPREADSHEETS.md))
- Bitrix webhook / tokens as used by the project

## 1. Clone

```bash
git clone <repo-url>
cd "Retro Pressa"
npm install
```

Prefer `main` for production; feature branches for WIP.

## 2. Environment

```bash
cp .env.example .env.local
# Fill from secure store — never commit
```

Critical groups (see `.env.example` and [SECURITY.md](./SECURITY.md)):

- Auth / session
- Bitrix
- Google Sheets (service account path or JSON)
- Spreadsheet IDs (`OS_*`, Traffic, Sales, Mother, СВОД, …)
- Gemini / GA4 if used
- Deploy-related only on server

## 3. Service Account

1. Place credentials outside git (path in env).
2. Share each production spreadsheet with the SA email (Editor as required by sync writers).
3. Verify IDs match [SPREADSHEETS.md](./SPREADSHEETS.md).

## 4. Bitrix

1. Confirm webhook URL / app credentials.
2. Run Bitrix sync path used in production (API `/api/sync/bitrix` or scripts documented in [DATA_FLOW.md](./DATA_FLOW.md)).
3. Confirm snapshots under `data/bitrix-snapshots/` (local; not committed).

## 5. Google Sheets / Sync order (typical)

Do not invent a new order — follow existing npm scripts and dual-run docs:

1. Sales Foundation / Sales OS sync (if CRM rebuild needed)
2. Traffic OS sync (`npm run sync:traffic-os` or project equivalent)
3. GA4 foundation (if used): dry-run then live per [GA4_AUDIT.md](./business-os/GA4_AUDIT.md)
4. Mother dual-run / ingest from `99_EXPORT` only where cutover allows
5. Predictive overlays if required by ops

## 6. Verification checklist

- [ ] `npm test`
- [ ] `npm run build` (or deploy pipeline green)
- [ ] Login works (`/` → `/hub`)
- [ ] Mother workbook readable; `99_EXPORT` tabs present on children
- [ ] Sales dual-run status per [SALES_OS_DUAL_RUN.md](./business-os/SALES_OS_DUAL_RUN.md)
- [ ] Traffic Mother cutover still **blocked** unless policy changed
- [ ] No secrets in git status

## 7. Production

Follow [AUTO_DEPLOY.md](../AUTO_DEPLOY.md) and [GIT_WORKFLOW.md](./GIT_WORKFLOW.md).

Push to `main` → GitHub Actions → Timeweb (see deploy workflow). Secrets stay in GitHub Secrets.

## 8. If sheets are wrong but code is fine

1. Do **not** rewrite Business Standard casually.
2. Restore sheet access / SA share.
3. Re-run sync; check `DQ` / Health tabs.
4. Prefer re-export from child OS over hand-editing Mother facts.

## Open / Requires clarification

- Exact production crontab / schedule frequencies — partial in code/docs; confirm with owner.
- Backup cadence for Google Sheets — not fully specified in repo.
