import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  currentAnalyticsPeriod,
  knownLegacyAnalyticsPeriods,
  parseAnalyticsPeriod,
  analyticsPeriodToLegacy,
  periodCalendarBounds
} from "@/lib/analytics-os/period";
import type { AnalyticsPeriod } from "@/types/analytics-os";
import { findUserById, listPublicUsers, listTraineeUsers } from "@/lib/auth/store";
import { listBitrixSnapshotPeriods, readBitrixSnapshot, type BitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import { canPickCabinetManager } from "@/lib/manager-cabinet/access";
import { aggregateManagerCabinetFacts } from "@/lib/manager-cabinet/facts";
import { matchUniqueByName } from "@/lib/manager-cabinet/match";
import { cabinetWindowBounds, parseCabinetWindow } from "@/lib/manager-cabinet/period";
import { firstNameFrom } from "@/lib/manager-cabinet/dates";
import { buildPayTips } from "@/lib/manager-cabinet/pay-tips";
import { resolveCabinetTarget } from "@/lib/manager-cabinet/resolve-target";
import { loadBitrixRoster, revenuePlanForBitrixId } from "@/lib/manager-cabinet/roster";
import type {
  CabinetWindow,
  ManagerCabinetPayload,
  ManagerCabinetShifts
} from "@/lib/manager-cabinet/types";
import { calculateManagerPayroll, prorateByShifts } from "@/lib/payroll/calculator";
import { DEFAULT_PAYROLL_PARAMS } from "@/lib/payroll/defaults";
import { loadManagerSchedule } from "@/lib/sales/load-manager-schedule";
import type { SessionUser, AppUserPublic } from "@/types/auth";

const DEFAULT_NORM_SHIFTS = 15;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

async function loadSnapshot(period: AnalyticsPeriod): Promise<BitrixSnapshot | null> {
  const legacy = analyticsPeriodToLegacy(period);
  if (legacy) {
    const snap = await readBitrixSnapshot(legacy);
    if (snap) return snap;
  }
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "bitrix-snapshots", `${period}.json`), "utf8");
    const parsed = JSON.parse(raw) as BitrixSnapshot;
    if (parsed?.version === 2 && Array.isArray(parsed.paidDeals)) return parsed;
  } catch {
    /* no iso snapshot */
  }
  return null;
}

async function availablePeriods(): Promise<string[]> {
  const keys = new Set<string>(knownLegacyAnalyticsPeriods());
  keys.add(currentAnalyticsPeriod());
  try {
    for (const key of await listBitrixSnapshotPeriods()) {
      if (key === "may-2026") keys.add("2026-05");
      else if (key === "june-2026") keys.add("2026-06");
      else if (key === "july-2026") keys.add("2026-07");
      else if (key === "august-2026") keys.add("2026-08");
      else if (/^\d{4}-\d{2}$/.test(key)) keys.add(key);
    }
  } catch {
    /* snapshots optional */
  }
  return [...keys].sort();
}

export { resolveBitrixUserId } from "@/lib/manager-cabinet/resolve-target";

async function loadShifts(input: {
  period: string;
  start: string;
  end: string;
  managerName: string;
}): Promise<ManagerCabinetShifts> {
  const fallback: ManagerCabinetShifts = {
    worked: null,
    norm: DEFAULT_NORM_SHIFTS,
    source: "none",
    matchedName: null
  };
  try {
    const schedule = await loadManagerSchedule(input.period);
    const match = matchUniqueByName(
      input.managerName,
      schedule.selected.managers.map((row) => ({ name: row.name, firstName: row.name, shifts: row.shifts }))
    );
    const norm = schedule.selected.normShifts && schedule.selected.normShifts > 0
      ? schedule.selected.normShifts
      : DEFAULT_NORM_SHIFTS;
    if (!match) return { ...fallback, norm, source: "none" };
    const worked = schedule.selected.days.reduce((sum, day, index) => {
      if (day.date < input.start || day.date > input.end) return sum;
      return sum + (match.shifts[index] ? 1 : 0);
    }, 0);
    return { worked, norm, source: "schedule", matchedName: match.name };
  } catch {
    return fallback;
  }
}

export async function resolveCabinetSessionTarget(input: {
  session: SessionUser;
  managerId?: string | null;
}) {
  const roster = await loadBitrixRoster();
  const selfRecord = await findUserById(input.session.id);
  const self: AppUserPublic | null = selfRecord
    ? (({ passwordHash: _passwordHash, ...publicUser }) => publicUser)(selfRecord)
    : null;
  const catalog = canPickCabinetManager(input.session.accessLevel)
    ? input.session.accessLevel === "rop"
      ? await listTraineeUsers()
      : await listPublicUsers()
    : self
      ? [self]
      : [];

  const target = resolveCabinetTarget({
    accessLevel: input.session.accessLevel,
    sessionId: input.session.id,
    requestedId: canPickCabinetManager(input.session.accessLevel) ? input.managerId?.trim() || null : null,
    users: catalog,
    roster
  });
  return { roster, target };
}

