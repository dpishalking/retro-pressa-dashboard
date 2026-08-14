import type { CeoControlCenterSnapshot } from "@/types/analytics-os";

export type FactorTone = "hurt" | "help" | "neutral";

export type FactorRow = {
  id: string;
  title: string;
  whatHappened: string;
  press: string;
  href: string;
  tone: FactorTone;
  /** Euro effect on MTD gap. Null = explanation only, not in the sum. */
  euroEffect: number | null;
};

export type FactorAnalysisReport = {
  ready: boolean;
  sliced: boolean;
  daysElapsed: number;
  calendarDays: number;
  daysRemaining: number;
  pace: number;
  planMonth: number | null;
  planMtd: number | null;
  fact: number | null;
  gapMtd: number | null;
  identityPlanMtd: number | null;
  identityFact: number | null;
  headline: string;
  pressNow: string;
  pressHref: string;
  factors: FactorRow[];
  notes: string[];
};

export type FactorAnalysisInput = {
  daysElapsed: number;
  calendarDays: number;
  daysRemaining: number;
  planRevenue: number | null;
  factRevenue: number | null;
  planLeads: number | null;
  factLeads: number | null;
  planPaidLeads: number | null;
  factPaidLeads: number | null;
  planOrganicLeads: number | null;
  factOrganicLeads: number | null;
  planCr: number | null;
  factCr: number | null;
  planAov: number | null;
  factAov: number | null;
  invoices: number | null;
  paidOrders: number | null;
  stuckAmount: number | null;
  stuckDeals: number | null;
  adSpend: number | null;
  planSpend: number | null;
  sliced: boolean;
};

function paceOf(daysElapsed: number, calendarDays: number): number {
  if (calendarDays <= 0) return 1;
  return Math.min(1, Math.max(0, daysElapsed / calendarDays));
}

function paced(plan: number | null, pace: number): number | null {
  if (plan == null || !Number.isFinite(plan)) return null;
  return plan * pace;
}

function roundEuro(value: number): number {
  return Math.round(value);
}

function metric(snapshot: CeoControlCenterSnapshot, id: string): { value: number | null; plan: number | null } {
  const row = snapshot.metrics[id];
  return { value: row?.value ?? null, plan: row?.plan ?? null };
}

function funnelCount(snapshot: CeoControlCenterSnapshot, id: string): number | null {
  const row = snapshot.funnel.find((item) => item.id === id);
  return row?.count ?? null;
}

export function factorAnalysisInputFromSnapshot(snapshot: CeoControlCenterSnapshot): FactorAnalysisInput {
  const leads = metric(snapshot, "leads");
  const paid = metric(snapshot, "paid_leads");
  const organic = metric(snapshot, "organic_leads");
  const cr = metric(snapshot, "conversion_rate");
  const aov = metric(snapshot, "aov");
  const spend = snapshot.marketing.adSpend;
  const stuck = snapshot.pipeline.age?.stuckOver7d;
  const sliced = Boolean(snapshot.filters.country || snapshot.filters.managerId || snapshot.filters.productId);
  return {
    daysElapsed: snapshot.plan.daysElapsed,
    calendarDays: snapshot.plan.calendarDays,
    daysRemaining: snapshot.plan.daysRemaining,
    planRevenue: snapshot.plan.planRevenue.value,
    factRevenue: snapshot.plan.factRevenue.value ?? snapshot.metrics.revenue?.value ?? null,
    planLeads: leads.plan,
    factLeads: leads.value,
    planPaidLeads: paid.plan,
    factPaidLeads: paid.value,
    planOrganicLeads: organic.plan,
    factOrganicLeads: organic.value,
    planCr: cr.plan,
    factCr: cr.value,
    planAov: aov.plan,
    factAov: aov.value,
    invoices: funnelCount(snapshot, "invoices"),
    paidOrders: snapshot.metrics.paid_orders?.value ?? funnelCount(snapshot, "paid"),
    stuckAmount: stuck?.amount ?? snapshot.metrics.pipeline_stuck_amount?.value ?? null,
    stuckDeals: stuck?.deals ?? null,
    adSpend: spend.value,
    planSpend: spend.plan ?? null,
    sliced
  };
}

