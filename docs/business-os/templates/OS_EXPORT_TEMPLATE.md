# OS Export Template

## Sheet
`99_EXPORT`

## Version
`{{domain}}_export_v1`

## Grain
-

## Primary key
-

## Columns
| column | type | notes |
|--------|------|-------|
| contract_version | string | required |
| source_updated_at | ISO | required |
| sync_updated_at | ISO | required |
| data_quality_score | number | required |

## Mother ingest
enabled | dual_run | blocked

## Compatibility
Breaking change ⇒ bump version + migration note + contract test.
