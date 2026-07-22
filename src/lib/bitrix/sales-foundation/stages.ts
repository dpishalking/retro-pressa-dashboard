import { SALES_CATEGORY_ID, STAGES_COLUMNS } from "@/config/sales-foundation";
import { bitrixResult } from "@/lib/bitrix/rest-client";
import { asString } from "@/lib/bitrix/sales-foundation/customer-key";

export type StageRow = Record<(typeof STAGES_COLUMNS)[number], string>;

type BitrixStage = {
  STATUS_ID?: string;
  NAME?: string;
  SORT?: string | number;
  SEMANTICS?: string;
};

/**
 * Dictionary of deal stages for sales category.
 * Method: crm.dealcategory.stage.list (id = category id).
 */
export async function fetchStagesRaw(syncedAt: string): Promise<{
  rows: StageRow[];
  warnings: string[];
  stageNameById: Map<string, string>;
}> {
  const warnings: string[] = [];
  const stageNameById = new Map<string, string>();
  let stages: BitrixStage[] = [];

  try {
    stages = await bitrixResult<BitrixStage[]>("crm.dealcategory.stage.list", {
      id: SALES_CATEGORY_ID
    });
  } catch (error) {
    warnings.push(
      `crm.dealcategory.stage.list failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return { rows: [], warnings, stageNameById };
  }

  const rows: StageRow[] = (Array.isArray(stages) ? stages : []).map((stage) => {
    const stageId = asString(stage.STATUS_ID);
    const semantic = asString(stage.SEMANTICS);
    const name = asString(stage.NAME);
    if (stageId) stageNameById.set(stageId, name);
    return {
      stage_id: stageId,
      category_id: String(SALES_CATEGORY_ID),
      stage_name: name,
      sort: asString(stage.SORT),
      semantic,
      is_final: semantic === "S" || semantic === "F" ? "true" : "false",
      is_success: semantic === "S" ? "true" : "false",
      is_failure: semantic === "F" ? "true" : "false",
      business_stage_id: "",
      business_stage_name: "",
      is_active: "true",
      sync_updated_at: syncedAt
    };
  });

  return { rows, warnings, stageNameById };
}

export function stagesToSheetRows(rows: StageRow[]): Array<Array<string | number>> {
  return rows.map((row) => STAGES_COLUMNS.map((column) => row[column] ?? ""));
}
