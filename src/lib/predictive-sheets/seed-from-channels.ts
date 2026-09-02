import { readSheetValues } from "@/lib/google/sheets-client";
import {
  getSvodOrganicLeadsTab,
  getSvodPaidLeadsTab,
  getSvodPlanSpreadsheetId,
  parseSvodDayDate,
  parseSvodPlanNumber
} from "@/lib/sales-os/svod-plans";
import type { WeeklyFacts } from "@/lib/predictive-sheets/seed-from-bitrix";
import type { CeoSeedBundle, SeedValue } from "@/lib/predictive-sheets/seed-from-ceo";
import { mondayWeekIndex } from "@/lib/predictive-sheets/weeks";

export type ChannelMonthFacts = {
  paid: {
    spend: number;
    revenue: number;
    leads: number;
    qualifiedLeads: number;
    payments: number;
    spendByWeek: WeeklyFacts;
    revenueByWeek: WeeklyFacts;
    leadsByWeek: WeeklyFacts;
    qlByWeek: WeeklyFacts;
    paymentsByWeek: WeeklyFacts;
  };
  organic: {
    revenue: number;
    leads: number;
    qualifiedLeads: number;
    payments: number;
    revenueByWeek: WeeklyFacts;
    leadsByWeek: WeeklyFacts;
    qlByWeek: WeeklyFacts;
    paymentsByWeek: WeeklyFacts;
  };
  general: {
    spend: number;
    leads: number;
    qualifiedLeads: number;
    spendByWeek: WeeklyFacts;
    leadsByWeek: WeeklyFacts;
    qlByWeek: WeeklyFacts;
  };
  source: string;
};

function emptyWeeks(): WeeklyFacts {
  return [null, null, null, null, null];
}

function addWeek(weeks: WeeklyFacts, isoDate: string, month: string, amount: number) {
  if (!(amount >= 0)) return;
  const week = mondayWeekIndex(isoDate, month);
  if (week == null) return;
  const idx = week - 1;
  weeks[idx] = (weeks[idx] ?? 0) + amount;
}

function quote(tab: string) {
  return `'${tab.replace(/'/g, "''")}'`;
}

function num(row: string[], col: number): number {
  return parseSvodPlanNumber(row[col]) ?? 0;
}

/** СВОД `day` = combined marketing daily; `Органика` = organic breakdown. Paid = day − organic. */
export async function loadSvodChannelFacts(input: {
  month: string;
  throughDate?: string;
}): Promise<ChannelMonthFacts> {
  const spreadsheetId = getSvodPlanSpreadsheetId();
  const paidTab = getSvodPaidLeadsTab();
  const organicTab = getSvodOrganicLeadsTab();
  const [daySheet, orgSheet] = await Promise.all([
    readSheetValues({ spreadsheetId, range: `${quote(paidTab)}!A1:N400` }),
    readSheetValues({ spreadsheetId, range: `${quote(organicTab)}!A1:N400` })
  ]);

  const orgByDate = new Map<
    string,
    { revenue: number; leads: number; ql: number; sales: number }
  >();
  for (const row of orgSheet.slice(2)) {
    const iso = parseSvodDayDate(row[0] || "");
    if (!iso || !iso.startsWith(input.month)) continue;
    if (input.throughDate && iso > input.throughDate) continue;
    orgByDate.set(iso, {
      revenue: num(row, 1),
      leads: num(row, 9),
      ql: num(row, 10),
      sales: num(row, 12)
    });
  }

  const paid = {
    spend: 0,
    revenue: 0,
    leads: 0,
    qualifiedLeads: 0,
    payments: 0,
    spendByWeek: emptyWeeks(),
    revenueByWeek: emptyWeeks(),
    leadsByWeek: emptyWeeks(),
    qlByWeek: emptyWeeks(),
    paymentsByWeek: emptyWeeks()
  };
  const organic = {
    revenue: 0,
    leads: 0,
    qualifiedLeads: 0,
    payments: 0,
    revenueByWeek: emptyWeeks(),
    leadsByWeek: emptyWeeks(),
    qlByWeek: emptyWeeks(),
    paymentsByWeek: emptyWeeks()
  };
  const general = {
    spend: 0,
    leads: 0,
    qualifiedLeads: 0,
    spendByWeek: emptyWeeks(),
    leadsByWeek: emptyWeeks(),
    qlByWeek: emptyWeeks()
  };

  for (const row of daySheet.slice(2)) {
    const iso = parseSvodDayDate(row[0] || "");
    if (!iso || !iso.startsWith(input.month)) continue;
    if (input.throughDate && iso > input.throughDate) continue;
    const spend = num(row, 1);
    const revenue = num(row, 2);
    const leads = num(row, 5);
    const ql = num(row, 6);
    const sales = num(row, 11);
    const org = orgByDate.get(iso) || { revenue: 0, leads: 0, ql: 0, sales: 0 };
    const paidLeads = Math.max(0, leads - org.leads);
    const paidQl = Math.max(0, ql - org.ql);
    const paidSales = Math.max(0, sales - org.sales);
    const paidRev = Math.max(0, revenue - org.revenue);

    paid.spend += spend;
    paid.revenue += paidRev;
    paid.leads += paidLeads;
    paid.qualifiedLeads += paidQl;
    paid.payments += paidSales;
    addWeek(paid.spendByWeek, iso, input.month, spend);
    addWeek(paid.revenueByWeek, iso, input.month, paidRev);
    addWeek(paid.leadsByWeek, iso, input.month, paidLeads);
    addWeek(paid.qlByWeek, iso, input.month, paidQl);
    addWeek(paid.paymentsByWeek, iso, input.month, paidSales);

    organic.revenue += org.revenue;
    organic.leads += org.leads;
    organic.qualifiedLeads += org.ql;
    organic.payments += org.sales;
    addWeek(organic.revenueByWeek, iso, input.month, org.revenue);
    addWeek(organic.leadsByWeek, iso, input.month, org.leads);
    addWeek(organic.qlByWeek, iso, input.month, org.ql);
    addWeek(organic.paymentsByWeek, iso, input.month, org.sales);

    general.spend += spend;
    general.leads += leads;
    general.qualifiedLeads += ql;
    addWeek(general.spendByWeek, iso, input.month, spend);
    addWeek(general.leadsByWeek, iso, input.month, leads);
    addWeek(general.qlByWeek, iso, input.month, ql);
  }

  const round2 = (n: number) => Number(n.toFixed(2));
  paid.spend = round2(paid.spend);
  paid.revenue = round2(paid.revenue);
  organic.revenue = round2(organic.revenue);
  general.spend = round2(general.spend);

  return {
    paid,
    organic,
    general,
    source: `СВОД ${spreadsheetId} tabs ${paidTab} / ${organicTab}`
  };
}

