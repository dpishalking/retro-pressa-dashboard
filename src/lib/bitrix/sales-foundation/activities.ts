import { ACTIVITIES_COLUMNS } from "@/config/sales-foundation";
import { bitrixListAll } from "@/lib/bitrix/rest-client";
import {
  asString,
  classifyActivityGroup,
  loadUserNames,
  periodToRange
} from "@/lib/bitrix/sales-foundation/customer-key";

export type ActivityRow = Record<(typeof ACTIVITIES_COLUMNS)[number], string>;

type BitrixActivity = Record<string, unknown>;

/** Bitrix owner types: 1 lead, 2 deal, 3 contact */
function mapOwner(ownerTypeId: string, ownerId: string) {
  return {
    deal_id: ownerTypeId === "2" ? ownerId : "",
    lead_id: ownerTypeId === "1" ? ownerId : "",
    contact_id: ownerTypeId === "3" ? ownerId : ""
  };
}

export function normalizeActivity(activity: BitrixActivity, userNames: Map<string, string>, syncedAt: string): ActivityRow {
  const ownerTypeId = asString(activity.OWNER_TYPE_ID);
  const ownerId = asString(activity.OWNER_ID);
  const mapped = mapOwner(ownerTypeId, ownerId);
  const providerId = asString(activity.PROVIDER_ID);
  const typeId = asString(activity.TYPE_ID);
  const deadline = asString(activity.DEADLINE);
  const completed = asString(activity.COMPLETED);
  let isOverdue = "";
  if (deadline && completed !== "Y") {
    const ts = Date.parse(deadline);
    if (Number.isFinite(ts)) isOverdue = ts < Date.now() ? "true" : "false";
  }

  return {
    activity_id: asString(activity.ID),
    owner_type_id: ownerTypeId,
    owner_id: ownerId,
    deal_id: mapped.deal_id,
    lead_id: mapped.lead_id,
    contact_id: mapped.contact_id,
    activity_type_id: typeId,
    provider_id: providerId,
    provider_type_id: asString(activity.PROVIDER_TYPE_ID),
    subject: asString(activity.SUBJECT).slice(0, 200),
    direction: asString(activity.DIRECTION),
    created_at: asString(activity.CREATED),
    start_time: asString(activity.START_TIME),
    end_time: asString(activity.END_TIME),
    deadline,
    completed,
    responsible_id: asString(activity.RESPONSIBLE_ID),
    responsible_name: userNames.get(asString(activity.RESPONSIBLE_ID)) || "",
    is_overdue: isOverdue,
    activity_group: classifyActivityGroup(providerId, typeId),
    sync_updated_at: syncedAt
  };
}

export async function fetchActivitiesRaw(
  periods: string[],
  syncedAt: string
): Promise<{ rows: ActivityRow[]; warnings: string[]; errorCode?: string; partial?: boolean }> {
  const warnings: string[] = [];
  const byId = new Map<string, ActivityRow>();

  try {
    for (const period of periods) {
      const { startIso, endIso } = periodToRange(period);
      const activities = await bitrixListAll<BitrixActivity>("crm.activity.list", {
        filter: {
          ">=CREATED": startIso.slice(0, 19),
          "<=CREATED": endIso.slice(0, 19)
        },
        select: [
          "ID", "OWNER_ID", "OWNER_TYPE_ID", "TYPE_ID", "PROVIDER_ID", "PROVIDER_TYPE_ID",
          "SUBJECT", "DIRECTION", "CREATED", "START_TIME", "END_TIME", "DEADLINE",
          "COMPLETED", "RESPONSIBLE_ID"
        ],
        order: { CREATED: "ASC" }
      });
      const userNames = await loadUserNames(activities.map((a) => asString(a.RESPONSIBLE_ID)));
      for (const activity of activities) {
        const row = normalizeActivity(activity, userNames, syncedAt);
        if (row.activity_id) byId.set(row.activity_id, row);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`crm.activity.list failed: ${message}`);
    return {
      rows: [...byId.values()],
      warnings,
      errorCode: "BITRIX_ACTIVITY_DENIED",
      partial: true
    };
  }

  if (!byId.size) warnings.push("No activities returned for requested periods");
  return {
    rows: [...byId.values()].sort((a, b) => a.activity_id.localeCompare(b.activity_id, "en", { numeric: true })),
    warnings
  };
}

export function activitiesToSheetRows(rows: ActivityRow[]): Array<Array<string | number>> {
  return rows.map((row) => ACTIVITIES_COLUMNS.map((column) => row[column] ?? ""));
}
