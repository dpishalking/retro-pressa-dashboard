/**
 * Traffic OS → mother export contract.
 * Mother must not ingest as canon until explicit cutover.
 *
 * v1 kept for reference. Active workbook export = traffic_export_v2.
 */

export const TRAFFIC_EXPORT_CONTRACT_VERSION = "traffic_export_v1" as const;
export const TRAFFIC_EXPORT_V2_CONTRACT_VERSION = "traffic_export_v2" as const;
export const TRAFFIC_EXPORT_V3_CONTRACT_VERSION = "traffic_export_v3" as const;

export const TRAFFIC_EXPORT_COLUMNS = [
  "date",
  "traffic_type",
  "channel",
  "landing_id",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "paid_revenue",
  "average_check",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "unknown_leads",
  "data_quality_score",
  "source_updated_at",
  "sync_updated_at",
  "contract_version"
] as const;

export const TRAFFIC_EXPORT_V2_COLUMNS = [
  "date",
  "traffic_type",
  "channel_id",
  "landing_id",
  "campaign_id",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "attributed_paid_revenue",
  "average_check",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "unknown_leads",
  "attribution_coverage_pct",
  "payment_linkage_pct",
  "revenue_linkage_pct",
  "confidence",
  "data_quality_score",
  "source_updated_at",
  "sync_updated_at",
  "contract_version"
] as const;

/** Payment-calendar enrichment export (Mother not switched). */
export const TRAFFIC_EXPORT_V3_COLUMNS = [
  "date",
  "traffic_type",
  "channel_id",
  "landing_id",
  "campaign_id",
  "leads",
  "deals",
  "invoice_events",
  "payments",
  "attributed_paid_revenue",
  "direct_attributed_revenue",
  "contact_attributed_revenue",
  "customer_attributed_revenue",
  "cross_period_revenue",
  "average_check",
  "lead_to_deal_cr",
  "deal_to_invoice_cr",
  "invoice_to_payment_cr",
  "lead_to_payment_cr",
  "unknown_leads",
  "attribution_coverage_pct",
  "payment_linkage_pct",
  "revenue_linkage_pct",
  "confidence",
  "data_quality_score",
  "source_updated_at",
  "sync_updated_at",
  "contract_version"
] as const;

export type TrafficExportColumn = (typeof TRAFFIC_EXPORT_COLUMNS)[number];
export type TrafficExportV2Column = (typeof TRAFFIC_EXPORT_V2_COLUMNS)[number];

export function validateTrafficExportHeader(header: string[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalized = header.map((cell) => String(cell ?? "").trim());
  for (const column of TRAFFIC_EXPORT_COLUMNS) {
    if (!normalized.includes(column)) errors.push(`Missing column: ${column}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateTrafficExportV2Header(header: string[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalized = header.map((cell) => String(cell ?? "").trim());
  for (const column of TRAFFIC_EXPORT_V2_COLUMNS) {
    if (!normalized.includes(column)) errors.push(`Missing column: ${column}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateTrafficExportRows(
  rows: Array<Record<string, unknown>>
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const date = String(row.date ?? "").trim();
    const trafficType = String(row.traffic_type ?? "").trim();
    const channel = String(row.channel ?? "").trim();
    const landingId = String(row.landing_id ?? "").trim();
    if (!date) errors.push(`Row ${i + 1}: date required`);
    if (!trafficType) errors.push(`Row ${i + 1}: traffic_type required`);
    if (!channel) errors.push(`Row ${i + 1}: channel required`);
    if (!landingId) errors.push(`Row ${i + 1}: landing_id required`);
    const version = String(row.contract_version ?? "").trim();
    if (version !== TRAFFIC_EXPORT_CONTRACT_VERSION) {
      errors.push(`Row ${i + 1}: unsupported contract_version ${version}`);
    }
    const key = `${date}|${trafficType}|${channel}|${landingId}`;
    if (keys.has(key)) errors.push(`Row ${i + 1}: duplicate PK ${key}`);
    keys.add(key);
  }
  return { ok: errors.length === 0, errors };
}

export function validateTrafficExportV2Rows(
  rows: Array<Record<string, unknown>>
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const date = String(row.date ?? "").trim();
    const trafficType = String(row.traffic_type ?? "").trim();
    const channelId = String(row.channel_id ?? "").trim();
    const landingId = String(row.landing_id ?? "").trim();
    const campaignId = String(row.campaign_id ?? "").trim();
    if (!date) errors.push(`Row ${i + 1}: date required`);
    if (!trafficType) errors.push(`Row ${i + 1}: traffic_type required`);
    if (!channelId) errors.push(`Row ${i + 1}: channel_id required`);
    if (!landingId) errors.push(`Row ${i + 1}: landing_id required`);
    if (!campaignId) errors.push(`Row ${i + 1}: campaign_id required`);
    if ("paid_revenue" in row && !("attributed_paid_revenue" in row)) {
      errors.push(`Row ${i + 1}: use attributed_paid_revenue (not unlabeled paid_revenue)`);
    }
    const version = String(row.contract_version ?? "").trim();
    if (version !== TRAFFIC_EXPORT_V2_CONTRACT_VERSION) {
      errors.push(`Row ${i + 1}: unsupported contract_version ${version}`);
    }
    const key = `${date}|${trafficType}|${channelId}|${landingId}|${campaignId}`;
    if (keys.has(key)) errors.push(`Row ${i + 1}: duplicate PK ${key}`);
    keys.add(key);
  }
  return { ok: errors.length === 0, errors };
}

export function validateTrafficExportV3Header(header: string[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalized = header.map((cell) => String(cell ?? "").trim());
  for (const column of TRAFFIC_EXPORT_V3_COLUMNS) {
    if (!normalized.includes(column)) errors.push(`Missing column: ${column}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateTrafficExportV3Rows(
  rows: Array<Record<string, unknown>>
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const date = String(row.date ?? "").trim();
    const trafficType = String(row.traffic_type ?? "").trim();
    const channelId = String(row.channel_id ?? "").trim();
    const landingId = String(row.landing_id ?? "").trim();
    const campaignId = String(row.campaign_id ?? "").trim();
    if (!date) errors.push(`Row ${i + 1}: date required`);
    if (!trafficType) errors.push(`Row ${i + 1}: traffic_type required`);
    if (!channelId) errors.push(`Row ${i + 1}: channel_id required`);
    if (!landingId) errors.push(`Row ${i + 1}: landing_id required`);
    if (!campaignId) errors.push(`Row ${i + 1}: campaign_id required`);
    if (!("direct_attributed_revenue" in row)) {
      errors.push(`Row ${i + 1}: missing direct_attributed_revenue (v3)`);
    }
    const version = String(row.contract_version ?? "").trim();
    if (version !== TRAFFIC_EXPORT_V3_CONTRACT_VERSION) {
      errors.push(`Row ${i + 1}: unsupported contract_version ${version}`);
    }
    const key = `${date}|${trafficType}|${channelId}|${landingId}|${campaignId}`;
    if (keys.has(key)) errors.push(`Row ${i + 1}: duplicate PK ${key}`);
    keys.add(key);
  }
  return { ok: errors.length === 0, errors };
}
