# Business OS — Technical Audit (Sprint: Mother Hardening)

**Date:** 2026-07-22  
**Mother:** `1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8`

## What was found

### Auth / Sheets I/O
- Google SA via `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` (`src/lib/google/sheets-client.ts`).
- Writes use `writeSheetValues` with optional `clearRange` then PUT — **not atomic**; clear happens before write.
- No header validation before clear → risk of corrupted headers (already seen: URL in `date` on Sales_Daily).
- `ensureSheetTab` creates missing tabs.
- Manual finance columns preserved via merge in `finance-mapper.ts`.
- Orders manual columns preserved via `ORDERS_MANUAL_COLUMNS` merge.

### Customer identity
- `customer_key` column exists on Orders but mapper sets it to `""`.
- Customers_Core uses `lead:{id}` / `deal:{id}` fallback only.
- Bitrix snapshot **does not** currently store `CONTACT_ID`, phone, or email.

### Paid / aggregates
- Paid = `STAGE_SEMANTIC_ID=S` + `CLOSEDATE` → `payment_status=paid`.
- Sales_Daily = date × manager from Orders activity dates.
- Company_Daily = Traffic + Sales_Daily rollup.
- Finance_Daily = paid Orders + traffic spend + manual payroll/opex.

### Contracts / ops
- Column contracts live in `src/config/os-sheets.ts`.
- Cron: `POST /api/sync/os-daily` (Moscow noon) — orders/traffic → sales/finance → customers/payments/company-daily.
- No Sync_Runs / Data_Sources / Change_Log sheets yet.
- No schema version enforcement on write.
- Tests: `tsx` assert-style in `src/tests/` (including `os-orders-mapper`, `os-finance-mapper`). No lint/typecheck scripts in package.json.

## Implemented already (pre-sprint)
- Mother tabs: Registry, Metrics_Registry, Traffic, Sales_Daily, Orders, Products, Finance, Dialog index, Customers, Payments, Company_Daily.
- Dual revenue awareness started in Metrics_Registry (svod vs os).
- Dialog transcripts stay outside mother.

## Missing (this sprint targets)
1. Stable customer_key (contact/phone/email/lead/deal) + `customer_key_type`
2. Safe write / header protection
3. `00_Data_Sources`, `00_Change_Log`, `00_Sync_Runs`
4. Thin dictionaries Countries / Channels / Employees
5. Expanded Metrics_Registry + Company_Monthly + Reconciliation
6. UI/snapshot metric contracts
7. Sales OS skeleton (types + docs, no live book)
8. Sync mutex / partial failure reporting on os-daily

## Risks
- Full clear+write can wipe a tab if process dies mid-write.
- Expanding Bitrix select with CONTACT_ID requires snapshot refresh for keys to improve beyond lead/deal.
- Renaming Customer columns may break anyone reading old headers (mitigate via schema validation).

## Files expected to change
- `src/config/os-sheets.ts`
- `src/lib/os-sheets/*` (safe-write, identity, registries, monthly, recon, sync updates)
- `src/lib/bitrix/snapshot-store.ts`, `connector.ts` (CONTACT_ID)
- `src/app/api/sync/os-daily/route.ts`
- `src/scripts/sync-os-core.ts`, package.json tests
- `src/tests/os-*.test.ts`
- `docs/business-os/*.md`
- `src/lib/sales-os/*` skeleton
- Optional: snapshot/UI metric label helpers
