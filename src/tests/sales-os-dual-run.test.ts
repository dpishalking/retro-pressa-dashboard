import assert from "node:assert/strict";
import {
  SALES_EXPORT_COLUMNS,
  SALES_EXPORT_CONTRACT_VERSION,
  validateSalesExportHeader,
  validateSalesExportRows
} from "@/lib/sales-os/export-contract";
import { buildMirrorRows } from "@/lib/os-sheets/sales-os-ingest";
import { buildCutoverReadiness, buildReconciliationRows, classifyMetricDelta } from "@/lib/os-sheets/sales-reconciliation";
import { classifyIngestStatus } from "@/lib/sales-os/export-reader";
import type { SalesDailyRow } from "@/lib/os-sheets/sales-mapper";
import type { OrdersRow } from "@/lib/os-sheets/orders-mapper";

const header = [...SALES_EXPORT_COLUMNS];
assert.equal(validateSalesExportHeader(header).ok, true);
assert.equal(validateSalesExportHeader(["https://x", ...header.slice(1)]).ok, false);

const goodRows = [{
  date: "2026-07-01",
  manager_id: "5",
  leads: "1",
  deals: "1",
  invoice_events: "1",
  payments: "1",
  paid_revenue: "100",
  active_deals: "0",
  active_pipeline_amount: "0",
  stale_deals: "0",
  deals_without_next_activity: "0",
  lead_to_deal_cr: "100",
  deal_to_invoice_cr: "100",
  invoice_to_payment_cr: "100",
  deal_to_payment_cr: "100",
  average_check: "100",
  data_quality_score: "",
  source_updated_at: "2026-07-22T00:00:00.000Z",
  sync_updated_at: "2026-07-22T00:00:00.000Z",
  contract_version: SALES_EXPORT_CONTRACT_VERSION
}];
assert.equal(validateSalesExportRows(goodRows).ok, true);

assert.equal(validateSalesExportRows([{ ...goodRows[0], contract_version: "v0" }]).ok, false);
assert.equal(validateSalesExportRows([goodRows[0], { ...goodRows[0] }]).ok, false, "duplicate pk");
assert.equal(validateSalesExportRows([{ ...goodRows[0], date: "07-01-2026" }]).ok, false);
assert.equal(validateSalesExportRows([{ ...goodRows[0], deals: "x" }]).ok, false);
assert.equal(
  validateSalesExportRows([
    goodRows[0],
    { ...goodRows[0], date: "2026-07-02", contract_version: "other" }
  ]).ok,
  false,
  "mixed versions"
);

assert.equal(classifyIngestStatus({ stale: false, partial: false, schemaError: true }), "schema_error");
assert.equal(classifyIngestStatus({ stale: true, partial: false, schemaError: false }), "stale");

const mirror = buildMirrorRows({
  exportRows: goodRows,
  ingestedAt: "2026-07-22T01:00:00.000Z",
  ingestStatus: "current"
});
assert.equal(mirror[0].paid_revenue, "100");
assert.equal(mirror[0].ingested_at, "2026-07-22T01:00:00.000Z");
assert.equal(mirror[0].sales_os_sync_updated_at, "2026-07-22T00:00:00.000Z");

assert.equal(classifyMetricDelta({
  metricId: "deals",
  legacyValue: 10,
  salesOsValue: 10,
  absoluteTolerance: 0,
  relativeTolerancePct: 0,
  definitionStatus: "aligned",
  blocksCutover: true
}).status, "matched");

assert.equal(classifyMetricDelta({
  metricId: "paid_revenue",
  legacyValue: 100,
  salesOsValue: 100.5,
  absoluteTolerance: 1,
  relativeTolerancePct: 0.1,
  definitionStatus: "partially_aligned",
  blocksCutover: true
}).status, "within_tolerance");

assert.equal(classifyMetricDelta({
  metricId: "deals",
  legacyValue: 10,
  salesOsValue: 12,
  absoluteTolerance: 0,
  relativeTolerancePct: 0,
  definitionStatus: "aligned",
  blocksCutover: true
}).status, "mismatch");

assert.equal(classifyMetricDelta({
  metricId: "leads",
  legacyValue: null,
  salesOsValue: 5,
  absoluteTolerance: 0,
  relativeTolerancePct: 0,
  definitionStatus: "pending_review",
  blocksCutover: false
}).status, "pending_definition");

