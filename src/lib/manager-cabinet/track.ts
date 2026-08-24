import { addCalendarDays } from "@/lib/manager-cabinet/dates";
import type { ManagerCabinetFacts } from "@/lib/manager-cabinet/types";
import type { MopPayTrack } from "@/types/auth";

export const INTERNSHIP_DAYS = 3;
export const TRIAL_DAYS = 5;
export const INTERNSHIP_COMMISSION_PCT = 0.11;
export const TRIAL_COMMISSION_PCT = 0.1;
export const TRIAL_BONUS_RUB = 8000;
export const TRIAL_SALES_TARGET = 5;

export type OnboardingStage = "internship" | "trial" | "regular";

export type PayTrackInput = {
  mopPayTrack?: MopPayTrack | null;
  internshipStartedOn?: string | null;
  approvedAt?: string | null;
};

export type OnboardingWindows = {
  start: string;
  internshipEnd: string;
  trialStart: string;
  trialEnd: string;
};

export function buildOnboardingWindows(start: string): OnboardingWindows {
  return {
    start,
    internshipEnd: addCalendarDays(start, INTERNSHIP_DAYS - 1),
    trialStart: addCalendarDays(start, INTERNSHIP_DAYS),
    trialEnd: addCalendarDays(start, INTERNSHIP_DAYS + TRIAL_DAYS - 1)
  };
}

export function resolveOnboardingStage(input: PayTrackInput, asOf: string): OnboardingStage {
  const forced = input.mopPayTrack ?? "regular";
  if (input.approvedAt || forced === "regular") return "regular";
  if (forced === "internship") return "internship";
  if (forced === "trial") return "trial";

  const start = input.internshipStartedOn?.trim();
  if (!start) return "regular";
  const windows = buildOnboardingWindows(start);
  if (asOf <= windows.internshipEnd) return "internship";
  return "trial";
}

export function dayNumberInWindow(asOf: string, start: string, end: string, total: number): number {
  if (asOf < start) return 1;
  if (asOf > end) return total;
  let day = 1;
  let cursor = start;
  while (cursor < asOf && cursor < end) {
    cursor = addCalendarDays(cursor, 1);
    day += 1;
  }
  return Math.min(total, Math.max(1, day));
}

export function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function bonusEurFromRub(rub: number, rubPerEur: number): number {
  if (!(rubPerEur > 0)) return 0;
  return round2(rub / rubPerEur);
}

export function calculateOnboardingPay(input: {
  internship: Pick<ManagerCabinetFacts, "payments" | "revenueEur">;
  trial: Pick<ManagerCabinetFacts, "payments" | "revenueEur">;
  trialStarted: boolean;
  rubPerEur: number;
}): {
  internshipPayEur: number;
  trialCommissionEur: number;
  trialBonusEur: number;
  trialBonusApplied: boolean;
  totalEur: number;
} {
  const internshipPayEur = round2(input.internship.revenueEur * INTERNSHIP_COMMISSION_PCT);
  const trialCommissionEur = input.trialStarted ? round2(input.trial.revenueEur * TRIAL_COMMISSION_PCT) : 0;
  const trialBonusApplied = input.trialStarted && input.trial.payments >= TRIAL_SALES_TARGET;
  const trialBonusEur = trialBonusApplied ? bonusEurFromRub(TRIAL_BONUS_RUB, input.rubPerEur) : 0;
  return {
    internshipPayEur,
    trialCommissionEur,
    trialBonusEur,
    trialBonusApplied,
    totalEur: round2(internshipPayEur + trialCommissionEur + trialBonusEur)
  };
}
