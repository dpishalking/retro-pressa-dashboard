import {
  normalizeEmail,
  normalizePhone,
  resolveCustomerIdentity
} from "@/lib/os-sheets/customer-identity";
import { SchemaMismatchError, preserveManualColumns, validateHeader } from "@/lib/os-sheets/safe-write";
import {
  SALES_EXPORT_CONTRACT_VERSION,
  validateSalesExportHeader,
  validateSalesExportRows
} from "@/lib/sales-os/export-contract";
import { getMetricPresentation } from "@/lib/os-sheets/metric-presentation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// customer identity
assert(normalizePhone("+371 20-000-111") === normalizePhone("0037120000111"), "phone normalization");
assert(normalizePhone("123") === null, "short phone rejected");
assert(normalizeEmail(" A@B.COM ") === "a@b.com", "email normalization");

const byContact = resolveCustomerIdentity({ contactId: "9", phone: "+37120000111", leadId: "1", dealId: "2" });
assert(byContact.customer_key === "contact:9" && byContact.customer_key_type === "contact", "contact wins");

const phoneA = resolveCustomerIdentity({ phone: "+371 2000 0111" });
const phoneB = resolveCustomerIdentity({ phone: "37120000111" });
assert(phoneA.customer_key === phoneB.customer_key && phoneA.customer_key_type === "phone", "same phone hash");
assert(phoneA.customer_key.startsWith("phone:") && !phoneA.customer_key.includes("37120000111"), "phone hashed");

const emailA = resolveCustomerIdentity({ email: "User@Mail.com" });
const emailB = resolveCustomerIdentity({ email: "user@mail.com" });
assert(emailA.customer_key === emailB.customer_key && emailA.customer_key_type === "email", "same email hash");

const byLead = resolveCustomerIdentity({ leadId: "77" });
assert(byLead.customer_key === "lead:77", "lead fallback");
const byDeal = resolveCustomerIdentity({ dealId: "88" });
assert(byDeal.customer_key === "deal:88", "deal fallback");

// header validation
try {
  validateHeader({
    actualHeader: ["https://docs.google.com/spreadsheets/d/x", "manager_id"],
    expectedColumns: ["date", "manager_id"],
    tabTitle: "02_Sales_Daily"
  });
  throw new Error("expected SchemaMismatchError for URL header");
} catch (error) {
  assert(error instanceof SchemaMismatchError, "URL header raises SchemaMismatchError");
}

validateHeader({
  actualHeader: ["date", "manager_id", "revenue"],
  expectedColumns: ["date", "manager_id", "revenue"],
  tabTitle: "ok"
});

const preserved = preserveManualColumns({
  existingRows: [{ month: "2026-07", payroll: "100", opex: "50", revenue: "1" }],
  incomingRows: [{ month: "2026-07", payroll: "", opex: "", revenue: "2" }],
  key: "month",
  manualColumns: ["payroll", "opex"] as const
});
assert(preserved[0].payroll === "100" && preserved[0].opex === "50" && preserved[0].revenue === "2", "manual columns preserved");

// dual revenue labels
const paid = getMetricPresentation("os_paid_revenue");
const svod = getMetricPresentation("svod_attributed_revenue");
assert(paid?.titleRu.includes("Оплаченная"), "os label");
assert(svod?.titleRu.includes("Атрибутированная"), "svod label");
assert(paid?.sourceLabelRu !== svod?.sourceLabelRu, "distinct source labels");

// sales export contract
const headerOk = validateSalesExportHeader([
  "date", "manager_id", "leads", "deals", "invoice_events", "payments", "paid_revenue",
  "active_deals", "active_pipeline_amount", "stale_deals", "deals_without_next_activity",
  "lead_to_deal_cr", "deal_to_invoice_cr", "invoice_to_payment_cr", "deal_to_payment_cr",
  "average_check", "data_quality_score", "source_updated_at", "sync_updated_at", "contract_version"
]);
assert(headerOk.ok, "sales export header ok");
const rowsOk = validateSalesExportRows([{
  date: "2026-07-01",
  manager_id: "1",
  contract_version: SALES_EXPORT_CONTRACT_VERSION
}]);
assert(rowsOk.ok, "sales export rows ok");

// reconciliation delta math
const os = 22146.2;
const attributed = 23800;
const delta = os - attributed;
const deltaPct = (delta / attributed) * 100;
assert(Math.abs(delta - (-1653.8)) < 0.01, "delta");
assert(deltaPct < 0, "os below svod in sample");

console.log("os-mother-hardening.test.ts passed");
