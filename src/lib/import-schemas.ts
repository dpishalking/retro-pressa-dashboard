import { z } from "zod";

export const monthlyMetricsSchema = z.object({
  month: z.string(),
  paidLeads: z.coerce.number().nonnegative(),
  organicLeads: z.coerce.number().nonnegative(),
  invoicesCount: z.coerce.number().nonnegative(),
  invoicesAmount: z.coerce.number().nonnegative(),
  cancelledInvoicesCount: z.coerce.number().nonnegative(),
  cancelledInvoicesAmount: z.coerce.number().nonnegative(),
  salesCount: z.coerce.number().nonnegative(),
  revenue: z.coerce.number().nonnegative(),
  adSpend: z.coerce.number().nonnegative(),
  workingDays: z.coerce.number().positive(),
  calendarDays: z.coerce.number().positive()
});

export const dailyMetricsSchema = z.object({
  date: z.string(),
  paidLeads: z.coerce.number().nonnegative(),
  organicLeads: z.coerce.number().nonnegative(),
  invoicesCount: z.coerce.number().nonnegative(),
  salesCount: z.coerce.number().nonnegative(),
  revenue: z.coerce.number().nonnegative(),
  adSpend: z.coerce.number().nonnegative(),
  averagePaidCheck: z.coerce.number().nonnegative(),
  activeManagers: z.coerce.number().positive()
});

export type CsvValidationResult = {
  importedRows: number;
  errors: string[];
  lastSyncAt: string;
};
