import type { ManagerPayrollResult } from "@/lib/payroll/types";

export type CabinetWindow = "month" | "h1" | "h2";

export type BitrixRosterEntry = {
  bitrixId: string;
  name: string;
  firstName: string;
  revenuePlan: number | null;
  activeRoster: boolean;
};

export type CabinetDealRow = {
  id: string;
  title: string;
  date: string | null;
  amountEur: number;
};

export type ManagerCabinetFacts = {
  bitrixUserId: string;
  managerName: string;
  leads: number;
  qualifiedLeads: number;
  invoices: number;
  payments: number;
  revenueEur: number;
  avgCheckEur: number | null;
  invoiceCrPct: number | null;
  paymentCrPct: number | null;
  qualifiedCrPct: number | null;
  deals: CabinetDealRow[];
};

export type ManagerCabinetShifts = {
  worked: number | null;
  norm: number;
  source: "schedule" | "calendar" | "none";
  matchedName: string | null;
};

export type ManagerCabinetPayload = {
  ok: true;
  linked: boolean;
  period: string;
  window: CabinetWindow;
  windowStart: string;
  windowEnd: string;
  availablePeriods: string[];
  viewer: { id: string; name: string; accessLevel: string };
  roster: BitrixRosterEntry[];
  selected: {
    authUserId: string | null;
    authName: string | null;
    bitrixUserId: string | null;
    managerName: string | null;
  };
  facts: ManagerCabinetFacts | null;
  shifts: ManagerCabinetShifts;
  payroll: ManagerPayrollResult | null;
  planEur: number | null;
  planProratedEur: number | null;
  salaryProratedEur: number | null;
  softBonusesOnFullMonth: boolean;
  snapshotAsOf: string | null;
  message: string | null;
};
