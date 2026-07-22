# Product OS Blueprint

Status: **blueprint only** — not Foundation  
Standard: [BUSINESS_OS_STANDARD_V1.md](./BUSINESS_OS_STANDARD_V1.md)  
Template manifest: `src/config/os-manifests/product-os.template.ts`

## Goal

Own product / SKU / offer performance and export `product_export_v1` — without inventing catalog or margin formulas.

## Layers (planned)

| Layer | Status |
|-------|--------|
| Settings / Registry | planned |
| Warehouse | **blocked** — Mother `06_Products` is title-only |
| Management | blocked |
| Prediction | blocked |
| Dashboard | blocked |
| Export | planned after sources |
| DQ / Reconciliation | planned |

## Sources to audit first (candidate)

| Source | Status |
|--------|--------|
| Mother `06_Products` | blocked / empty |
| Bitrix product / catalog fields on deals | requires_audit |
| Sales OS deal product fields | candidate |
| Production status source | **blocked** (Roadmap) |
| Contractor landing / offer maps (Traffic) | candidate for offer dimension only |
| Returns / complaints systems | unknown |

## Decisions blocked until audit

- Product grain (SKU vs offer vs landing)  
- Margin definition (needs Finance)  
- Production queue linkage  
- Whether Product OS or Production OS owns delivery SLA  

## First sprint (when started)

1. Product Coverage Audit  
2. Decide grain with owners  
3. Warehouse from real catalog source (not empty Mother stub)  
4. Link to Sales orders/deals where evidence exists  
5. `product_export_v1` only after grain locked  

## Questions for process owners

1. What is the product master list today?  
2. Is “product” = Bitrix product, Tilda offer, or print SKU?  
3. Who owns margin — Finance or Product?  
4. Are returns in scope for v1?  

## Export expectation

`product_export_v1` — columns **unknown** until audit.
