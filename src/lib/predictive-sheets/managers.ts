import { PM_SHEETS } from "@/config/predictive-sheets";

/** Active sales managers in Bitrix (воронка Продажа). Plans are not split 1/3. */
export type PmSalesManager = {
  bitrixId: string;
  firstName: string;
  fullName: string;
  sheet: string;
};

export const PM_SALES_MANAGERS: PmSalesManager[] = [
  {
    bitrixId: "98908",
    firstName: "Надежда",
    fullName: "Надежда Веклич",
    sheet: PM_SHEETS.salesNadezhda
  },
  {
    bitrixId: "3290",
    firstName: "Анастасия",
    fullName: "Anastasija Zabkova",
    sheet: PM_SHEETS.salesAnastasia
  },
  {
    bitrixId: "29568",
    firstName: "Елена",
    fullName: "Jelena Zabkova",
    sheet: PM_SHEETS.salesElena
  }
];

export function isManagerSheet(sheetTitle: string): boolean {
  return PM_SALES_MANAGERS.some((m) => m.sheet === sheetTitle);
}

export function managerBySheet(sheetTitle: string): PmSalesManager | undefined {
  return PM_SALES_MANAGERS.find((m) => m.sheet === sheetTitle);
}

export const PM_MANAGER_SHEETS = PM_SALES_MANAGERS.map((m) => m.sheet);
