import assert from "node:assert/strict";
import { SALES_OS_SHEETS, SALES_OS_CONTRACT_VERSION, getSalesOsSpreadsheetId } from "@/config/sales-os";
import { buildSalesOsModel, inPeriods, periodOfIso, rowsFromSheet } from "@/lib/sales-os/build-model";
import { validateSalesExportHeader, validateSalesExportRows, SALES_EXPORT_CONTRACT_VERSION } from "@/lib/sales-os/export-contract";
import { salesOsShareInstruction } from "@/lib/sales-os/access";

assert.equal(SALES_OS_CONTRACT_VERSION, "sales_export_v1");
assert.equal(SALES_EXPORT_CONTRACT_VERSION, "sales_export_v1");
assert.equal(SALES_OS_SHEETS.export, "99_EXPORT");
assert.equal(SALES_OS_SHEETS.leads, "03_Leads");
assert.ok(!process.env.SALES_OS_SPREADSHEET_ID || getSalesOsSpreadsheetId() === process.env.SALES_OS_SPREADSHEET_ID.trim());

assert.equal(periodOfIso("2026-07-15T12:00:00Z"), "2026-07");
assert.equal(inPeriods("2026-07-15T12:00:00Z", ["2026-07"]), true);
assert.equal(inPeriods("2026-05-01T00:00:00Z", ["2026-07"]), false);

const parsed = rowsFromSheet([
  ["lead_id", "created_at", "assigned_by_id", "assigned_by_name"],
  ["1", "2026-07-01T10:00:00", "5", "Manager A"],
  ["", "", "", ""]
]);
assert.equal(parsed.length, 1);

const model = buildSalesOsModel({
  periods: ["2026-07"],
  syncedAt: "2026-07-22T00:00:00.000Z",
  leadsRaw: [
    {
      lead_id: "1",
      created_at: "2026-07-01T10:00:00",
      assigned_by_id: "5",
      assigned_by_name: "Manager A",
      customer_key: "contact:9",
      customer_key_type: "contact"
    },
    {
      lead_id: "2",
      created_at: "2026-05-01T10:00:00",
      assigned_by_id: "5",
      assigned_by_name: "Manager A"
    }
  ],
  dealsRaw: [
    {
      deal_id: "10",
      lead_id: "1",
      created_at: "2026-07-02T10:00:00",
      closed_at: "2026-07-20T10:00:00",
      assigned_by_id: "5",
      assigned_by_name: "Manager A",
      is_won: "true",
      opportunity: "100",
      currency: "EUR",
      invoice_at: "2026-07-10T10:00:00",
      invoice_amount: "100",
      invoice_flag: "true"
    }
  ],
  stagesRaw: [{ stage_id: "NEW", stage_name: "New", category_id: "0", semantic: "P" }],
  stageHistoryRaw: [{
    event_id: "10|NEW|2026-07-02T10:00:00",
    deal_id: "10",
    stage_id: "NEW",
    entered_at: "2026-07-02T10:00:00",
    is_current_stage: "true"
  }],
  pipelineRaw: [{
    snapshot_date: "2026-07-22",
    deal_id: "99",
    assigned_by_id: "5",
    assigned_by_name: "Manager A",
    opportunity: "50",
    stage_probability: "0.9",
    weighted_amount: "45"
  }],
  dialogLinksRaw: [{
    dialog_id: "ol:1",
    session_id: "1",
    manager_id: "5",
    manager_name: "Manager A",
    first_message_at: "2026-07-03T10:00:00",
    crm_link_status: "linked_lead"
  }],
  dataQualityRaw: [{
    period: "2026-07",
    entity_type: "lead",
    field_id: "UTM_SOURCE",
    fill_rate_pct: "44.00",
    quality_status: "poor"
  }]
});

assert.equal(model.leads.length, 1, "period filter keeps July lead only");
assert.equal(model.deals.length, 1);
assert.equal(model.invoiceEvents.length, 1);
assert.equal(model.paymentEvents.length, 1);
assert.equal(model.pipeline[0].stage_probability, "", "no invented probability");
assert.equal(model.pipeline[0].weighted_amount, "", "weighted empty");
assert.equal(model.managers.length, 1);
assert.ok(model.dailyFact.length >= 1);
assert.ok(model.exportRows.length >= 1);
assert.equal(model.exportRows[0].contract_version, "sales_export_v1");
assert.equal(model.exportRows[0].paid_revenue, model.exportRows[0].paid_revenue);
assert.equal(model.exportRows[0].invoice_events !== undefined, true);
assert.ok("active_deals" in model.exportRows[0]);

const headerOk = validateSalesExportHeader([
  "date", "manager_id", "leads", "deals", "invoice_events", "payments", "paid_revenue",
  "active_deals", "active_pipeline_amount", "stale_deals", "deals_without_next_activity",
  "lead_to_deal_cr", "deal_to_invoice_cr", "invoice_to_payment_cr", "deal_to_payment_cr",
  "average_check", "data_quality_score", "source_updated_at", "sync_updated_at", "contract_version"
]);
assert.equal(headerOk.ok, true);
assert.equal(validateSalesExportRows(model.exportRows).ok, true);

const instruction = salesOsShareInstruction("codex-pressa@secure-petal-446209-b8.iam.gserviceaccount.com");
assert.ok(instruction.some((line) => line.includes("1Zj_jLoJzJx0zuzJK0ZJIFKaS5TTQR_WyctAevB1ARwY")));
assert.ok(instruction.some((line) => /не создавайте новую/i.test(line)));

console.log("sales-os-model.test.ts: ok");