assert.equal(classifyMetricDelta({
  metricId: "invoice_events",
  legacyValue: 1,
  salesOsValue: 9,
  absoluteTolerance: 0,
  relativeTolerancePct: 0,
  definitionStatus: "pending_review",
  blocksCutover: false
}).status, "pending_definition");

const legacySales = [{
  date: "2026-07-01",
  manager_id: "5",
  manager_name: "A",
  deals_created: "2",
  invoices: "1",
  payments: "1",
  revenue: "50",
  average_check: "50",
  lost: "",
  created_to_invoice_cr: "",
  created_to_paid_cr: "",
  data_status: "live",
  last_sync_at: "",
  source_of_truth: "computed"
}] as SalesDailyRow[];

const recon = buildReconciliationRows({
  legacySales,
  salesOsDaily: [{
    date: "2026-07-01",
    manager_id: "5",
    leads: "3",
    deals: "2",
    invoice_events: "1",
    payments: "1",
    paid_revenue: "50",
    active_deals: "0",
    active_pipeline_amount: "0"
  }],
  orders: [] as OrdersRow[],
  periods: ["2026-07"],
  checkedAt: "2026-07-22T00:00:00.000Z"
});
assert.ok(recon.some((row) => row.metric_id === "deals" && row.status === "matched"));
assert.ok(recon.some((row) => row.metric_id === "leads" && row.status === "pending_definition"));

const readiness = buildCutoverReadiness({
  reconRows: Array.from({ length: 7 }).flatMap((_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return [
      {
        period_type: "day",
        period: `2026-07-${day}`,
        manager_id: "all",
        metric_id: "deals",
        metric_name: "Deals",
        legacy_source: "x",
        legacy_value: "1",
        sales_os_source: "y",
        sales_os_value: "1",
        delta: "0",
        delta_pct: "0",
        absolute_tolerance: "0",
        relative_tolerance_pct: "0",
        status: "matched",
        difference_reason: "",
        definition_status: "aligned",
        source_updated_at: "",
        checked_at: ""
      },
      {
        period_type: "day",
        period: `2026-07-${day}`,
        manager_id: "all",
        metric_id: "payments",
        metric_name: "Payments",
        legacy_source: "x",
        legacy_value: "1",
        sales_os_source: "y",
        sales_os_value: "1",
        delta: "0",
        delta_pct: "0",
        absolute_tolerance: "0",
        relative_tolerance_pct: "0",
        status: "matched",
        difference_reason: "",
        definition_status: "partially_aligned",
        source_updated_at: "",
        checked_at: ""
      },
      {
        period_type: "day",
        period: `2026-07-${day}`,
        manager_id: "all",
        metric_id: "paid_revenue",
        metric_name: "Paid revenue",
        legacy_source: "x",
        legacy_value: "10",
        sales_os_source: "y",
        sales_os_value: "10",
        delta: "0",
        delta_pct: "0",
        absolute_tolerance: "1",
        relative_tolerance_pct: "0.1",
        status: "matched",
        difference_reason: "",
        definition_status: "partially_aligned",
        source_updated_at: "",
        checked_at: ""
      },
      {
        period_type: "day",
        period: `2026-07-${day}`,
        manager_id: "all",
        metric_id: "manager_count",
        metric_name: "Manager count",
        legacy_source: "x",
        legacy_value: "1",
        sales_os_source: "y",
        sales_os_value: "1",
        delta: "0",
        delta_pct: "0",
        absolute_tolerance: "0",
        relative_tolerance_pct: "0",
        status: "matched",
        difference_reason: "",
        definition_status: "aligned",
        source_updated_at: "",
        checked_at: ""
      }
    ];
  }),
  checkedAt: "2026-07-22T00:00:00.000Z",
  schemaErrors7d: 0,
  failedSyncs7d: 0
});

assert.equal(readiness.find((row) => row.metric_id === "deals")?.cutover_ready, "true");
assert.equal(readiness.find((row) => row.metric_id === "contract_schema")?.cutover_ready, "true");
assert.equal(buildCutoverReadiness({
  reconRows: [],
  checkedAt: "x",
  schemaErrors7d: 2,
  failedSyncs7d: 0
}).find((row) => row.metric_id === "contract_schema")?.cutover_ready, "false");

console.log("sales-os-dual-run.test.ts: ok");
