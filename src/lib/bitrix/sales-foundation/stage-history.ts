import { SALES_CATEGORY_ID, STAGE_HISTORY_COLUMNS } from "@/config/sales-foundation";
import { bitrixListAll } from "@/lib/bitrix/rest-client";
import {
  asString,
  deterministicEventId,
  periodToRange
} from "@/lib/bitrix/sales-foundation/customer-key";

export type StageHistoryRow = Record<(typeof STAGE_HISTORY_COLUMNS)[number], string>;

type BitrixStageHistory = {
  ID?: string | number;
  OWNER_ID?: string | number;
  CREATED_TIME?: string;
  STAGE_ID?: string;
  CATEGORY_ID?: string | number;
  TYPE_ID?: string | number;
};

export function buildStageHistoryRows(
  events: BitrixStageHistory[],
  stageNameById: Map<string, string>,
  syncedAt: string
): StageHistoryRow[] {
  const byDeal = new Map<string, BitrixStageHistory[]>();
  for (const event of events) {
    const dealId = asString(event.OWNER_ID);
    if (!dealId || !asString(event.STAGE_ID) || !asString(event.CREATED_TIME)) continue;
    const list = byDeal.get(dealId) || [];
    list.push(event);
    byDeal.set(dealId, list);
  }

  const rows: StageHistoryRow[] = [];
  for (const [dealId, list] of byDeal) {
    list.sort((a, b) => asString(a.CREATED_TIME).localeCompare(asString(b.CREATED_TIME)));
    for (let index = 0; index < list.length; index += 1) {
      const event = list[index];
      const next = list[index + 1];
      const stageId = asString(event.STAGE_ID);
      const enteredAt = asString(event.CREATED_TIME);
      const leftAt = next ? asString(next.CREATED_TIME) : "";
      const isCurrent = !next;
      let durationMinutes = "";
      if (leftAt) {
        const ms = Date.parse(leftAt) - Date.parse(enteredAt);
        if (Number.isFinite(ms) && ms >= 0) durationMinutes = String(Math.round(ms / 60000));
      }
      rows.push({
        event_id: deterministicEventId([dealId, stageId, enteredAt]),
        deal_id: dealId,
        category_id: asString(event.CATEGORY_ID) || String(SALES_CATEGORY_ID),
        stage_id: stageId,
        stage_name: stageNameById.get(stageId) || "",
        stage_semantic: "",
        entered_at: enteredAt,
        left_at: leftAt,
        duration_minutes: durationMinutes,
        is_current_stage: isCurrent ? "true" : "false",
        event_source: "crm.stagehistory.list",
        sync_updated_at: syncedAt
      });
    }
  }

  return rows.sort((a, b) => a.event_id.localeCompare(b.event_id));
}

export async function fetchStageHistoryRaw(
  periods: string[],
  stageNameById: Map<string, string>,
  syncedAt: string
): Promise<{ rows: StageHistoryRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const byEventId = new Map<string, StageHistoryRow>();

  for (const period of periods) {
    const { startIso, endIso } = periodToRange(period);
    const events = await bitrixListAll<BitrixStageHistory>("crm.stagehistory.list", {
      entityTypeId: 2,
      filter: {
        ">=CREATED_TIME": startIso.slice(0, 19),
        "<=CREATED_TIME": endIso.slice(0, 19),
        "=CATEGORY_ID": SALES_CATEGORY_ID
      },
      select: ["ID", "OWNER_ID", "CREATED_TIME", "STAGE_ID", "CATEGORY_ID", "TYPE_ID"],
      order: { CREATED_TIME: "ASC" }
    });
    for (const row of buildStageHistoryRows(events, stageNameById, syncedAt)) {
      byEventId.set(row.event_id, row);
    }
  }

  // Recompute left_at / current across merged periods per deal.
  const merged = buildStageHistoryRows(
    [...byEventId.values()].map((row) => ({
      OWNER_ID: row.deal_id,
      CREATED_TIME: row.entered_at,
      STAGE_ID: row.stage_id,
      CATEGORY_ID: row.category_id
    })),
    stageNameById,
    syncedAt
  );

  if (!merged.length) warnings.push("No stage history events for requested periods");
  return { rows: merged, warnings };
}

export function stageHistoryToSheetRows(rows: StageHistoryRow[]): Array<Array<string | number>> {
  return rows.map((row) => STAGE_HISTORY_COLUMNS.map((column) => row[column] ?? ""));
}
