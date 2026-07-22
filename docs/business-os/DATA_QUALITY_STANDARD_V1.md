# Data Quality Standard v1

Companion to [Business OS Standard v1](./BUSINESS_OS_STANDARD_V1.md).

## Required DQ dimensions

| Dimension | Meaning |
|-----------|---------|
| completeness | Required fields filled |
| validity | Format / enum / range |
| uniqueness | PK uniqueness |
| linkage | Join success to expected keys |
| freshness | Age of source vs SLA |
| mapping_coverage | Classified vs unknown |
| unknown_share | Honest unknown ratio |
| conflict_share | Conflicting mappings |

## Statuses

`good` | `acceptable` | `poor` | `critical` | `unknown`

## Thresholds

Every threshold:

`threshold_value` · `threshold_source` · `approval_status`

Technical defaults: `approval_status = default_not_approved`

## Confidence (not outcome probability)

`high` | `medium` | `low` | `unknown`

Example logic:

- **high** — verified source, complete key, valid mapping, fresh  
- **medium** — derived but unambiguous; limited completeness  
- **low** — weak signal, incomplete mapping, low sample  
- **unknown** — insufficient data  

## Prediction quality gate

`prediction_allowed = true|false`

If critical inputs fail gate → no FORECAST emission (status blocked / unsupported).

## Alerts (minimum)

`alert_id`, `domain`, `alert_type`, `severity`, `entity_type`, `entity_id`, `metric_id`, `actual_value`, `threshold`, `threshold_status`, `message`, `recommended_action`, `owner`, `status`, `created_at`, `resolved_at`

severity: `info` | `warning` | `critical`  
status: `open` | `acknowledged` | `resolved` | `ignored`

If no approved rule: `recommended_action = review_required`
