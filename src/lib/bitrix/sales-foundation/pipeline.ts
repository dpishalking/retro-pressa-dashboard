import { PIPELINE_COLUMNS, SALES_CATEGORY_ID, SELECT_DEAL, SF_FIELDS } from "@/config/sales-foundation";
import { bitrixBatch, bitrixListAll, chunkIds } from "@/lib/bitrix/rest-client";
import {
  asNumberString,
  asString,
  loadUserNames,
  resolveSfCustomerKey
} from "@/lib/bitrix/sales-foundation/customer-key";
import type { StageHistoryRow } from "@/lib/bitrix/sales-foundation/stage-history";

export type PipelineRow = Record<(typeof PIPELINE_COLUMNS)[number], string>;

type BitrixDeal = Record<string, unknown>;
type ProductRow = { PRODUCT_ID?: string | number; PRODUCT_NAME?: string };

function daysBetween(fromIso: string, toIso: string): string {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "";
  return String(Math.floor((to - from) / 86400000));
}

export function buildPipelineRows(input: {
  deals: BitrixDeal[];
  stageNameById: Map<string, string>;
  stageHistory: StageHistoryRow[];
  productMap: Map<string, ProductRow[]>;
  userNames: Map<string, string>;
  snapshotDate: string;
  syncedAt: string;
}): PipelineRow[] {
  const currentStageEntered = new Map<string, string>();
  for (const event of input.stageHistory) {
    if (event.is_current_stage === "true") {
      currentStageEntered.set(event.deal_id, event.entered_at);
    }
  }

  const rows: PipelineRow[] = [];
  for (const deal of input.deals) {
    const dealId = asString(deal.ID);
    if (!dealId) continue;
    const semantic = asString(deal.STAGE_SEMANTIC_ID);
    if (semantic !== "P") continue;
    const createdAt = asString(deal.DATE_CREATE);
    const stageId = asString(deal.STAGE_ID);
    const products = input.productMap.get(dealId) || [];
    const primary = products[0];
    const identity = resolveSfCustomerKey({
      contactId: asString(deal.CONTACT_ID),
      leadId: asString(deal.LEAD_ID),
      dealId
    });
    const lastActivity = asString(deal.LAST_ACTIVITY_TIME);
    const nextActivity = asString(deal.NEXT_ACTIVITY_TIME);
    const entered = currentStageEntered.get(dealId) || "";
    let isOverdue = "";
    if (nextActivity) {
      const deadline = Date.parse(nextActivity);
      if (Number.isFinite(deadline)) {
        isOverdue = deadline < Date.parse(input.syncedAt) ? "true" : "false";
      }
    }

    rows.push({
      snapshot_date: input.snapshotDate,
      deal_id: dealId,
      created_at: createdAt,
      days_open: createdAt ? daysBetween(createdAt, input.syncedAt) : "",
      stage_id: stageId,
      stage_name: input.stageNameById.get(stageId) || "",
      days_in_stage: entered ? daysBetween(entered, input.syncedAt) : "",
      assigned_by_id: asString(deal.ASSIGNED_BY_ID),
      assigned_by_name: input.userNames.get(asString(deal.ASSIGNED_BY_ID)) || "",
      lead_id: asString(deal.LEAD_ID),
      contact_id: asString(deal.CONTACT_ID),
      customer_key: identity.customer_key,
      country_id: "",
      primary_product_id: primary?.PRODUCT_ID != null ? String(primary.PRODUCT_ID) : "",
      primary_product_name: asString(primary?.PRODUCT_NAME),
      opportunity: asNumberString(deal.OPPORTUNITY),
      currency: asString(deal.CURRENCY_ID) || "EUR",
      last_activity_at: lastActivity,
      next_activity_at: nextActivity,
      days_since_last_activity: lastActivity ? daysBetween(lastActivity, input.syncedAt) : "",
      is_overdue: isOverdue,
      is_without_next_activity: nextActivity ? "false" : "true",
      stage_probability: "",
      weighted_amount: "",
      sync_updated_at: input.syncedAt
    });
  }

  return rows.sort((a, b) => a.deal_id.localeCompare(b.deal_id, "en", { numeric: true }));
}

export async function fetchPipelineRaw(input: {
  stageNameById: Map<string, string>;
  stageHistory: StageHistoryRow[];
  syncedAt: string;
}): Promise<{ rows: PipelineRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const deals = await bitrixListAll<BitrixDeal>("crm.deal.list", {
    filter: {
      CATEGORY_ID: SALES_CATEGORY_ID,
      STAGE_SEMANTIC_ID: "P"
    },
    select: [...SELECT_DEAL, SF_FIELDS.dealCountry],
    order: { ID: "ASC" }
  });

  const productMap = new Map<string, ProductRow[]>();
  const dealIds = deals.map((deal) => asString(deal.ID)).filter(Boolean);
  for (const chunk of chunkIds(dealIds, 50)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`p${index}`] = `crm.deal.productrows.get?id=${encodeURIComponent(id)}`;
    });
    const result = await bitrixBatch<ProductRow[]>(cmd);
    chunk.forEach((id, index) => {
      const rows = result[`p${index}`];
      productMap.set(id, Array.isArray(rows) ? rows : []);
    });
  }

  const userNames = await loadUserNames(deals.map((deal) => asString(deal.ASSIGNED_BY_ID)));
  const rows = buildPipelineRows({
    deals,
    stageNameById: input.stageNameById,
    stageHistory: input.stageHistory,
    productMap,
    userNames,
    snapshotDate: input.syncedAt.slice(0, 10),
    syncedAt: input.syncedAt
  });

  if (!rows.length) warnings.push("Active pipeline is empty (CATEGORY_ID=0, STAGE_SEMANTIC_ID=P)");
  return { rows, warnings };
}

export function pipelineToSheetRows(rows: PipelineRow[]): Array<Array<string | number>> {
  return rows.map((row) => PIPELINE_COLUMNS.map((column) => row[column] ?? ""));
}
