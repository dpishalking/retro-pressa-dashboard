# Security Guide

Hub: [00_START_HERE.md](./00_START_HERE.md) · Recovery: [RECOVERY.md](./RECOVERY.md)

## Never commit

- `.env`, `.env.local`, `.env.*` (except `.env.example` without secrets)
- Service account JSON / key files
- `data/**` (snapshots, auth stores, exports)
- `.cache/`
- Conversation dumps / PII exports
- Real spreadsheet dumps with customer data

## Service Account

- One SA (or documented set) shared to production sheets only as needed
- Store JSON outside the repo; path via env
- Rotate if leaked; revoke sheet shares for old keys
- Do not embed keys in client bundles

## `.env`

- Local: `.env.local` from `.env.example`
- Production: GitHub Secrets / server env — see [AUTO_DEPLOY.md](../AUTO_DEPLOY.md)
- Spreadsheet IDs may be non-secret but treat webhooks and API keys as secret

## Secrets storage

- Prefer password manager / team vault for SA JSON and Bitrix webhooks
- Do not paste secrets into chat commits or markdown docs

## Backup

- **Code:** git remote
- **Sheets:** Google Drive version history + owner-controlled copies (**cadence Requires clarification**)
- **Snapshots:** local `data/` — operational only, not DR SSOT

## Release safety

- No force-push to `main`
- No `--no-verify` unless explicitly requested
- Do not cut over Mother consumers without dual-run audit
- Public API only with explicit product request + middleware review

## Dialogs / PII

- Raw transcripts stay in dialogs workbook (ADR-003)
- Mother holds pointers only
