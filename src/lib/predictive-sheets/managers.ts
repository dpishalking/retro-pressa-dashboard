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
  },
  {
    bitrixId: "98726",
    firstName: "Дарья",
    fullName: "Дарья Летова",
    sheet: PM_SHEETS.salesDarya
  },
  {
    bitrixId: "98910",
    firstName: "Кристина",
    fullName: "Кристина Хмурец",
    sheet: PM_SHEETS.salesKristina
  },
  {
    bitrixId: "88130",
    firstName: "Кира",
    fullName: "Кира Самуйлова",
    sheet: PM_SHEETS.salesKira
  },
  {
    bitrixId: "46",
    firstName: "Мария",
    fullName: "Marija Patmalniece",
    sheet: PM_SHEETS.salesMaria
  }
];

export function isManagerSheet(sheetTitle: string): boolean {
  return PM_SALES_MANAGERS.some((m) => m.sheet === sheetTitle);
}

export function managerBySheet(sheetTitle: string): PmSalesManager | undefined {
  return PM_SALES_MANAGERS.find((m) => m.sheet === sheetTitle);
}

export const PM_MANAGER_SHEETS = PM_SALES_MANAGERS.map((m) => m.sheet);
