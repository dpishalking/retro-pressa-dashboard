import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PeriodKey } from "@/types/metrics";

export type BitrixSnapshotLead = {
  id: string;
  dateCreate: string | null;
  statusId: string | null;
  sourceId: string | null;
  assignedById: string;
  managerName: string;
  country: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPage: string | null;
  formName: string | null;
};

export type BitrixSnapshotProductRow = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
};

export type BitrixSnapshotDeal = {
  id: string;
  title: string | null;
  leadId: string | null;
  dateCreate: string | null;
  closeDate: string | null;
  /** Invoice event date used for period attribution. */
  invoiceDate: string | null;
  opportunity: number;
  currencyId: string | null;
  /** Prefer «Сумма для счета», fallback to opportunity. */
  invoiceAmount: number;
  stageId: string | null;
  stageSemanticId: string | null;
  sourceId: string | null;
  assignedById: string;
  managerName: string;
  country: string;
  utmCampaign: string | null;
  landingPage: string | null;
  products: BitrixSnapshotProductRow[];
  /** How this deal entered the invoice set. */
  invoiceSource?: "invoice_date_field" | "stage_history";
};

export type BitrixSnapshot = {
  version: 2;
  period: PeriodKey;
  periodStart: string;
  periodEnd: string;
  factualEnd: string;
  createdAt: string;
  countryOptions: string[];
  productOptions: string[];
  leads: BitrixSnapshotLead[];
  recentLeads: BitrixSnapshotLead[];
  /** Deals counted as invoices issued in the period. */
  deals: BitrixSnapshotDeal[];
  /** Calendar paid deals (CLOSEDATE in period, won). */
  paidDeals: BitrixSnapshotDeal[];
};

const snapshotDir = path.join(process.cwd(), "data", "bitrix-snapshots");

export function snapshotFilePath(period: PeriodKey) {
  return path.join(snapshotDir, `${period}.json`);
}

async function ensureSnapshotDir() {
  await mkdir(snapshotDir, { recursive: true });
}

export async function readBitrixSnapshot(period: PeriodKey): Promise<BitrixSnapshot | null> {
  try {
    const raw = await readFile(snapshotFilePath(period), "utf8");
    const parsed = JSON.parse(raw) as Partial<BitrixSnapshot>;
    if (
      parsed?.version !== 2
      || parsed.period !== period
      || !Array.isArray(parsed.deals)
      || !Array.isArray(parsed.paidDeals)
      || !Array.isArray(parsed.leads)
    ) {
      return null;
    }
    return parsed as BitrixSnapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return null;
    return null;
  }
}

export async function writeBitrixSnapshot(snapshot: BitrixSnapshot) {
  await ensureSnapshotDir();
  await writeFile(snapshotFilePath(snapshot.period), JSON.stringify(snapshot, null, 2), "utf8");
}
