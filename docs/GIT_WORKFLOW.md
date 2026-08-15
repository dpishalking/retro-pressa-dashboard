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

- Default path: commit on `main` and push. That ships to production.
- Use a PR only when the user asks for review, not for a normal task.
- Avoid force-push to `main`

## Release / production

- Push to `main` → GitHub Actions `Deploy Retro Pressa` → Timeweb ([AUTO_DEPLOY.md](../AUTO_DEPLOY.md))
- Do not wait for a separate «деплой» command. Push is the deploy.
- Confirm secrets present in GitHub Secrets
- For sheet cutovers: dual-run → audit → explicit cutover decision

## Agent / Cursor policy

- After a code/config change: commit and `git push origin main` without asking
- Do not write «напиши деплой, если выпускаем»
- No amend of pushed commits without explicit request
- Never commit `.env*`, `data/**`, or snapshots

## Not changing

This document does **not** alter existing deploy workflow YAML or branch protection — documentation only.
