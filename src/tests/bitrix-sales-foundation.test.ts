import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { QUALITY_THRESHOLDS, SALES_FOUNDATION_SYNC_ORDER } from "@/config/sales-foundation";
import { arrayResult, chunkIds } from "@/lib/bitrix/rest-client";
import {
  normalizeEmail,
  normalizePhone,
  pickStableEmailHash,
  pickStablePhoneHash,
  qualityStatus,
  resolveSfCustomerKey
} from "@/lib/bitrix/sales-foundation/customer-key";
import { buildDataQualityRows } from "@/lib/bitrix/sales-foundation/data-quality";
import { resolveCrmLinkStatus } from "@/lib/bitrix/sales-foundation/dialog-links";
import { buildPipelineRows } from "@/lib/bitrix/sales-foundation/pipeline";
import { buildStageHistoryRows } from "@/lib/bitrix/sales-foundation/stage-history";
import { SchemaMismatchError, validateHeader, validateSchema } from "@/lib/os-sheets/safe-write";
import type { ContactRawRow } from "@/lib/bitrix/sales-foundation/contacts";
import type { DealRawRow } from "@/lib/bitrix/sales-foundation/deals";
import type { LeadRawRow } from "@/lib/bitrix/sales-foundation/leads";

function emptyLead(partial: Partial<LeadRawRow>): LeadRawRow {
  return {
    lead_id: "", created_at: "", modified_at: "", status_id: "", status_semantic: "", source_id: "",
    source_description: "", assigned_by_id: "", assigned_by_name: "", company_id: "", contact_id: "",
    deal_id: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "",
    country_raw: "", country_id: "", language_raw: "", product_interest_raw: "", form_name: "",
    phone_present: "false", email_present: "false", customer_key: "", customer_key_type: "",
    is_converted: "", converted_at: "", is_lost: "false", closed_at: "", raw_updated_at: "", sync_updated_at: "",
    ...partial
  };
}

function emptyDeal(partial: Partial<DealRawRow>): DealRawRow {
  return {
    deal_id: "", lead_id: "", contact_id: "", company_id: "", created_at: "", modified_at: "", closed_at: "",
    stage_id: "", stage_semantic: "", category_id: "0", is_open: "", is_won: "", is_lost: "",
    assigned_by_id: "", assigned_by_name: "", source_id: "", currency: "EUR", opportunity: "",
    invoice_amount: "", invoice_at: "", invoice_flag: "", country_raw: "", country_id: "",
    primary_product_id: "", primary_product_name: "", product_rows_count: "", customer_key: "",
    customer_key_type: "", last_activity_at: "", next_activity_at: "", raw_updated_at: "", sync_updated_at: "",
    ...partial
  };
}

function emptyContact(partial: Partial<ContactRawRow>): ContactRawRow {
  return {
    contact_id: "", created_at: "", modified_at: "", assigned_by_id: "", phone_count: "0", email_count: "0",
    has_phone: "false", has_email: "false", phone_hash: "", email_hash: "", country_raw: "", language_raw: "",
    customer_key: "", customer_key_type: "", duplicate_group_key: "", raw_updated_at: "", sync_updated_at: "",
    ...partial
  };
}

