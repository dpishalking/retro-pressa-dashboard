# Repository Guide

Structure of the Retro Pressa / Business OS codebase.

Hub: [00_START_HERE.md](./00_START_HERE.md) · App map: [`AGENTS.md`](../AGENTS.md)

## Top level

| Path | Role |
|------|------|
| `src/app/` | Next.js App Router — pages + `api/` |
| `src/components/` | Client screens (`*-screen.tsx`) |
| `src/lib/` | Domain logic: auth, bitrix, google, training, business-os, … |
| `src/config/` | Sheet IDs, OS manifests, static config |
| `src/types/` | Shared TypeScript types |
| `src/tests/` | Unit tests (`npm test`) |
| `src/templates/` | OS / code templates |
| `docs/` | Governance + Business OS documentation |
| `scripts/` | CLI sync / audit / verify helpers |
| `data/` | **Local snapshots — do not commit** |
| `.cache/` | **Local cache — do not commit** |
| `.github/workflows/` | Deploy CI |
| `.cursor/rules/` | Agent rules |
| `AGENTS.md` | Project map for agents |
| `AUTO_DEPLOY.md` | Deploy notes |
| `.env.example` | Env template |

## `src/app/api/` (high level)

- Auth: `/api/auth/*` (public)
- Sync: `/api/sync/*` (session)
- Analytics ask, conversations, training, planning, admin
- See `AGENTS.md` for full table

## `src/lib/` (Business OS related)

- `business-os/` — compliance, standard helpers
- `bitrix/` — CRM connectors / foundation
- `google/` — Sheets, GA4, traffic
- Auth, metrics, digital-twin, training, etc.

## `src/config/`

- Spreadsheet ID defaults / env mapping
- `os-manifests/` — Sales, Traffic, …
- OS sheet name constants

## `docs/`

- Hub docs at `docs/*.md` (this governance sprint)
- Deep OS docs at `docs/business-os/`
- ADRs at `docs/decisions/`

## Tests & scripts

```bash
npm test
npm run dev          # 127.0.0.1:4174
# sync scripts — see package.json (traffic-os, ga4-foundation, …)
```

## Not in repo (by design)

Secrets, live sheet contents, conversation dumps, auth user stores under `data/auth/`.