function withFact(base: SeedValue | undefined, fact: number | null, weekFact?: Array<number | null>): SeedValue {
  return {
    plan: base?.plan ?? null,
    fact,
    planNote: base?.planNote,
    weekFact: weekFact ? [...weekFact] : base?.weekFact
  };
}

function rateFact(numer: number, denom: number): number | null {
  if (!(denom > 0)) return null;
  return Number(((numer / denom) * 100).toFixed(1));
}

function unitCost(spend: number, units: number): number | null {
  if (!(units > 0)) return null;
  return Number((spend / units).toFixed(2));
}

function weeklyUnitCost(spend: WeeklyFacts, units: WeeklyFacts): WeeklyFacts {
  return spend.map((value, i) => {
    const count = units[i];
    if (value == null || count == null || !(count > 0)) return null;
    return Number((value / count).toFixed(2));
  }) as WeeklyFacts;
}

function weeklyRoasPercent(revenue: WeeklyFacts, spend: WeeklyFacts): WeeklyFacts {
  return revenue.map((value, i) => {
    const cost = spend[i];
    if (value == null || cost == null || !(cost > 0)) return null;
    return Number(((value / cost) * 100).toFixed(1));
  }) as WeeklyFacts;
}

export function applyChannelFacts(seed: CeoSeedBundle, channels: ChannelMonthFacts): CeoSeedBundle {
  const p = { ...seed.paid };
  const o = { ...seed.organic };
  const g = { ...seed.general };
  const paid = channels.paid;
  const org = channels.organic;

  p.revenue = withFact(p.revenue, paid.revenue, paid.revenueByWeek);
  p.payments = withFact(p.payments, paid.payments, paid.paymentsByWeek);
  p.qualified_leads = withFact(p.qualified_leads, paid.qualifiedLeads, paid.qlByWeek);
  p.leads = withFact(p.leads, paid.leads, paid.leadsByWeek);
  p.budget = withFact(p.budget, paid.spend, paid.spendByWeek);
  p.qualification_rate = withFact(p.qualification_rate, rateFact(paid.qualifiedLeads, paid.leads));
  p.cpl = withFact(p.cpl, unitCost(paid.spend, paid.leads), weeklyUnitCost(paid.spendByWeek, paid.leadsByWeek));
  p.cac = withFact(
    p.cac,
    paid.payments > 0 ? Number((paid.spend / paid.payments).toFixed(2)) : null,
    weeklyUnitCost(paid.spendByWeek, paid.paymentsByWeek)
  );
  p.roas = withFact(
    p.roas,
    paid.spend > 0 ? Number(((paid.revenue / paid.spend) * 100).toFixed(1)) : null,
    weeklyRoasPercent(paid.revenueByWeek, paid.spendByWeek)
  );

  o.revenue = withFact(o.revenue, org.revenue, org.revenueByWeek);
  o.payments = withFact(o.payments, org.payments, org.paymentsByWeek);
  o.qualified_leads = withFact(o.qualified_leads, org.qualifiedLeads, org.qlByWeek);
  o.leads = withFact(o.leads, org.leads, org.leadsByWeek);
  o.qualification_rate = withFact(o.qualification_rate, rateFact(org.qualifiedLeads, org.leads));
  o.lead_to_payment_cr = withFact(o.lead_to_payment_cr, rateFact(org.payments, org.leads));

  g.budget = withFact(g.budget, channels.general.spend, channels.general.spendByWeek);
  g.cpl = withFact(
    g.cpl,
    unitCost(paid.spend, paid.leads),
    weeklyUnitCost(paid.spendByWeek, paid.leadsByWeek)
  );
  if (g.leads?.fact == null) {
    g.leads = withFact(g.leads, channels.general.leads, channels.general.leadsByWeek);
  } else {
    g.leads = { ...g.leads, weekFact: [...channels.general.leadsByWeek] };
  }
  if (g.qualified_leads?.fact == null) {
    g.qualified_leads = withFact(g.qualified_leads, channels.general.qualifiedLeads, channels.general.qlByWeek);
  } else {
    g.qualified_leads = { ...g.qualified_leads, weekFact: [...channels.general.qlByWeek] };
  }

  return {
    ...seed,
    paid: p,
    organic: o,
    general: g,
    source: `${seed.source} + ${channels.source}`
  };
}
