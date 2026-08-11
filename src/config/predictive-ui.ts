/**
 * UI sources for /predictive.
 *
 * Plans (CEO «План/факт»):
 * https://docs.google.com/spreadsheets/d/16ocjHOlOjnJacYhlLxhdF-so5FclgIijImC_vsMlsLM
 *   gid=2079098693 → «План/факт»
 *
 * Marketing front:
 * https://docs.google.com/spreadsheets/d/1Ru9H24Hs2WPNcP2TEGpvIEcRtjnDV8l-UyBnWNFakN4
 *   gid=966367597 → «Маркетинг общий»
 *   gid=470078609 → «Лист2» (plan board: выручка, лиды, ROAS, budget…)
 *
 * Sales fact/forecast:
 * Sales OS → 98_PREDICTION_EXPORT, fallback «Предиктивка продажи»
 */

import { getMarketingPlanningSpreadsheetId, MARKETING_PLANNING_SHEETS } from "@/config/marketing-planning";
import { getSalesOsSpreadsheetId, SALES_OS_SHEETS } from "@/config/sales-os";
import {
  getMonthlyPlanSpreadsheetId,
  getMonthlyPlanTabTitle,
  MONTHLY_PLAN_GID_DEFAULT
} from "@/lib/sales-os/svod-plans";
import { getPredictiveSpreadsheetId, getPredictiveTabTitle } from "@/lib/sales-os/predictive-model";

export const PREDICTIVE_UI = {
  plans: {
    spreadsheetId: () => getMonthlyPlanSpreadsheetId(),
    tabTitle: () => getMonthlyPlanTabTitle(),
    sheetGid: Number(MONTHLY_PLAN_GID_DEFAULT)
  },
  marketing: {
    spreadsheetId: () => getMarketingPlanningSpreadsheetId(),
    tabTitle: MARKETING_PLANNING_SHEETS.marketingGeneral,
    sheetGid: 966367597,
    planBoardTab: "Лист2",
    planBoardGid: 470078609
  },
  sales: {
    spreadsheetId: () => getSalesOsSpreadsheetId(),
    exportTab: SALES_OS_SHEETS.predictionExport,
    /** Live ROP front — used when export has no rows for the selected month. */
    frontSpreadsheetId: () => getPredictiveSpreadsheetId(),
    frontTabTitle: () => getPredictiveTabTitle()
  }
} as const;
