import { buildShiftFeedbackReport } from "@/lib/shift-feedback/build";
import { listShiftFeedbackDays, writeShiftFeedback } from "@/lib/shift-feedback/store";
import { moscowDateIso } from "@/lib/shift-feedback/time";
import type { ShiftFeedbackReport } from "@/lib/shift-feedback/types";

export async function syncShiftFeedback(day?: string): Promise<{
  report: ShiftFeedbackReport;
  days: string[];
}> {
  const report = await buildShiftFeedbackReport(day || moscowDateIso());
  await writeShiftFeedback(report);
  const days = await listShiftFeedbackDays(21);
  return { report, days };
}
