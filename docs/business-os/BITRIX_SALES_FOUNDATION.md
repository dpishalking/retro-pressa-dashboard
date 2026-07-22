# Bitrix Sales Foundation (staging 60–69)

Technical staging layer for Bitrix CRM facts inside the mother workbook.
Not a Sales OS dashboard. No forecasts, weighted probabilities, or KPI UI.

## Spreadsheet

Mother: `1iahEEemT9KusDJts9HxtgdjRFy7AViG_QqzJDtsQEu8`

## Tabs

| Tab | Grain | Primary key | Source |
|-----|-------|-------------|--------|
| `60_Bitrix_Leads_Raw` | lead | `lead_id` | `crm.lead.list` |
| `61_Bitrix_Deals_Raw` | deal | `deal_id` | `crm.deal.list` + productrows |
| `62_Bitrix_Contacts_Raw` | contact | `contact_id` | `crm.contact.get` (batch) |
| `63_Bitrix_Stage_History` | stage event | `event_id` | `crm.stagehistory.list` |
| `64_Bitrix_Stages` | stage | `stage_id` | `crm.dealcategory.stage.list` |
| `65_Bitrix_Pipeline` | open deal snapshot | `deal_id` + `snapshot_date` | active deals (`STAGE_SEMANTIC_ID=P`) |
| `66_Bitrix_Activities` | activity | `activity_id` | `crm.activity.list` |
| `67_Bitrix_Dialog_Links` | open-line session | `session_id` | CRM OL activities + `imopenlines.session.history.get` (counts only) |
| `68_Bitrix_Field_Catalog` | field | `entity_type` + `field_id` | `crm.*.fields` |
| `69_Bitrix_Data_Quality` | period × entity × field | composite | derived fill-rate |

Working OS report tabs are not overwritten. Only Registry / Data_Sources / Sync_Runs / Change_Log may be updated.

## Customer key

Priority: `contact:{id}` → `phone:{sha256(normalized)}` → `email:{sha256(normalized)}` → `lead:{id}` → `deal:{id}`.

Contacts sheet:

- open phone/email are **not** written;
- `phone_hash` / `email_hash` use sorted normalized values; first after sort is primary;
- `duplicate_group_key` is analytical only (no auto-merge).

## PII

Stored: Bitrix IDs, timestamps, hashes, presence flags, subjects truncated, message **counts**.
Not stored: open phones, emails, message bodies, email bodies.

## Sync order

1. field_catalog  
2. stages  
3. leads  
4. deals  
5. contacts  
6. stage_history  
7. pipeline  
8. activities  
9. dialog_links  
10. data_quality  

## Commands

```bash
npm run sync:bitrix-sales-foundation:dry
npm run sync:bitrix-sales-foundation
npm run sync:bitrix-fields
npm run sync:bitrix-contacts
npm run sync:bitrix-stage-history
npm run sync:bitrix-pipeline
npm run sync:bitrix-data-quality
```

API (admin/rop session):

```http
POST /api/sync/bitrix-sales-foundation
{
  "periods": ["2026-05", "2026-06", "2026-07"],
  "modules": ["all"],
  "dryRun": true
}
```

Parallel run returns HTTP 409.

## Dry run

Fetches Bitrix, normalizes, validates schemas in memory, computes fill-rate, writes **nothing** to Google Sheets.

## Webhook scopes needed

- CRM (`crm`) — leads, deals, contacts, stagehistory, activity, dealcategory stages, fields
- Users (`user`) — assigned names
- Open Lines (`imopenlines`) — session history counts (optional; module becomes `partial` if denied)
- Chat (`im`) — only if portal requires it for OL history

## Config

`src/config/sales-foundation.ts` — tabs, columns, field IDs, category, periods, quality thresholds, sync order.

## Local snapshots

`data/bitrix-sales-foundation/` — aggregate run JSON (no open PII). Do not commit.

## Next sprint

Sales OS Data Model v1 (separate workbook / `99_EXPORT`), after staging fill-rates are reviewed.
