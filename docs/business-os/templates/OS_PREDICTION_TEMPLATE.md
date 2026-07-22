# OS Prediction Template

Follow Prediction Layer in [BUSINESS_OS_STANDARD_V1.md](../BUSINESS_OS_STANDARD_V1.md).

## Plan source
status: NO_PLAN | approved | draft

## Fact source
-

## Run-rate method
method:  
calendar: working_days | calendar_days  
include_current_day: true/false  

## gap_to_plan
`run_rate - plan` (positive = above plan)

## Quality gate
prediction_allowed when:

## Explicitly unsupported
- funnel_based without approved probabilities
- SCENARIO labeled as FORECAST
