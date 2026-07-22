# Sync Standard v1

Companion to [Business OS Standard v1](./BUSINESS_OS_STANDARD_V1.md). Existing ops notes: [SYNC.md](./SYNC.md).

## Sync run contract

`sync_id`, `sync_name`, `domain`, `source`, `target`, `started_at`, `finished_at`, `status`, `rows_read`, `rows_written`, `rows_skipped`, `rows_rejected`, `contract_version`, `source_updated_at`, `error_code`, `error_message`, `trigger_type`

status: `running` | `success` | `partial` | `failed` | `skipped`

## Mandatory rules

1. **Dry-run** supported before production write  
2. **Idempotent** re-run (same PK → same logical state)  
3. **Schema / header validation** before replace  
4. **Mutex** per OS sync (no parallel writers)  
5. **Retry / backoff** on quota (e.g. Sheets 429)  
6. On failure: **preserve previous good data** when possible  
7. **No destructive clear** before validation  
8. Partial module failure must be visible (`partial` / errors[])  
9. **Secrets never logged**  
10. Manual fields preserved  

## Reconciliation contract

`period`, `scope_id`, `metric_id`, `source_a`, `value_a`, `source_b`, `value_b`, `delta`, `delta_pct`, `definition_status`, `status`, `difference_reason`, `checked_at`

status: `matched` | `within_tolerance` | `expected_difference` | `mismatch` | `pending_definition` | `missing_source` | `stale_source`

Never silently “fix” a mismatch by rewriting facts.
