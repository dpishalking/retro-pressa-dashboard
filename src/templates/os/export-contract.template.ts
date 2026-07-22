/**
 * Template — export contract.
 */

export const DOMAIN_EXPORT_CONTRACT_VERSION = "{{domain}}_export_v1" as const;

export const DOMAIN_EXPORT_COLUMNS = [
  // grain keys…
  "data_quality_score",
  "source_updated_at",
  "sync_updated_at",
  "contract_version"
] as const;

export function validateDomainExportRows(
  _rows: Array<Record<string, unknown>>
): { ok: boolean; errors: string[] } {
  return { ok: false, errors: ["Implement after Coverage Audit"] };
}
