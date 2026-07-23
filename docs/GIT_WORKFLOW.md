# Git Workflow (recommended)

Describes the **recommended** practice used with this repo. Does **not** change CI or hooks.

Hub: [00_START_HERE.md](./00_START_HERE.md) · Deploy: [AUTO_DEPLOY.md](../AUTO_DEPLOY.md)

## Branching

1. Branch from up-to-date `main` (or agreed integration branch): `feature/<topic>` or `cursor/<topic>`
2. Small commits; English messages; why over what
3. Do not commit `data/**` or `.env*`

## Review

- Prefer PR for shared review when multiple people work
- Self-review: dual-run docs, readiness, export version bumps

## Tests

```bash
npm test
# add/update tests when changing calculations or export contracts
```

## Merge

- Merge via PR into `main` when ready for production path
- Avoid force-push to `main`

## Release / production

- Push to `main` → GitHub Actions → Timeweb ([AUTO_DEPLOY.md](../AUTO_DEPLOY.md))
- Confirm secrets present in GitHub Secrets
- For sheet cutovers: dual-run → audit → explicit cutover decision

## Agent / Cursor policy

- Commit and push **only on explicit user request**
- No amend of pushed commits without explicit request

## Not changing

This document does **not** alter existing deploy workflow YAML or branch protection — documentation only.
