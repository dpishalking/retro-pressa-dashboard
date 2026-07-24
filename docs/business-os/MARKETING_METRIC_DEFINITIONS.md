# Marketing Metric Definitions

| metric_id | Definition | Canon source |
|-----------|------------|--------------|
| sessions | Sessions | GA4 Channel Daily (Traffic OS) |
| users | Users | GA4 |
| clicks | Ad clicks | СВОД / contractor only when present |
| leads | CRM / СВОД leads | Traffic Daily / СВОД day — **not** GA4 `generate_lead` |
| deals | Deals created | Sales OS Daily Fact |
| invoice_events | Invoices | Sales OS |
| payments | Payment events | Sales OS |
| paid_revenue | Paid revenue | Sales OS (`os_paid_revenue`) |
| spend | Ad spend | СВОД via Traffic `svod_spend` when present |
| average_check | revenue / payments | Recalculated |
| session_to_lead_cr | leads / sessions | Recalculated |
| lead_to_deal_cr | deals / leads | Recalculated |
| deal_to_invoice_cr | invoices / deals | Recalculated |
| invoice_to_payment_cr | payments / invoices | Recalculated |
| lead_to_payment_cr | payments / leads | Recalculated |
| cpl | spend / paid_leads | Empty if no spend |
| cac | spend / paying customers | Empty if no spend |
| roas | attributed_revenue / spend | Empty if no spend |
| content_units | Content published | Only with confirmed source |

## Do not

- Sum CR / CPL / CAC / ROAS / AOV across days
- Treat GA4 generate_lead as CRM lead
- Use СВОД revenue as finance canon
- Allocate landing spend without allocation rule
- Convert `unknown` traffic to organic
