import {
  getManagerScheduleSpreadsheetId,
  managerScheduleSpreadsheetUrl
} from "@/config/manager-schedule";
import { getSheetIdByTitle, listSheetTitles, readSheetValues } from "@/lib/google/sheets-client";
import {
  formatIsoMonthRu,
  parseManagerSchedule,
  parseScheduleTabTitle,
  pickScheduleMonth,
  rigaTodayIso,
  type ManagerScheduleMonthOption,
  type ManagerSchedulePayload
} from "@/lib/sales/manager-schedule";

function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function loadManagerSchedule(requestedMonth?: string | null): Promise<ManagerSchedulePayload> {
  const spreadsheetId = getManagerScheduleSpreadsheetId();
  const todayIso = rigaTodayIso();
  const fallbackYear = Number(todayIso.slice(0, 4));
  const titles = await listSheetTitles(spreadsheetId);
  const parsedTabs: ManagerScheduleMonthOption[] = [];
  const seen = new Set<string>();

  for (const title of titles) {
    const parsed = parseScheduleTabTitle(title, fallbackYear);
    if (!parsed) continue;
    if (seen.has(parsed.isoMonth) && !parsed.hasYear) continue;
    if (seen.has(parsed.isoMonth)) {
      const index = parsedTabs.findIndex((tab) => tab.isoMonth === parsed.isoMonth);
      if (index >= 0 && parsed.hasYear) {
        parsedTabs[index] = {
          isoMonth: parsed.isoMonth,
          tabTitle: title,
          label: formatIsoMonthRu(parsed.isoMonth)
        };
      }
      continue;
    }
    seen.add(parsed.isoMonth);
    parsedTabs.push({
      isoMonth: parsed.isoMonth,
      tabTitle: title,
      label: formatIsoMonthRu(parsed.isoMonth)
    });
  }

  parsedTabs.sort((a, b) => b.isoMonth.localeCompare(a.isoMonth));
  if (!parsedTabs.length) {
    throw new Error("В таблице «График» нет листов с месяцами");
  }

  const picked = pickScheduleMonth(parsedTabs, requestedMonth?.trim() || null, todayIso);
  const selectedOption = parsedTabs.find((tab) => tab.isoMonth === picked) ?? parsedTabs[0]!;
  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(selectedOption.tabTitle)}!A1:AZ80`
  });
  const sheetGid = await getSheetIdByTitle(spreadsheetId, selectedOption.tabTitle);
  const parsed = parseManagerSchedule(values, selectedOption.isoMonth);

  return {
    months: parsedTabs,
    selected: {
      ...parsed,
      tabTitle: selectedOption.tabTitle,
      sheetGid
    },
    spreadsheetId,
    spreadsheetUrl: managerScheduleSpreadsheetUrl(sheetGid)
  };
}