// pagination / batch helpers
assert.deepEqual(arrayResult([{ ID: 1 }]), [{ ID: 1 }]);
assert.deepEqual(arrayResult({ items: [{ ID: 2 }] }), [{ ID: 2 }]);
assert.deepEqual(chunkIds([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

// customer_key priority
assert.equal(resolveSfCustomerKey({ contactId: "9", phone: "+37120000111", leadId: "1" }).customer_key, "contact:9");
assert.equal(resolveSfCustomerKey({ phone: "+371 2000 0111" }).customer_key_type, "phone");
assert.equal(resolveSfCustomerKey({ email: "A@B.com" }).customer_key_type, "email");
assert.equal(resolveSfCustomerKey({ leadId: "77" }).customer_key, "lead:77");
assert.equal(resolveSfCustomerKey({ dealId: "88" }).customer_key, "deal:88");

// phone / email normalization + hash stability
assert.equal(normalizePhone("+371 20-000-111"), normalizePhone("0037120000111"));
assert.equal(normalizeEmail(" A@B.COM "), "a@b.com");
const phoneHashA = pickStablePhoneHash(["+371 20000111", "37120000999"]);
const phoneHashB = pickStablePhoneHash(["37120000999", "+371 20000111"]);
assert.equal(phoneHashA.hash, phoneHashB.hash, "stable sorted phone primary");
assert.equal(phoneHashA.count, 2);
assert.ok(phoneHashA.hash.startsWith("phone:"));
assert.equal(
  phoneHashA.hash,
  `phone:${createHash("sha256").update(normalizePhone("37120000111")!).digest("hex")}`
);
const emailHash = pickStableEmailHash(["B@x.com", "a@x.com"]);
assert.equal(emailHash.hash, `email:${createHash("sha256").update("a@x.com").digest("hex")}`);

// stage history ordering / left_at / current
const history = buildStageHistoryRows(
  [
    { OWNER_ID: "10", STAGE_ID: "NEW", CREATED_TIME: "2026-05-01T10:00:00", CATEGORY_ID: 0 },
    { OWNER_ID: "10", STAGE_ID: "1", CREATED_TIME: "2026-05-03T10:00:00", CATEGORY_ID: 0 },
    { OWNER_ID: "10", STAGE_ID: "WON", CREATED_TIME: "2026-05-10T10:00:00", CATEGORY_ID: 0 }
  ],
  new Map([["NEW", "New"], ["1", "Invoice"], ["WON", "Won"]]),
  "2026-07-21T00:00:00.000Z"
);
assert.equal(history.length, 3);
const first = history.find((row) => row.stage_id === "NEW");
const mid = history.find((row) => row.stage_id === "1");
const last = history.find((row) => row.stage_id === "WON");
assert.ok(first && mid && last);
assert.equal(first!.left_at, "2026-05-03T10:00:00");
assert.equal(first!.is_current_stage, "false");
assert.equal(last!.left_at, "");
assert.equal(last!.is_current_stage, "true");
assert.equal(first!.event_id, "10|NEW|2026-05-01T10:00:00");
assert.equal(first!.duration_minutes, String(2 * 24 * 60));
assert.equal(mid!.left_at, "2026-05-10T10:00:00");

// pipeline filtering (only semantic P)
const pipeline = buildPipelineRows({
  deals: [
    { ID: "1", STAGE_SEMANTIC_ID: "P", DATE_CREATE: "2026-05-01T00:00:00", STAGE_ID: "NEW", ASSIGNED_BY_ID: "5", CONTACT_ID: "9", LEAD_ID: "3", OPPORTUNITY: "100", CURRENCY_ID: "EUR" },
    { ID: "2", STAGE_SEMANTIC_ID: "S", DATE_CREATE: "2026-05-01T00:00:00", STAGE_ID: "WON", ASSIGNED_BY_ID: "5", OPPORTUNITY: "200" }
  ],
  stageNameById: new Map([["NEW", "New"]]),
  stageHistory: [{
    event_id: "1|NEW|2026-05-02T00:00:00",
    deal_id: "1",
    category_id: "0",
    stage_id: "NEW",
    stage_name: "New",
    stage_semantic: "",
    entered_at: "2026-05-02T00:00:00",
    left_at: "",
    duration_minutes: "",
    is_current_stage: "true",
    event_source: "test",
    sync_updated_at: "x"
  }],
  productMap: new Map(),
  userNames: new Map([["5", "Manager"]]),
  snapshotDate: "2026-07-21",
  syncedAt: "2026-07-21T12:00:00.000Z"
});
assert.equal(pipeline.length, 1);
assert.equal(pipeline[0].deal_id, "1");
assert.equal(pipeline[0].stage_probability, "");
assert.equal(pipeline[0].weighted_amount, "");
assert.ok(pipeline[0].days_in_stage !== "");

// header validation
try {
  validateHeader({
    actualHeader: ["https://docs.google.com/spreadsheets/d/x"],
    expectedColumns: ["lead_id"],
    tabTitle: "60_Bitrix_Leads_Raw"
  });
  throw new Error("expected schema mismatch");
} catch (error) {
  assert.ok(error instanceof SchemaMismatchError);
}

validateSchema({
  header: ["lead_id", "created_at"],
  rows: [["1", "2026-05-01"]],
  expectedColumns: ["lead_id", "created_at"],
  tabTitle: "test"
});

// CRM link status
assert.equal(resolveCrmLinkStatus({ leadId: "", dealId: "1", contactId: "" }), "linked_deal");
assert.equal(resolveCrmLinkStatus({ leadId: "1", dealId: "2", contactId: "" }), "linked_multiple");
assert.equal(resolveCrmLinkStatus({ leadId: "", dealId: "", contactId: "" }), "unlinked");

// data quality fill-rate + duplicate detection
const quality = buildDataQualityRows({
  periods: ["2026-05"],
  syncedAt: "2026-07-21T00:00:00.000Z",
  leads: [
    emptyLead({ lead_id: "1", created_at: "2026-05-01T00:00:00", utm_source: "fb", contact_id: "9" }),
    emptyLead({ lead_id: "2", created_at: "2026-05-02T00:00:00", utm_source: "", contact_id: "9" })
  ],
  deals: [
    emptyDeal({ deal_id: "10", created_at: "2026-05-01T00:00:00", lead_id: "1", stage_id: "NEW", stage_semantic: "P" })
  ],
  contacts: [
    emptyContact({ contact_id: "9", has_phone: "true", has_email: "false", assigned_by_id: "1" })
  ]
});
const utm = quality.find((row) => row.entity_type === "lead" && row.field_id === "UTM_SOURCE" && row.period === "2026-05");
assert.ok(utm);
assert.equal(utm!.records_total, "2");
assert.equal(utm!.records_filled, "1");
assert.equal(utm!.fill_rate_pct, "50.00");
assert.equal(utm!.quality_status, "poor");
assert.equal(qualityStatus(95), "good");
assert.equal(qualityStatus(QUALITY_THRESHOLDS.acceptable), "acceptable");
assert.equal(qualityStatus(null), "unknown");

const contactDup = quality.find((row) => row.entity_type === "lead" && row.field_id === "CONTACT_ID");
assert.ok(contactDup);
assert.equal(contactDup!.records_unique, "1");
assert.equal(contactDup!.duplicate_rate_pct, "50.00");

// sync order contract
assert.deepEqual(SALES_FOUNDATION_SYNC_ORDER[0], "field_catalog");
assert.deepEqual(SALES_FOUNDATION_SYNC_ORDER.at(-1), "data_quality");

// dry-run contract: sync entrypoint rejects missing webhook without writing
async function assertDryRunWithoutWebhook() {
  const previous = process.env.BITRIX_WEBHOOK_URL;
  process.env.BITRIX_WEBHOOK_URL = "";
  let dryRunBlocked = false;
  try {
    const { syncBitrixSalesFoundation } = await import("@/lib/bitrix/sales-foundation/sync");
    await syncBitrixSalesFoundation({ dryRun: true, modules: ["stages"] });
  } catch (error) {
    dryRunBlocked = /BITRIX_WEBHOOK_URL/i.test(error instanceof Error ? error.message : String(error));
  } finally {
    process.env.BITRIX_WEBHOOK_URL = previous;
  }
  assert.equal(dryRunBlocked, true, "dry run without webhook fails before writes");
}

assertDryRunWithoutWebhook()
  .then(() => {
    console.log("bitrix-sales-foundation.test.ts: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
