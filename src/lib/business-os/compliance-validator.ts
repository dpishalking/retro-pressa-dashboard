/**
 * Business OS Standard v1 — compliance validator (manifest-level, no live Sheets).
 */

import type {
  BusinessOsManifest,
  OsComplianceStatus,
  OsLayer
} from "@/types/business-os-standard";

export type ComplianceIssue = {
  code: string;
  severity: "critical" | "warning" | "info";
  message: string;
  path?: string;
};

export type ComplianceResult = {
  os_id: string;
  status: OsComplianceStatus;
  issues: ComplianceIssue[];
  scores: {
    required_passed: number;
    required_total: number;
    warnings: number;
  };
};

const REQUIRED_LAYERS: OsLayer[] = [
  "settings",
  "warehouse",
  "management",
  "export",
  "data_quality",
  "reconciliation"
];

const EXPORT_VERSION_RE = /^[a-z][a-z0-9_]*_export_v\d+$/;
const CONTRACT_VERSION_RE = /^[a-z][a-z0-9_]*_v\d+$/;

export function isValidExportContractVersion(version: string): boolean {
  return EXPORT_VERSION_RE.test(version);
}

export function isValidContractVersion(version: string): boolean {
  return EXPORT_VERSION_RE.test(version) || CONTRACT_VERSION_RE.test(version);
}

export function validatePlanApproval(input: {
  plan_status?: string;
  plan_value?: number | null;
  has_approved_source?: boolean;
}): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  if (input.plan_value != null && input.plan_status !== "approved" && input.plan_status !== "NO_PLAN") {
    if (!input.has_approved_source) {
      issues.push({
        code: "plan_without_approval",
        severity: "critical",
        message: "Plan value present without approved status or approved source"
      });
    }
  }
  if (input.plan_status === "NO_PLAN" && input.plan_value != null && input.plan_value !== 0) {
    issues.push({
      code: "no_plan_with_value",
      severity: "warning",
      message: "NO_PLAN should not carry a numeric plan_value"
    });
  }
  return issues;
}

export function validateForecastMethod(input: {
  value_type?: string;
  forecast_method?: string;
}): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  if (input.value_type === "FORECAST") {
    if (!input.forecast_method || input.forecast_method === "unsupported") {
      issues.push({
        code: "forecast_without_method",
        severity: "critical",
        message: "FORECAST requires an explicit forecast_method"
      });
    }
  }
  if (input.value_type === "SCENARIO" && input.forecast_method && input.forecast_method !== "unsupported") {
    // scenario may have method but must not be labeled FORECAST
  }
  if (input.value_type === "FORECAST" && String(input.forecast_method || "").includes("scenario")) {
    issues.push({
      code: "scenario_mislabeled_as_forecast",
      severity: "critical",
      message: "SCENARIO must not be labeled as FORECAST"
    });
  }
  return issues;
}

export function detectUnknownReplacedByZero(input: {
  raw: unknown;
  emitted: unknown;
  was_unknown: boolean;
}): ComplianceIssue[] {
  if (input.was_unknown && (input.emitted === 0 || input.emitted === "0")) {
    return [
      {
        code: "unknown_replaced_by_zero",
        severity: "critical",
        message: "UNKNOWN must not be silently replaced by zero"
      }
    ];
  }
  return [];
}

export function aggregationRuleForMetric(dataType: string): "sum_ok" | "recompute" | "forbidden" {
  if (dataType === "percentage" || dataType === "snapshot" || dataType === "score") return "forbidden";
  if (dataType === "duration") return "recompute";
  if (dataType === "count" || dataType === "currency") return "sum_ok";
  return "recompute";
}

export function validateAverageAggregation(input: {
  summed_average?: number;
  total_numerator: number;
  total_denominator: number;
}): ComplianceIssue[] {
  if (input.total_denominator <= 0) return [];
  const correct = input.total_numerator / input.total_denominator;
  if (input.summed_average != null && Math.abs(input.summed_average - correct) > 1e-6) {
    return [
      {
        code: "average_summed_incorrectly",
        severity: "critical",
        message: "Average must be recomputed as numerator/denominator, not summed"
      }
    ];
  }
  return [];
}

