# Business OS Compliance Matrix

Standard: [BUSINESS_OS_STANDARD_V1.md](./BUSINESS_OS_STANDARD_V1.md)  
Audit: [BUSINESS_OS_CURRENT_STATE_AUDIT.md](./BUSINESS_OS_CURRENT_STATE_AUDIT.md)  
Manifest validator: `src/lib/business-os/compliance-validator.ts`

Manifest results (code):

| OS | Manifest status |
|----|-----------------|
| Sales OS | `partially_compliant` |
| Traffic OS | `partially_compliant` |
| Finance template | `compliant` (template) |
| Product template | `compliant` (template) |

---

## Matrix

| Criterion | Mother | Sales OS | Traffic OS | Standard | Gap | Priority | Migration needed | Blocks Finance OS | Blocks Product OS |
|-----------|--------|----------|------------|----------|-----|----------|------------------|-------------------|-------------------|
| Settings | Yes (00_*) | 01_Settings | 01_Settings | Settings passport + approval | approval_status incomplete | medium | gradual | no | no |
| Registry | Strong (00_*) | Readme only | Readme only | Pointers OK if Mother holds registries | Child sheet registry thin | low | docs pointer | no | no |
| Warehouse | Partial + SF 60–69 | Strong 02–10 | Strong 05–08 + GA4 | Grain/PK/source | Mother product/production stubs | medium | Product/Finance audits | **yes for Product catalog** | **yes** |
| Management | Company/Sales daily | Facts + ROP board | 09–22 Management | Metric passport | Sales mgmt layer uneven | medium | Sales Prediction align first | no | no |
| Prediction | Finance plan cells only | External predictive grid | **Absent** | Prediction contract | Sales not in-OS; Traffic blocked | **high** | Sales Prediction Alignment | no (Finance has own plans) | no |
| Dashboard | Company tabs | ROP Board | Marketing Home | One job / role | OK enough | low | no | no | no |
| Export | Ingests Sales dual-run | `sales_export_v1` | `traffic_export_v3` blocked | Versioned 99_EXPORT | Traffic cutover policy | medium | policy sprint | no | no |
| Data Quality | SF 69 + recon | 11_Data_Quality | 14/23/25/32/36 | DQ dimensions + gates | Fragmented thresholds | medium | docs align | no | no |
| Reconciliation | 50/51/52 | Via Mother | 15 + 21 | Recon contract | Field names vary | low | gradual | no | no |
| Sync | Many scripts | sales-os + ingest | traffic-os modules | Dry-run, mutex, idempotent | Mostly OK | low | no | no | no |
| Manual Fields | Finance manuals | Maria + plans | Source/Landing maps | Preserve manuals | OK pattern | low | no | no | no |
| Docs | ARCHITECTURE + audits | Rich Sales docs | Rich Traffic docs | Linked Standard | This sprint adds Standard | — | done | no | no |
| Manifest | — | `sales-os.ts` | `traffic-os.ts` | Required | Created | — | done | no | no |
| Contract Versioning | Mixed | sales_export_v1 | traffic_export_v3 | `<domain>_export_vN` | Mother tabs less versioned | medium | gradual | no | no |

---

## Critical gaps (fix before / during next domain OS)

### Before Finance OS (mandatory)

1. **Business OS Standard adopted** (this sprint) — templates + blueprints used  
2. **Mother `07_Finance_Daily` Coverage Audit** — what is fact vs plan vs forecast today  
3. **No invented bank/payroll sources** — audit first  
4. **Export version discipline** — first Finance export must be `finance_export_v1` with tests  
5. **Settings approval** — at least document which finance thresholds are `default_not_approved`  

### Before Product OS (mandatory)

1. Product catalog **source** audit (Mother `06_Products` is empty stub)  
2. Link path to Sales orders / production status (production still blocked)  
3. `product_export_v1` contract design after sources known  

### Non-blocking legacy (do not fix now)

- Traffic sheet numbers 09–36 vs Standard bands  
- Sales sheet numbers vs Standard bands  
- Multiple DQ sheet names in Traffic  
- Russian titles on predictive workbook  
- Mother `00_Registry` column polish  

---

## Leading / Lagging candidates (not approved)

See Standard §10. Finance/Product lists remain `requires_audit`.

---

## Next two sprints (recommended)

1. **Sales Prediction Layer Alignment v1** — bring predictive under Prediction contract / OS pointer; NO_PLAN / method / gap sign  
2. **Traffic Prediction Layer v1** — only if quality gates allow; else stay blocked and start **Finance OS Coverage Audit**
