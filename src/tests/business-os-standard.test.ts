import assert from "node:assert/strict";
import { salesOsManifest } from "@/config/os-manifests/sales-os";
import { trafficOsManifest } from "@/config/os-manifests/traffic-os";
import { financeOsManifestTemplate } from "@/config/os-manifests/finance-os.template";
import { productOsManifestTemplate } from "@/config/os-manifests/product-os.template";
import {
  aggregationRuleForMetric,
  detectUnknownReplacedByZero,
  isValidContractVersion,
  isValidExportContractVersion,
  validateAverageAggregation,
  validateBusinessOsManifest,
  validateForecastMethod,
  validatePlanApproval
} from "@/lib/business-os/compliance-validator";
import type { BusinessOsManifest } from "@/types/business-os-standard";
import { GAP_TO_PLAN_FORMULA } from "@/types/business-os-standard";

assert.equal(GAP_TO_PLAN_FORMULA, "run_rate - plan");

assert.equal(isValidExportContractVersion("sales_export_v1"), true);
assert.equal(isValidExportContractVersion("traffic_export_v3"), true);
assert.equal(isValidExportContractVersion("v1"), false);
assert.equal(isValidContractVersion("traffic_os_v1"), true);

const sales = validateBusinessOsManifest(salesOsManifest);
assert.equal(sales.status, "partially_compliant", sales.status);
assert.ok(sales.issues.some((i) => i.code === "legacy_migration_pending"));
assert.ok(!sales.issues.some((i) => i.code === "missing_owner"));

const traffic = validateBusinessOsManifest(trafficOsManifest);
assert.equal(traffic.status, "partially_compliant", traffic.status);
assert.ok(traffic.issues.some((i) => i.code === "prediction_layer_absent"));
assert.ok(trafficOsManifest.exports[0].contract_version === "traffic_export_v3");

const finance = validateBusinessOsManifest(financeOsManifestTemplate);
assert.equal(finance.status, "compliant");
assert.equal(financeOsManifestTemplate.is_template, true);
assert.equal(financeOsManifestTemplate.spreadsheet_id, "");

const product = validateBusinessOsManifest(productOsManifestTemplate);
assert.equal(product.status, "compliant");

const noOwner: BusinessOsManifest = {
  ...salesOsManifest,
  os_id: "broken",
  owner: ""
};
const missingOwner = validateBusinessOsManifest(noOwner);
assert.ok(missingOwner.issues.some((i) => i.code === "missing_owner"));

const noLayers: BusinessOsManifest = {
  ...salesOsManifest,
  os_id: "nolayers",
  layers: []
};
const missingLayers = validateBusinessOsManifest(noLayers);
assert.ok(missingLayers.issues.some((i) => i.code === "missing_layers" || i.code === "missing_layer"));

const badExport: BusinessOsManifest = {
  ...salesOsManifest,
  os_id: "badexport",
  exports: [
    {
      sheet_name: "99_EXPORT",
      contract_version: "unversioned",
      grain: "date",
      primary_key: []
    }
  ]
};
const exportIssues = validateBusinessOsManifest(badExport);
assert.ok(exportIssues.issues.some((i) => i.code === "export_without_version"));
assert.ok(exportIssues.issues.some((i) => i.code === "export_without_primary_key"));

assert.ok(validatePlanApproval({ plan_value: 100, plan_status: "draft" }).some((i) => i.code === "plan_without_approval"));
assert.equal(validatePlanApproval({ plan_status: "approved", plan_value: 100, has_approved_source: true }).length, 0);

assert.ok(
  validateForecastMethod({ value_type: "FORECAST", forecast_method: "" }).some(
    (i) => i.code === "forecast_without_method"
  )
);
assert.ok(
  validateForecastMethod({ value_type: "FORECAST", forecast_method: "scenario_x" }).some(
    (i) => i.code === "scenario_mislabeled_as_forecast"
  )
);

assert.ok(
  detectUnknownReplacedByZero({ raw: null, emitted: 0, was_unknown: true }).some(
    (i) => i.code === "unknown_replaced_by_zero"
  )
);
assert.equal(detectUnknownReplacedByZero({ raw: 5, emitted: 5, was_unknown: false }).length, 0);

assert.equal(aggregationRuleForMetric("percentage"), "forbidden");
assert.equal(aggregationRuleForMetric("snapshot"), "forbidden");
assert.equal(aggregationRuleForMetric("count"), "sum_ok");
assert.ok(
  validateAverageAggregation({
    summed_average: 30,
    total_numerator: 100,
    total_denominator: 10
  }).some((i) => i.code === "average_summed_incorrectly")
);

const noDq: BusinessOsManifest = {
  ...salesOsManifest,
  os_id: "nodq",
  data_quality_sheets: [],
  sheets: salesOsManifest.sheets.filter((s) => s.layer !== "data_quality"),
  layers: salesOsManifest.layers.filter((l) => l !== "data_quality")
};
const dqMissing = validateBusinessOsManifest(noDq);
assert.ok(dqMissing.issues.some((i) => i.code === "missing_data_quality" || i.code === "missing_layer"));

const noRecon: BusinessOsManifest = {
  ...salesOsManifest,
  os_id: "norecon",
  reconciliation_sheets: [],
  sheets: salesOsManifest.sheets.filter((s) => s.layer !== "reconciliation"),
  layers: salesOsManifest.layers.filter((l) => l !== "reconciliation")
};
const reconMissing = validateBusinessOsManifest(noRecon);
assert.ok(
  reconMissing.issues.some((i) => i.code === "missing_reconciliation" || i.code === "missing_layer")
);

const dupRole: BusinessOsManifest = {
  ...salesOsManifest,
  os_id: "dup",
  sheets: [
    ...salesOsManifest.sheets,
    { ...salesOsManifest.sheets[0], sheet_key: "readme2" }
  ]
};
const dup = validateBusinessOsManifest(dupRole);
assert.ok(dup.issues.some((i) => i.code === "duplicate_sheet_role"));

// Legacy OS classified partially compliant (not hard fail production)
assert.equal(sales.status, "partially_compliant");
assert.equal(traffic.status, "partially_compliant");

// Manual field preservation metadata on Sales Maria sheet
const maria = salesOsManifest.sheets.find((s) => s.sheet_name === "15_Maria_Daily");
assert.ok(maria?.sync_type === "manual");
assert.ok((maria?.manual_fields?.length || 0) > 0);

console.log("business-os-standard.test.ts: ok", {
  sales: sales.status,
  traffic: traffic.status,
  finance: finance.status,
  product: product.status
});