export function validateBusinessOsManifest(manifest: BusinessOsManifest): ComplianceResult {
  const issues: ComplianceIssue[] = [];
  const requiredChecks: Array<{ ok: boolean; issue?: ComplianceIssue }> = [];

  const pushRequired = (ok: boolean, issue: ComplianceIssue) => {
    requiredChecks.push({ ok, issue: ok ? undefined : issue });
    if (!ok) issues.push(issue);
  };

  pushRequired(Boolean(manifest.os_id?.trim()), {
    code: "missing_os_id",
    severity: "critical",
    message: "os_id is required"
  });

  pushRequired(Boolean(manifest.owner?.trim()), {
    code: "missing_owner",
    severity: "critical",
    message: "OS owner is required",
    path: "owner"
  });

  pushRequired(Array.isArray(manifest.layers) && manifest.layers.length > 0, {
    code: "missing_layers",
    severity: "critical",
    message: "layers[] must be declared"
  });

  for (const layer of REQUIRED_LAYERS) {
    if (manifest.is_template) continue;
    const declared =
      manifest.layers.includes(layer) ||
      (layer === "data_quality" && manifest.data_quality_sheets.length > 0) ||
      (layer === "reconciliation" && manifest.reconciliation_sheets.length > 0) ||
      (layer === "settings" && Boolean(manifest.settings_source)) ||
      manifest.sheets.some((s) => s.layer === layer);
    if (!declared) {
      pushRequired(false, {
        code: "missing_layer",
        severity: "critical",
        message: `Required layer not declared: ${layer}`,
        path: `layers.${layer}`
      });
    } else {
      requiredChecks.push({ ok: true });
    }
  }

  pushRequired(manifest.sheets.length > 0 || Boolean(manifest.is_template), {
    code: "missing_sheets",
    severity: "critical",
    message: "sheets[] must declare roles (templates may defer)"
  });

  const sheetKeys = new Set<string>();
  for (const sheet of manifest.sheets) {
    if (!sheet.sheet_key || !sheet.sheet_name) {
      pushRequired(false, {
        code: "sheet_missing_identity",
        severity: "critical",
        message: "Each sheet needs sheet_key and sheet_name"
      });
    }
    if (!sheet.layer) {
      pushRequired(false, {
        code: "sheet_missing_role",
        severity: "critical",
        message: `Sheet ${sheet.sheet_name} missing layer/role`,
        path: sheet.sheet_key
      });
    } else {
      requiredChecks.push({ ok: true });
    }
    const roleKey = `${sheet.layer}:${sheet.sheet_name}`;
    if (sheetKeys.has(roleKey)) {
      issues.push({
        code: "duplicate_sheet_role",
        severity: "warning",
        message: `Duplicate sheet role declaration: ${roleKey}`
      });
    }
    sheetKeys.add(roleKey);
  }

  if (!manifest.is_template) {
    pushRequired(manifest.exports.length > 0, {
      code: "missing_export",
      severity: "critical",
      message: "At least one versioned export is required"
    });
  }

  for (const exp of manifest.exports) {
    pushRequired(isValidExportContractVersion(exp.contract_version), {
      code: "export_without_version",
      severity: "critical",
      message: `Export ${exp.sheet_name} needs <domain>_export_vN version`,
      path: exp.contract_version
    });
    pushRequired(Array.isArray(exp.primary_key) && exp.primary_key.length > 0, {
      code: "export_without_primary_key",
      severity: "critical",
      message: `Export ${exp.sheet_name} missing primary_key`,
      path: exp.sheet_name
    });
    pushRequired(Boolean(exp.grain?.trim()), {
      code: "export_without_grain",
      severity: "critical",
      message: `Export ${exp.sheet_name} missing grain`
    });
  }

  pushRequired(manifest.sync_entrypoints.length > 0 || Boolean(manifest.is_template), {
    code: "missing_sync_entrypoint",
    severity: "critical",
    message: "sync_entrypoints required"
  });

  pushRequired(manifest.docs.length > 0, {
    code: "missing_docs",
    severity: "critical",
    message: "docs[] must list documentation paths"
  });

  pushRequired(Boolean(manifest.settings_source?.trim()), {
    code: "missing_settings",
    severity: "critical",
    message: "settings_source must be defined"
  });

  if (!manifest.is_template) {
    pushRequired(manifest.data_quality_sheets.length > 0, {
      code: "missing_data_quality",
      severity: "critical",
      message: "data_quality_sheets must be declared"
    });
    pushRequired(manifest.reconciliation_sheets.length > 0, {
      code: "missing_reconciliation",
      severity: "critical",
      message: "reconciliation_sheets must be declared"
    });
  }

  const manualWithoutOwner = manifest.sheets.filter(
    (s) => (s.manual_fields?.length || 0) > 0 && s.sync_type === "manual" && !manifest.owner
  );
  if (manualWithoutOwner.length) {
    issues.push({
      code: "manual_fields_without_owner_metadata",
      severity: "warning",
      message: "Manual sheets require OS owner metadata"
    });
  }

  if (!manifest.spreadsheet_id?.trim() && !manifest.is_template) {
    issues.push({
      code: "missing_spreadsheet_id",
      severity: "warning",
      message: "Active OS should declare spreadsheet_id"
    });
  }

  if (manifest.is_template && manifest.spreadsheet_id) {
    issues.push({
      code: "template_has_spreadsheet_id",
      severity: "warning",
      message: "Templates must not invent spreadsheet IDs"
    });
  }

  const migrationSheets = manifest.sheets.filter(
    (s) => s.status === "needs_migration" || s.status === "temporary"
  );
  if (migrationSheets.length) {
    issues.push({
      code: "legacy_migration_pending",
      severity: "warning",
      message: `${migrationSheets.length} sheet(s) marked needs_migration/temporary`
    });
  }

  if (!manifest.is_template && !manifest.layers.includes("prediction")) {
    issues.push({
      code: "prediction_layer_absent",
      severity: "warning",
      message: "Prediction layer not declared (blocked or not yet aligned)"
    });
  }

  const requiredTotal = requiredChecks.length;
  const requiredPassed = requiredChecks.filter((c) => c.ok).length;
  const criticalOpen = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  let status: OsComplianceStatus = "compliant";
  if (criticalOpen > 0) {
    status = requiredPassed === 0 ? "non_compliant" : "partially_compliant";
    // Legacy OS with some critical gaps but many passes → partially_compliant
    if (requiredPassed / Math.max(requiredTotal, 1) >= 0.5) status = "partially_compliant";
    else status = "non_compliant";
  } else if (warnings > 0) {
    status = "partially_compliant";
  }

  // Templates: only structural template validity
  if (manifest.is_template) {
    const templateCritical = issues.filter(
      (i) =>
        i.severity === "critical" &&
        !["missing_export", "missing_data_quality", "missing_reconciliation", "missing_sheets"].includes(
          i.code
        )
    );
    status = templateCritical.length ? "non_compliant" : "partially_compliant";
    if (!manifest.owner || !manifest.layers.length || !manifest.docs.length) {
      status = "non_compliant";
    } else if (templateCritical.length === 0) {
      status = "compliant";
    }
  }

  return {
    os_id: manifest.os_id,
    status,
    issues,
    scores: {
      required_passed: requiredPassed,
      required_total: requiredTotal,
      warnings
    }
  };
}