export function buildFactorAnalysis(input: FactorAnalysisInput): FactorAnalysisReport {
  const pace = paceOf(input.daysElapsed, input.calendarDays);
  const planMtd = paced(input.planRevenue, pace);
  const L0 = paced(input.planLeads, pace);
  const L1 = input.factLeads;
  const CR0 = input.planCr;
  const CR1 = input.factCr;
  const AOV0 = input.planAov;
  const AOV1 = input.factAov;
  const identityPlanMtd =
    L0 != null && CR0 != null && AOV0 != null && L0 > 0 && CR0 > 0 && AOV0 > 0 ? L0 * CR0 * AOV0 : null;
  const identityFact =
    L1 != null && CR1 != null && AOV1 != null && L1 > 0 && CR1 > 0 && AOV1 > 0 ? L1 * CR1 * AOV1 : null;
  const fact = input.factRevenue;
  const gapMtd = planMtd != null && fact != null ? fact - planMtd : null;

  const factors: FactorRow[] = [];
  const notes: string[] = [];

  if (input.sliced) {
    notes.push("Стоит фильтр страны, менеджера или продукта — план месяца общий, поэтому разрыв считаем осторожно.");
  }

  notes.push(
    `Сравниваем факт с планом за прошедшие ${input.daysElapsed} из ${input.calendarDays} дней, не с суммой всего месяца.`
  );

  if (L0 != null && L1 != null && CR0 != null && AOV0 != null) {
    const afterLeads = L1 * CR0 * AOV0;
    const euro = afterLeads - L0 * CR0 * AOV0;
    const missing = L0 - L1;
    factors.push({
      id: "leads",
      title: "Лиды",
      whatHappened:
        missing > 1
          ? `Пришло ${Math.round(L1)} лидов вместо ${Math.round(L0)} по темпу месяца. Не хватает примерно ${Math.round(missing)}.`
          : missing < -1
            ? `Лидов больше темпа: ${Math.round(L1)} против ${Math.round(L0)}.`
            : `Лиды идут почти в темпе плана: ${Math.round(L1)}.`,
      press:
        missing > 1
          ? "Жмите в маркетинг: платный трафик и органика. Не раздувайте скидку — людей просто мало."
          : "Объём лидов не главный тормоз. Смотрите конверсию и обработку.",
      href: "/os/marketing",
      tone: euro < -50 ? "hurt" : euro > 50 ? "help" : "neutral",
      euroEffect: roundEuro(euro)
    });
  }

  if (L1 != null && CR0 != null && CR1 != null && AOV0 != null) {
    const before = L1 * CR0 * AOV0;
    const after = L1 * CR1 * AOV0;
    const euro = after - before;
    const planPct = Math.round(CR0 * 1000) / 10;
    const factPct = Math.round(CR1 * 1000) / 10;
    factors.push({
      id: "conversion",
      title: "Конверсия",
      whatHappened:
        CR1 + 0.002 < CR0
          ? `Из лида в оплату проходит ${factPct}%, план ${planPct}%. Люди приходят, но реже платят.`
          : CR1 > CR0 + 0.002
            ? `Конверсия выше плана: ${factPct}% против ${planPct}%.`
            : `Конверсия около плана: ${factPct}%.`,
      press:
        CR1 + 0.002 < CR0
          ? "Жмите в воронку: сначала ответы и счета, не новый бюджет."
          : "Конверсию держите. Рост ищите в лидах или чеке.",
      href: "/os/funnel",
      tone: euro < -50 ? "hurt" : euro > 50 ? "help" : "neutral",
      euroEffect: roundEuro(euro)
    });
  }

  if (L1 != null && CR1 != null && AOV0 != null && AOV1 != null) {
    const before = L1 * CR1 * AOV0;
    const after = L1 * CR1 * AOV1;
    const euro = after - before;
    factors.push({
      id: "aov",
      title: "Средний чек",
      whatHappened:
        AOV1 > AOV0 + 1
          ? `Чек ${Math.round(AOV1)} €, план ${Math.round(AOV0)} €. Покупают чуть дороже — это плюс.`
          : AOV1 + 1 < AOV0
            ? `Чек ${Math.round(AOV1)} € ниже плана ${Math.round(AOV0)} €.`
            : `Чек около плана: ${Math.round(AOV1)} €.`,
      press:
        AOV1 + 1 < AOV0
          ? "Жмите в продукт: меньше скидок, сильнее основной оффер."
          : "Чек не чините. Он не мешает росту.",
      href: "/os/products",
      tone: euro < -50 ? "hurt" : euro > 50 ? "help" : "neutral",
      euroEffect: roundEuro(euro)
    });
  }

  const paid0 = paced(input.planPaidLeads, pace);
  const org0 = paced(input.planOrganicLeads, pace);
  if (paid0 != null && input.factPaidLeads != null && org0 != null && input.factOrganicLeads != null) {
    const paidMiss = paid0 - input.factPaidLeads;
    const orgMiss = org0 - input.factOrganicLeads;
    const paidWorse = paidMiss > orgMiss && paidMiss > 5;
    factors.push({
      id: "mix",
      title: "Откуда лиды",
      whatHappened: paidWorse
        ? `Недобор почти весь в рекламе: платных ${Math.round(input.factPaidLeads)} вместо ${Math.round(paid0)}, органика ближе к темпу.`
        : orgMiss > paidMiss && orgMiss > 5
          ? `Органика отстаёт сильнее рекламы: ${Math.round(input.factOrganicLeads)} вместо ${Math.round(org0)}.`
          : `Платные и органика отстают примерно одинаково.`,
      press: paidWorse
        ? "Жмите в рекламу и лендинги, не в «весь маркетинг сразу»."
        : "Смотрите и рекламу, и органику — дыра не в одном канале.",
      href: "/os/marketing",
      tone: paidMiss + orgMiss > 10 ? "hurt" : "neutral",
      euroEffect: null
    });
  }

  if (input.factLeads != null && input.factLeads > 0 && input.invoices != null && input.paidOrders != null) {
    const toInvoice = input.invoices / input.factLeads;
    const toPay = input.invoices > 0 ? input.paidOrders / input.invoices : null;
    const invoiceWeak = toInvoice < 0.18;
    const payStrong = toPay != null && toPay >= 0.85;
    factors.push({
      id: "funnel",
      title: "Воронка в Bitrix",
      whatHappened: invoiceWeak
        ? payStrong
          ? `Счёт выставляют редко (${Math.round(toInvoice * 1000) / 10}% лидов), но кто получил счёт — почти все платят. Ломается до счёта, не на оплате.`
          : `И счета, и оплаты слабые. Смотрите и квалификацию, и закрытие.`
        : payStrong
          ? `Счета и оплаты выглядят ровно. Узкое место не в «не платят».`
          : `Счета есть, но до оплаты доходит меньше обычного.`,
      press: invoiceWeak
        ? "Жмите в скорость ответа и выставление счетов. Скидку на кассе это не лечит."
        : "Дожимайте открытые счета и зависшие сделки.",
      href: "/os/funnel",
      tone: invoiceWeak || (toPay != null && toPay < 0.7) ? "hurt" : "neutral",
      euroEffect: null
    });
  }

  if (input.stuckAmount != null && input.stuckAmount > 0) {
    factors.push({
      id: "stuck",
      title: "Зависшие сделки",
      whatHappened:
        input.stuckDeals != null && input.stuckDeals > 0
          ? `${input.stuckDeals} сделок без нормального касания, в них примерно ${roundEuro(input.stuckAmount)} €.`
          : `В открытой воронке зависло примерно ${roundEuro(input.stuckAmount)} €.`,
      press: "Жмите в менеджеров: это уже пришедшие деньги, их не надо заново покупать рекламой.",
      href: "/os/managers",
      tone: "hurt",
      euroEffect: null
    });
  }

  if (input.adSpend != null && input.planSpend != null && input.planSpend > 0 && L0 != null && L1 != null) {
    const spendMtd = paced(input.planSpend, pace) ?? input.planSpend * pace;
    const spendOnPace = input.adSpend >= spendMtd * 0.85;
    const leadsBehind = L1 < L0 * 0.9;
    if (spendOnPace && leadsBehind) {
      notes.push(
        "Рекламный бюджет идёт почти в темпе, а лидов меньше плана. Лид стал дороже — сначала разберите качество трафика, не режьте бюджет вслепую."
      );
    }
  }

  notes.push("Не объясняем креатив, сезон и настроение рынка — этого нет в кассе и Bitrix.");

  const waterfall = factors.filter((row) => row.euroEffect != null);
  const hurt = [...waterfall].filter((row) => row.tone === "hurt").sort((a, b) => (a.euroEffect ?? 0) - (b.euroEffect ?? 0));
  const help = waterfall.filter((row) => row.tone === "help");
  const topHurt = hurt[0] ?? factors.find((row) => row.tone === "hurt") ?? null;
  const topHelp = help[0] ?? null;

  let headline = "Пока не хватает плана или факта, чтобы разложить месяц.";
  let pressNow = "Откройте план и сводку — без них нельзя сказать, куда жать.";
  let pressHref = "/os/plan";
  const ready = identityPlanMtd != null || planMtd != null;

  if (ready && gapMtd != null) {
    if (gapMtd >= 0) {
      headline = "Темп месяца не отстаёт. Держите то, что уже работает.";
      pressNow = topHurt
        ? `Даже в плюсе смотрите: ${topHurt.title.toLowerCase()}. ${topHurt.press}`
        : "Не раздувайте скидки и не сбивайте обработку.";
      pressHref = topHurt?.href ?? "/os/funnel";
    } else if (topHurt) {
      const helpBit = topHelp ? ` ${topHelp.title} даже помогает.` : "";
      headline = `Отстаём от темпа месяца. Больше всего мешают ${topHurt.title.toLowerCase()}.${helpBit}`;
      pressNow = topHurt.press;
      pressHref = topHurt.href;
    } else {
      headline = "Факт ниже темпа плана. Разложение по лидам, конверсии и чеку не собралось — сверка неполная.";
      pressNow = "Сверьте лиды СВОД, оплаты Bitrix и план ОБЩИЕ.";
      pressHref = "/os/sources";
    }
  }

  return {
    ready,
    sliced: input.sliced,
    daysElapsed: input.daysElapsed,
    calendarDays: input.calendarDays,
    daysRemaining: input.daysRemaining,
    pace,
    planMonth: input.planRevenue,
    planMtd: planMtd != null ? roundEuro(planMtd) : null,
    fact: fact != null ? roundEuro(fact) : null,
    gapMtd: gapMtd != null ? roundEuro(gapMtd) : null,
    identityPlanMtd: identityPlanMtd != null ? roundEuro(identityPlanMtd) : null,
    identityFact: identityFact != null ? roundEuro(identityFact) : null,
    headline,
    pressNow,
    pressHref,
    factors,
    notes
  };
}

export function buildFactorAnalysisFromSnapshot(snapshot: CeoControlCenterSnapshot): FactorAnalysisReport {
  return buildFactorAnalysis(factorAnalysisInputFromSnapshot(snapshot));
}
