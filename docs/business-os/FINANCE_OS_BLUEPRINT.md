# Finance OS Blueprint

Status: **blueprint only** — not Foundation  
Standard: [BUSINESS_OS_STANDARD_V1.md](./BUSINESS_OS_STANDARD_V1.md)  
Template manifest: `src/config/os-manifests/finance-os.template.ts`

## Goal

Give Finance a child OS that owns cash / P&L operational facts and exports a versioned `finance_export_v1` to Mother — without inventing bank or ERP joins.

## Layers (planned)

| Layer | Status |
|-------|--------|
| Settings / Registry | planned |
| Warehouse | requires_audit |
| Management | requires_audit |
| Prediction (plan/cash run-rate) | blocked until plans audited |
| Dashboard | blocked until Management Ready |
| Export `99_EXPORT` | planned (`finance_export_v1`) |
| DQ / Reconciliation | planned |

## Sources to audit first (candidate)

| Source | Status |
|--------|--------|
| Mother `07_Finance_Daily` | requires_audit |
| Existing `sync:os-finance` / finance mapper | requires_audit |
| Payroll Google sheets (env ids) | requires_audit |
| Bank statements / payments export | unknown |
| Sales `paid_revenue` / payment events | candidate (linkage only) |
| Maria cash truth | candidate / unknown |

Do **not** mark any of these as approved canon in this sprint.

## Decisions blocked until audit

- Chart of accounts / cost centers  
- Cash vs accrual definitions  
- Working-day calendar for run rate  
- Approved monthly plans owner  
- Currency conversion rules  
- What Mother may ingest from Finance  

## First sprint (when started)

1. Finance Coverage Audit (sources, grains, owners)  
2. Manifest filled (leave template until spreadsheet exists)  
3. Warehouse skeleton + DQ + Reconciliation  
4. `finance_export_v1` contract + dry-run sync  
5. **No** predictive until plans approved  

## Questions for process owners

1. What is the single cash-in source of truth?  
2. Who approves monthly plan?  
3. Are payroll and bank in scope for v1?  
4. Which metrics are lagging vs leading for finance ops?  
5. What must Executive see weekly vs monthly?  

## Export expectation

`finance_export_v1` — grain and columns **unknown** until audit. Placeholder only.
