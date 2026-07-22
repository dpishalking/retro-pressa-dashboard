# Metric Standard v1

Companion to [Business OS Standard v1](./BUSINESS_OS_STANDARD_V1.md).

## Metric passport (required)

| Field | Description |
|-------|-------------|
| `metric_id` | Stable snake_case id |
| `metric_name` | Human name (Russian UI ok; id English) |
| `domain` | sales / traffic / finance / product / mother |
| `description` | What it measures |
| `value_type` | FACT / PLAN / FORECAST / SCENARIO / UNKNOWN |
| `unit` | eur, count, pct, seconds, … |
| `data_type` | count / currency / percentage / duration / snapshot / status / score |
| `formula` | Text or reference |
| `numerator_metric_id` | For rates |
| `denominator_metric_id` | For rates |
| `date_field` | Event date field |
| `period_rule` | calendar_month / cohort / rolling_n_days |
| `grain` | Entity grain |
| `source_id` | Source system |
| `canonical_scope` | What is included/excluded |
| `owner` | Role |
| `approval_status` | approved / draft / default_not_approved |
| `quality_requirements` | Gate notes |
| `known_limitations` | Honest limits |
| `version` | metric contract version |
| `updated_at` | ISO |

## Aggregation rules

| data_type | Across compatible grain | Across time |
|-----------|-------------------------|-------------|
| count | sum if same definition | sum if event grain allows |
| currency | sum only same currency | sum if event grain allows |
| percentage | **forbidden** — recompute | **forbidden** |
| average / AOV | recompute num/den | recompute |
| snapshot | **forbidden** | **forbidden** |
| score | policy-specific | usually forbidden |

## Naming

Do not use bare `revenue` without source + purpose label  
(`paid_revenue`, `attributed_paid_revenue`, `plan_paid_revenue_eur`, …).

Separate **event-period** vs **cohort** explicitly.

## UNKNOWN

Empty or explicit unknown per contract. Never silent `0` for unknown.