export async function loadManagerCabinet(input: {
  session: SessionUser;
  period?: string | null;
  window?: string | null;
  managerId?: string | null;
}): Promise<ManagerCabinetPayload> {
  const period = parseAnalyticsPeriod(input.period);
  const window: CabinetWindow = parseCabinetWindow(input.window);
  const { start, end } = cabinetWindowBounds(period, window);
  const periods = await availablePeriods();
  const { roster, target } = await resolveCabinetSessionTarget(input);
  const bitrixUserId = target.bitrixUserId;
  const managerName = target.managerName;
  const helloName = firstNameFrom(managerName || target.authName || input.session.name);

  const base = {
    ok: true as const,
    period,
    window,
    windowStart: start,
    windowEnd: end,
    availablePeriods: periods,
    viewer: { id: input.session.id, name: input.session.name, accessLevel: input.session.accessLevel },
    roster,
    selected: {
      authUserId: target.authUserId,
      authName: target.authName,
      bitrixUserId,
      managerName
    }
  };

  if (!bitrixUserId || !managerName) {
    const picker = canPickCabinetManager(input.session.accessLevel);
    return {
      ...base,
      linked: false,
      facts: null,
      shifts: { worked: null, norm: DEFAULT_NORM_SHIFTS, source: "none", matchedName: null },
      payroll: null,
      planEur: null,
      planProratedEur: null,
      salaryProratedEur: null,
      softBonusesOnFullMonth: window === "month",
      snapshotAsOf: null,
      message: picker
        ? "В Bitrix нет менеджеров для просмотра. Обновите синхронизацию CRM."
        : "Аккаунт не привязан к менеджеру Bitrix. РОП может указать ответственного в «Доступах».",
      helloName,
      payTips: []
    };
  }

  const snapshot = await loadSnapshot(period);
  if (!snapshot) {
    return {
      ...base,
      linked: true,
      facts: null,
      shifts: { worked: null, norm: DEFAULT_NORM_SHIFTS, source: "none", matchedName: null },
      payroll: null,
      planEur: revenuePlanForBitrixId(bitrixUserId, roster),
      planProratedEur: null,
      salaryProratedEur: null,
      softBonusesOnFullMonth: window === "month",
      snapshotAsOf: null,
      message: `Нет снимка Bitrix за ${period}. Обновите синхронизацию CRM.`,
      helloName,
      payTips: []
    };
  }

  const facts = aggregateManagerCabinetFacts({
    snapshot,
    bitrixUserId,
    managerName,
    start,
    end
  });
  const shifts = await loadShifts({ period, start, end, managerName });
  const planEur = revenuePlanForBitrixId(bitrixUserId, roster);
  const worked = shifts.worked;
  const salaryProratedEur =
    worked != null ? round2(prorateByShifts(DEFAULT_PAYROLL_PARAMS.salaryEur, worked, shifts.norm)) : DEFAULT_PAYROLL_PARAMS.salaryEur;
  const planProratedEur =
    planEur != null && worked != null ? round2(prorateByShifts(planEur, worked, shifts.norm)) : planEur;
  const applySoftBonuses = window === "month";
  const { calendarDays } = periodCalendarBounds(period);

  const payroll = calculateManagerPayroll(
    {
      ...DEFAULT_PAYROLL_PARAMS,
      salaryEur: salaryProratedEur,
      salesPlanEur: planProratedEur
    },
    {
      id: bitrixUserId,
      name: managerName,
      revenueEur: facts.revenueEur,
      leads: facts.leads,
      workingDays: worked ?? calendarDays,
      invoiceCrPct: facts.invoiceCrPct,
      paymentCrPct: applySoftBonuses ? facts.paymentCrPct : null,
      avgCheckEur: applySoftBonuses ? facts.avgCheckEur : null,
      payments: facts.payments
    }
  );

  return {
    ...base,
    linked: true,
    facts,
    shifts,
    payroll,
    planEur,
    planProratedEur,
    salaryProratedEur,
    softBonusesOnFullMonth: applySoftBonuses,
    snapshotAsOf: snapshot.createdAt,
    message: null,
    helloName,
    payTips: buildPayTips({
      facts,
      payroll,
      shifts,
      salaryProratedEur,
      softBonusesOnFullMonth: applySoftBonuses
    })
  };
}
