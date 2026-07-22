/**
 * Template — sync entry skeleton.
 * Must support dryRun, mutex, schema validation, manual field preservation.
 */

export type DomainSyncResult = {
  status: "success" | "failed" | "blocked" | "partial";
  dryRun: boolean;
  rows_read: number;
  rows_written: number;
  errors: string[];
  contract_version: string;
};

export async function syncDomainOs(_input?: {
  dryRun?: boolean;
}): Promise<DomainSyncResult> {
  return {
    status: "blocked",
    dryRun: true,
    rows_read: 0,
    rows_written: 0,
    errors: ["Implement after Coverage Audit"],
    contract_version: "{{domain}}_os_v1"
  };
}
