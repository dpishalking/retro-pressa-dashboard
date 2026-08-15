import { PM_SHEETS } from "@/config/predictive-sheets";

/** Active sales managers in Bitrix (SPA Счета type/31, ответственный). */
export type PmSalesManager = {
  bitrixId: string;
  firstName: string;
  fullName: string;
  sheet: string;
  /** Monthly revenue plan (€). Only when set explicitly — never invent. */
  revenuePlan?: number;
};

/** Active roster only — departed managers are omitted until replacements are set. */
export const PM_SALES_MANAGERS: PmSalesManager[] = [
  {
    bitrixId: "98908",
    firstName: "Надежда",
    fullName: "Надежда Веклич",
    sheet: PM_SHEETS.salesNadezhda,
    revenuePlan: 6000
  },
  {
    bitrixId: "3290",
    firstName: "Анастасия",
    fullName: "Anastasija Zabkova",
    sheet: PM_SHEETS.salesAnastasia,
    revenuePlan: 17000
  },
  {
    bitrixId: "29568",
    firstName: "Елена",
    fullName: "Jelena Zabkova",
    sheet: PM_SHEETS.salesElena,
    revenuePlan: 17000
  }
];

export function isManagerSheet(sheetTitle: string): boolean {
  return PM_SALES_MANAGERS.some((m) => m.sheet === sheetTitle);
}

export function managerBySheet(sheetTitle: string): PmSalesManager | undefined {
  return PM_SALES_MANAGERS.find((m) => m.sheet === sheetTitle);
}

export const PM_MANAGER_SHEETS = PM_SALES_MANAGERS.map((m) => m.sheet);

/** Tabs to delete when managers leave (legacy sheets no longer in roster). */
export const PM_RETIRED_MANAGER_SHEETS = [
  "05d_ДАРЬЯ",
  "05e_КРИСТИНА",
  "05f_КИРА",
  "05g_МАРИЯ"
] as const;
