import { buildFactorAnalysisFromSnapshot, type FactorAnalysisReport } from "@/lib/analytics-os/factor-analysis";
import { eur, number, pct } from "@/lib/format";
import type { AnalyticsFunnelStage, AnalyticsManagerRow, CeoControlCenterSnapshot } from "@/types/analytics-os";
import { getAnalysisScenario } from "./catalog";
import {
  SCENARIO_SAMPLE_THRESHOLDS,
  type AnalysisScenarioDef,
  type ScenarioAction,
  type ScenarioFinding,
  type ScenarioReadiness,
  type ScenarioRun,
  type ScenarioStatus
} from "./types";

function metric(snapshot: CeoControlCenterSnapshot, id: string) {
  return snapshot.metrics[id];
}

function funnelStage(snapshot: CeoControlCenterSnapshot, id: string): AnalyticsFunnelStage | undefined {
  return snapshot.funnel.find((row) => row.id === id);
}

function rate(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num == null || den == null || den <= 0) return null;
  return num / den;
}

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return eur(value);
}

function guidedRun(def: AnalysisScenarioDef, readiness: ScenarioReadiness = def.readiness): ScenarioRun {
  const findings: ScenarioFinding[] = def.steps.map((step) => ({
    label: step.title,
    value: step.check,
    note: step.href
  }));
  const actions: ScenarioAction[] = def.steps
    .filter((step): step is typeof step & { href: string } => Boolean(step.href))
    .map((step) => ({
      title: step.title,
      why: step.check,
      href: step.href
    }));
  const blocked = readiness === "blocked";
  return {
    id: def.id,
    readiness,
    status: blocked ? "no_data" : "attention",
    confidence: "low",
    headline: blocked
      ? def.blockedReason ?? "Недостаточно данных для автоматического вывода."
      : "Маршрут по существующим экранам. Автодиагноз по сводке здесь не считается — нет нужных рядов.",
    diagnosis: blocked
      ? `${def.blockedReason ?? "Нет данных."} Не выдумываем CPM, креативы, JTBD или день-к-дню.`
      : `${def.reuse} Откройте шаги — числа смотреть на связанных дашбордах.`,
    findings,
    actions,
    sampleNote: def.blockedReason
  };
}

function factorFindings(report: FactorAnalysisReport): ScenarioFinding[] {
  return report.factors
    .filter((row) => row.euroEffect != null)
    .map((row) => ({
      label: row.title,
      value: row.euroEffect == null ? "—" : `${row.euroEffect > 0 ? "+" : ""}${eur(row.euroEffect)}`,
      note: row.whatHappened
    }));
}

function factorActions(report: FactorAnalysisReport, extra: ScenarioAction[] = []): ScenarioAction[] {
  const seen = new Set<string>();
  const actions: ScenarioAction[] = [];
  const push = (action: ScenarioAction) => {
    if (seen.has(action.href)) return;
    seen.add(action.href);
    actions.push(action);
  };
  const topHurt = [...report.factors].filter((row) => row.tone === "hurt" && row.euroEffect != null).sort(
    (a, b) => (a.euroEffect ?? 0) - (b.euroEffect ?? 0)
  )[0];
  if (topHurt) {
    push({ title: `Дальше: ${topHurt.title.toLowerCase()}`, why: topHurt.press, href: topHurt.href });
  }
  push({ title: "Факторный разбор", why: "Те же три рычага, без второй формулы.", href: "/os/factors" });
  push({ title: "План и прогноз", why: "Факт, план месяца и run-rate.", href: "/os/plan" });
  extra.forEach(push);
  return actions;
}

function revenueDiagnosis(report: FactorAnalysisReport): string {
  const moneyRows = report.factors.filter((row) => row.euroEffect != null);
  const hurts = moneyRows.filter((row) => (row.euroEffect ?? 0) < -50).sort((a, b) => (a.euroEffect ?? 0) - (b.euroEffect ?? 0));
  if (report.gapMtd == null) {
    return report.pressNow;
  }
  if (report.gapMtd >= 0) {
    return `${report.headline} Факт ${money(report.fact)} при темпе плана ${money(report.planMtd)}.`;
  }
  const parts = hurts.map((row) => `${eur(Math.abs(row.euroEffect ?? 0))} — ${row.title.toLowerCase()}`);
  const lead = `Факт ниже темпа плана на ${eur(Math.abs(report.gapMtd))}.`;
  if (!parts.length) return `${lead} ${report.pressNow}`;
  return `${lead} Основные причины: ${parts.join("; ")}. ${report.pressNow}`;
}

function revenuePlanRun(snapshot: CeoControlCenterSnapshot): ScenarioRun {
  const report = buildFactorAnalysisFromSnapshot(snapshot);
  const status: ScenarioStatus = !report.ready
    ? "no_data"
    : report.gapMtd == null
      ? "no_data"
      : report.gapMtd < -200
        ? "problem"
        : report.gapMtd > 200
          ? "opportunity"
          : "healthy";
  return {
    id: "revenue-plan",
    readiness: "live",
    status,
    confidence: report.ready ? "high" : "low",
    headline: report.headline,
    diagnosis: revenueDiagnosis(report),
    findings: [
      { label: "План MTD", value: money(report.planMtd) },
      { label: "Факт", value: money(report.fact) },
      { label: "Разрыв", value: money(report.gapMtd) },
      ...factorFindings(report)
    ],
    actions: factorActions(report),
    sampleNote: report.notes[0]
  };
}

function monthDecompRun(snapshot: CeoControlCenterSnapshot): ScenarioRun {
  const report = buildFactorAnalysisFromSnapshot(snapshot);
  const k = snapshot.metrics;
  const findings: ScenarioFinding[] = [
    { label: "План месяца", value: money(report.planMonth) },
    { label: "План MTD", value: money(report.planMtd) },
    { label: "Факт", value: money(report.fact) },
    { label: "Разрыв к темпу", value: money(report.gapMtd) },
    {
      label: "Лиды / CPL / расход",
      value: `${number(k.leads?.value ?? 0)} лидов · CPL ${money(snapshot.marketing.cpl.value)} · расход ${money(snapshot.marketing.adSpend.value)}`
    },
    {
      label: "CR и чек",
      value: `CR ${k.conversion_rate?.value == null ? "—" : pct(k.conversion_rate.value)} · AOV ${money(k.aov?.value)}`
    },
    ...factorFindings(report)
  ];
  return {
    id: "month-decomp",
    readiness: "live",
    status:
      report.gapMtd == null ? "no_data" : report.gapMtd < -200 ? "problem" : report.gapMtd > 200 ? "opportunity" : "healthy",
    confidence: report.ready ? "high" : "low",
    headline: `Итог на дату: ${report.headline}`,
    diagnosis: `${revenueDiagnosis(report)} Что масштабировать и что чинить — по знаку вклада рычага, не по ощущению.`,
    findings,
    actions: factorActions(report, [
      { title: "Срезы: продукты", why: "Кто тянет кассу.", href: "/os/slices?dim=product&metric=revenue" },
      { title: "Срезы: страны", why: "Где деньги.", href: "/os/slices?dim=country&metric=revenue" }
    ]),
    sampleNote: "Полный разбор каналов и креативов требует Ads API и чистый SOURCE_ID."
  };
}

function salesDropRun(snapshot: CeoControlCenterSnapshot): ScenarioRun {
  const leads = metric(snapshot, "leads");
  const sales = metric(snapshot, "paid_orders");
  const cr = metric(snapshot, "conversion_rate");
  const invoices = funnelStage(snapshot, "invoices")?.count ?? null;
  const paid = funnelStage(snapshot, "paid")?.count ?? sales?.value ?? null;
  const leadCount = leads?.value ?? funnelStage(snapshot, "leads")?.count ?? null;
  const leadToInvoice = rate(invoices, leadCount);
  const invoiceToPay = rate(paid, invoices);
  const leadsOk = (leadCount ?? 0) >= SCENARIO_SAMPLE_THRESHOLDS.minLeadsForVolumeCall;
  const pace = snapshot.plan.calendarDays > 0 ? snapshot.plan.daysElapsed / snapshot.plan.calendarDays : 1;
  const leadsVsPace = leads?.value != null && leads.plan != null ? leads.value / (leads.plan * pace) - 1 : null;
  const salesVsPace = sales?.value != null && sales.plan != null ? sales.value / (sales.plan * pace) - 1 : null;
  const crVsPlan = cr?.value != null && cr.plan != null ? cr.value - cr.plan : null;

  const volumeProblem = leadsVsPace != null && leadsVsPace < -0.08;
  const crProblem = crVsPlan != null && crVsPlan < -0.015;
  const invoiceWeak = leadToInvoice != null && leadToInvoice < 0.18;
  const payWeak = invoiceToPay != null && invoiceToPay < 0.7;

  let headline = `Продажи MTD ${number(sales?.value ?? 0)} при плане ${number(sales?.plan ?? 0)}. Нет ряда «вчера / 7 дней» в сводке — разбор относительно плана и воронки.`;
  const actions: ScenarioAction[] = [];
  if (volumeProblem && !crProblem) {
    headline = "Главный кандидат: объём лидов (привлечение), не обработка.";
    actions.push({ title: "Маркетинг", why: "Лиды ниже темпа плана.", href: "/os/marketing" });
  } else if ((crProblem || invoiceWeak) && !volumeProblem) {
    headline = "Главный кандидат: качество лида или обработка, не объём.";
    actions.push({ title: "Воронка", why: "Отвал до счёта или слабый CR.", href: "/os/funnel" });
    actions.push({ title: "Менеджеры", why: "Сравнить обработку.", href: "/os/managers" });
  } else if (payWeak) {
    headline = "Узкое место ближе к оплате счёта, чем к привлечению.";
    actions.push({ title: "Воронка", why: "Счёт → оплата.", href: "/os/funnel" });
  } else {
    actions.push({ title: "Факторы выручки", why: "Одного стопа нет — смотреть разрыв.", href: "/os/factors" });
  }

  const status: ScenarioStatus = !leadsOk
    ? "no_data"
    : volumeProblem || crProblem || invoiceWeak || payWeak
      ? "attention"
      : "healthy";

  return {
    id: "sales-drop",
    readiness: "live",
    status,
    confidence: leadsOk ? "medium" : "low",
    headline,
    diagnosis: [
      leadsVsPace != null
        ? `Лиды к темпу плана: ${pct(1 + leadsVsPace)}.`
        : "Нет плана лидов.",
      salesVsPace != null ? `Оплаты к темпу плана: ${pct(1 + salesVsPace)}.` : "",
      leadToInvoice != null ? `Лид → счёт: ${pct(leadToInvoice)}.` : "",
      invoiceToPay != null ? `Счёт → оплата: ${pct(invoiceToPay)}.` : "",
      cr?.value != null ? `CR: ${pct(cr.value)}${cr.plan != null ? ` при плане ${pct(cr.plan)}` : ""}.` : ""
    ]
      .filter(Boolean)
      .join(" "),
    findings: [
      { label: "Лиды", value: `${number(leadCount ?? 0)} / план ${number(leads?.plan ?? 0)}` },
      { label: "Оплаты", value: `${number(sales?.value ?? 0)} / план ${number(sales?.plan ?? 0)}` },
      { label: "Лид → счёт", value: leadToInvoice == null ? "—" : pct(leadToInvoice) },
      { label: "Счёт → оплата", value: invoiceToPay == null ? "—" : pct(invoiceToPay) },
      { label: "CR", value: cr?.value == null ? "—" : pct(cr.value) }
    ],
    actions,
    sampleNote: leadsOk
      ? "Нет day-over-day и WoW в ceo-snapshot: триггер «↓ к прошлым 7 дням» не считается."
      : "Мало лидов MTD — не делать жёсткий вывод."
  };
}

function cacUpRun(snapshot: CeoControlCenterSnapshot): ScenarioRun {
  const cac = snapshot.marketing.cac.value ?? metric(snapshot, "cac")?.value ?? null;
  const cacPlan = snapshot.marketing.cac.plan ?? metric(snapshot, "cac")?.plan ?? null;
  const cpl = snapshot.marketing.cpl.value ?? metric(snapshot, "cpl")?.value ?? null;
  const cplPlan = snapshot.marketing.cpl.plan ?? metric(snapshot, "cpl")?.plan ?? null;
  const cr = metric(snapshot, "conversion_rate");
  const spend = snapshot.marketing.adSpend;
  const sales = metric(snapshot, "paid_orders")?.value ?? 0;
  const sampleOk = sales >= SCENARIO_SAMPLE_THRESHOLDS.minSalesForConfidentRate;
  const cacWorse = cac != null && cacPlan != null && cacPlan > 0 && cac > cacPlan * 1.05;
  const cplShare = cpl != null && cplPlan != null && cplPlan > 0 ? cpl / cplPlan - 1 : null;
  const crShare = cr?.value != null && cr.plan != null && cr.value > 0 ? cr.plan / cr.value - 1 : null;

  const headline = cacWorse
    ? `CAC ${money(cac)} выше плана ${money(cacPlan)}.`
    : `CAC ${money(cac)}${cacPlan != null ? ` при плане ${money(cacPlan)}` : ""}. Значимого превышения плана нет.`;

  const bits: string[] = [];
  if (cplShare != null) bits.push(`${cplShare >= 0 ? "+" : ""}${(cplShare * 100).toFixed(0)}% к плану даёт CPL`);
  if (crShare != null) bits.push(`${crShare >= 0 ? "+" : ""}${(crShare * 100).toFixed(0)}% к стоимости продажи даёт 1/CR`);
  const diagnosis = cacWorse
    ? `${headline} Из доступных рычагов: ${bits.join("; ") || "не хватает плана CPL/CR"}. CAC ≈ CPL / CR. Нет moving average и Ads API — не раскладываем CPM/креатив.`
    : `${headline} Смотреть уровень, не историю.`;

  const magnitude = cac != null && cacPlan != null && cacPlan > 0 ? cac / cacPlan - 1 : 0;
  const status: ScenarioStatus = !sampleOk
    ? "no_data"
    : !cacWorse
      ? magnitude < -0.05
        ? "opportunity"
        : "healthy"
      : magnitude >= 0.15
        ? "problem"
        : "attention";

  return {
    id: "cac-up",
    readiness: "live",
    status,
    confidence: sampleOk ? "medium" : "low",
    headline,
    diagnosis,
    findings: [
      { label: "Расход", value: `${money(spend.value)} / план ${money(spend.plan)}` },
      { label: "CPL", value: `${money(cpl)} / план ${money(cplPlan)}` },
      { label: "CR", value: cr?.value == null ? "—" : `${pct(cr.value)} / план ${cr.plan == null ? "—" : pct(cr.plan)}` },
      { label: "CAC", value: `${money(cac)} / план ${money(cacPlan)}` }
    ],
    actions: [
      { title: "Маркетинг / CPL", why: "Дороже лид или больше расход.", href: "/os/marketing" },
      { title: "Воронка / CR", why: "Падение CR тянет CAC вверх.", href: "/os/funnel" },
      { title: "Лендинги", why: "Подрядные книги, не касса компании.", href: "/marketing" }
    ],
    sampleNote: sampleOk
      ? `Продаж MTD: ${number(sales)}. Нет истории CAC — только уровень vs план.`
      : "Мало продаж — CAC шумный, не маркировать канал победителем."
  };
}

function comparableManagers(rows: AnalyticsManagerRow[]): AnalyticsManagerRow[] {
  return rows.filter((row) => row.leads >= SCENARIO_SAMPLE_THRESHOLDS.minLeadsForManagerCompare);
}

function leadsNoSalesRun(snapshot: CeoControlCenterSnapshot): ScenarioRun {
  const leads = metric(snapshot, "leads");
  const sales = metric(snapshot, "paid_orders");
  const cr = metric(snapshot, "conversion_rate");
  const invoices = funnelStage(snapshot, "invoices")?.count ?? null;
  const paid = funnelStage(snapshot, "paid")?.count ?? sales?.value ?? null;
  const leadCount = leads?.value ?? null;
  const leadToInvoice = rate(invoices, leadCount);
  const invoiceToPay = rate(paid, invoices);
  const pace = snapshot.plan.calendarDays > 0 ? snapshot.plan.daysElapsed / snapshot.plan.calendarDays : 1;
  const leadsOnPace = leads?.value != null && leads.plan != null ? leads.value >= leads.plan * pace * 0.95 : false;
  const crDown = cr?.value != null && cr.plan != null && cr.value + 0.01 < cr.plan;
  const managers = comparableManagers(snapshot.managers);
  const crs = managers.map((row) => row.conversionRate).filter((value): value is number => value != null);
  const spread = crs.length >= 2 ? Math.max(...crs) - Math.min(...crs) : 0;

  const findings: ScenarioFinding[] = [
    { label: "Лиды vs темп", value: `${number(leadCount ?? 0)} / план ${number(leads?.plan ?? 0)}` },
    { label: "Оплаты", value: `${number(sales?.value ?? 0)} / план ${number(sales?.plan ?? 0)}` },
    { label: "Лид → счёт", value: leadToInvoice == null ? "—" : pct(leadToInvoice) },
    { label: "Счёт → оплата", value: invoiceToPay == null ? "—" : pct(invoiceToPay) }
  ];
  if (managers.length >= 2) {
    findings.push({
      label: "Разброс CR менеджеров",
      value: pct(spread),
      note: `Считаем только менеджеров с ≥${SCENARIO_SAMPLE_THRESHOLDS.minLeadsForManagerCompare} лидами.`
    });
  } else {
    findings.push({
      label: "Менеджеры",
      value: "недостаточно выборки",
      note: `Нужно ≥2 менеджера с ≥${SCENARIO_SAMPLE_THRESHOLDS.minLeadsForManagerCompare} лидами.`
    });
  }

  const headline = leadsOnPace && crDown
    ? "Лиды около темпа плана, CR ниже — классический «лиды есть, продаж нет»."
    : `Лиды ${number(leadCount ?? 0)} / план ${number(leads?.plan ?? 0)}, продажи ${number(sales?.value ?? 0)} / план ${number(sales?.plan ?? 0)}.`;

  return {
    id: "leads-no-sales",
    readiness: "live",
    status: leadsOnPace && crDown ? "problem" : "attention",
    confidence: (leadCount ?? 0) >= SCENARIO_SAMPLE_THRESHOLDS.minLeadsForVolumeCall ? "medium" : "low",
    headline,
    diagnosis: [
      leadToInvoice != null && leadToInvoice < 0.2
        ? "Большая потеря до счёта — квалификация или скорость ответа."
        : "Доля счетов не выглядит провальной.",
      invoiceToPay != null && invoiceToPay < 0.7 ? "Ломается на оплате." : "Оплата счетов держится.",
      spread >= 0.08
        ? `Разброс CR ${pct(spread)} при сопоставимой выборке повышает вероятность проблемы обработки. Source×Manager в сводке нет — это не доказательство «плохого трафика».`
        : "Разброса CR менеджеров недостаточно, чтобы винить только продажи."
    ].join(" "),
    findings,
    actions: [
      { title: "Воронка", why: "Где отвал: счёт или оплата.", href: "/os/funnel" },
      { title: "Срезы: менеджеры", why: "CR по команде на тех же фактах.", href: "/os/slices?dim=manager&metric=cr" },
      { title: "Срезы: источники", why: "Сравнить с обработкой.", href: "/os/slices?dim=source&metric=cr" },
      { title: "Цикл сделки", why: "Лаг до оплаты.", href: "/os/sales-cycle" },
      { title: "Маркетинг или продажи?", why: "Отдельный спорный сценарий.", href: "/os/scenarios?scenario=marketing-vs-sales" }
    ],
    sampleNote: `Порог сравнения менеджеров: ${SCENARIO_SAMPLE_THRESHOLDS.minLeadsForManagerCompare} лидов.`
  };
}

function marketingVsSalesRun(snapshot: CeoControlCenterSnapshot): ScenarioRun {
  const managers = comparableManagers(snapshot.managers);
  const rows = managers
    .map((row) => ({ name: row.managerName, cr: row.conversionRate, leads: row.leads, sales: row.paidOrders }))
    .filter((row) => row.cr != null) as Array<{ name: string; cr: number; leads: number; sales: number }>;

  if (rows.length < 2) {
    return {
      id: "marketing-vs-sales",
      readiness: "live",
      status: "no_data",
      confidence: "low",
      headline: `Недостаточно данных: меньше двух менеджеров с ≥${SCENARIO_SAMPLE_THRESHOLDS.minLeadsForManagerCompare} лидами. Жёсткий вывод «трафик vs обработка» запрещён.`,
      diagnosis: "Нельзя разрешить спор маркетинга и продаж на тонкой выборке. Source×Manager в CEO-снимке нет.",
      findings: [{ label: "Менеджеров в сравнении", value: String(rows.length) }],
      actions: [{ title: "Менеджеры", why: "Дождаться объёма.", href: "/os/managers" }],
      sampleNote: "Нет матрицы Source×Manager — нельзя доказать, что все менеджеры плохо конвертят один источник."
    };
  }

  const max = rows.reduce((a, b) => (a.cr >= b.cr ? a : b));
  const min = rows.reduce((a, b) => (a.cr <= b.cr ? a : b));
  const spread = max.cr - min.cr;
  const wide = spread >= 0.1;

  return {
    id: "marketing-vs-sales",
    readiness: "live",
    status: wide ? "attention" : "healthy",
    confidence: "medium",
    headline: wide
      ? `Разброс CR менеджеров ${pct(spread)} — спор «обработка vs трафик» открыт, без жёсткого вердикта.`
      : `Разброс CR менеджеров ${pct(spread)} — нет основания винить только продажи.`,
    diagnosis: `${max.name}: CR ${pct(max.cr)} (${number(max.leads)} лидов, ${number(max.sales)} продаж). ${min.name}: CR ${pct(min.cr)} (${number(min.leads)} лидов, ${number(min.sales)} продаж). ${
      wide
        ? "Большой разброс при сопоставимой выборке повышает вероятность проблемы обработки. Это не доказательство без Source×Manager."
        : "Разброс небольшой — скорее общий фактор (трафик / оффер / месяц)."
    }`,
    findings: rows.map((row) => ({
      label: row.name,
      value: `${pct(row.cr)} · ${number(row.leads)} лидов · ${number(row.sales)} продаж`
    })),
    actions: [
      { title: "Срезы: источник", why: "Сначала источник, потом менеджер.", href: "/os/slices?dim=source&metric=cr" },
      { title: "Срезы: менеджеры", why: "Same month / different managers.", href: "/os/slices?dim=manager&metric=cr" },
      { title: "Воронка", why: "Лид → счёт vs счёт → оплата.", href: "/os/funnel" },
      { title: "Источники", why: "Качество данных SOURCE_ID.", href: "/os/sources" }
    ],
    sampleNote: `Минимум ${SCENARIO_SAMPLE_THRESHOLDS.minLeadsForManagerCompare} лидов на менеджера. Нет Source×Manager в этом снимке.`
  };
}

function catchPlanRun(snapshot: CeoControlCenterSnapshot): ScenarioRun {
  const planRev = snapshot.plan.planRevenue.value;
  const factRev = snapshot.plan.factRevenue.value ?? metric(snapshot, "revenue")?.value ?? null;
  const forecast = snapshot.plan.forecastRevenue.value;
  const daysLeft = Math.max(0, snapshot.plan.daysRemaining);
  const daysElapsed = Math.max(1, snapshot.plan.daysElapsed);
  const sales = metric(snapshot, "paid_orders");
  const leads = metric(snapshot, "leads");
  const spend = snapshot.marketing.adSpend;
  const revenueLeft = planRev != null && factRev != null ? Math.max(0, planRev - factRev) : null;
  const salesLeft = sales?.plan != null && sales.value != null ? Math.max(0, sales.plan - sales.value) : null;
  const leadsLeft = leads?.plan != null && leads.value != null ? Math.max(0, leads.plan - leads.value) : null;
  const reqRev = revenueLeft != null && daysLeft > 0 ? revenueLeft / daysLeft : null;
  const reqSales = salesLeft != null && daysLeft > 0 ? salesLeft / daysLeft : null;
  const reqLeads = leadsLeft != null && daysLeft > 0 ? leadsLeft / daysLeft : null;
  const currentPace = factRev != null ? factRev / daysElapsed : null;
  const reqCr = reqLeads != null && reqLeads > 0 && reqSales != null ? reqSales / reqLeads : null;
  const spendLeft = spend.plan != null && spend.value != null ? Math.max(0, spend.plan - spend.value) : null;
  const maxCpl = spendLeft != null && reqLeads != null && reqLeads > 0 ? spendLeft / reqLeads : null;
  const behind = forecast != null && planRev != null && forecast + 1 < planRev;

  return {
    id: "catch-plan",
    readiness: "live",
    status: daysLeft === 0 ? "attention" : behind ? "attention" : "opportunity",
    confidence: planRev != null && factRev != null ? "high" : "low",
    headline: behind
      ? `Прогноз ${money(forecast)} < план ${money(planRev)}. Чтобы догнать: ${money(reqRev)} / день.`
      : `Прогноз ${money(forecast)} ${planRev != null ? `при плане ${money(planRev)}` : ""}.`,
    diagnosis: [
      revenueLeft != null ? `Осталось ${money(revenueLeft)} выручки за ${number(daysLeft)} дн.` : "Нет плана или факта.",
      currentPace != null ? `Текущий темп ${money(currentPace)} / день.` : "",
      reqRev != null && currentPace != null && reqRev > currentPace * 1.15
        ? "Нужно ускорение относительно текущего темпа."
        : "Это арифметика (план − факт) / дни, не вторая predictive-модель.",
      "Прогноз месяца — существующий run-rate на /os/plan и /predictive."
    ]
      .filter(Boolean)
      .join(" "),
    findings: [
      { label: "Required revenue / day", value: money(reqRev) },
      { label: "Required sales / day", value: reqSales == null ? "—" : reqSales.toFixed(1) },
      { label: "Required leads / day", value: reqLeads == null ? "—" : reqLeads.toFixed(1) },
      { label: "Required CR", value: reqCr == null ? "—" : pct(reqCr) },
      { label: "Max CPL от остатка бюджета", value: money(maxCpl) },
      { label: "Дней осталось", value: number(daysLeft) }
    ],
    actions: [
      { title: "План / прогноз", why: "Существующий run-rate.", href: "/os/plan" },
      { title: "Predictive", why: "Не создаём вторую модель.", href: "/predictive" },
      { title: "Факторы", why: "Какой рычаг закрывает разрыв.", href: "/os/factors" }
    ],
    sampleNote: "Required pace = (план месяца − факт) / дни до конца."
  };
}

const LIVE_RUNNERS: Record<string, (snapshot: CeoControlCenterSnapshot) => ScenarioRun> = {
  "revenue-plan": revenuePlanRun,
  "sales-drop": salesDropRun,
  "cac-up": cacUpRun,
  "leads-no-sales": leadsNoSalesRun,
  "marketing-vs-sales": marketingVsSalesRun,
  "catch-plan": catchPlanRun,
  "month-decomp": monthDecompRun
};

export function runAnalysisScenario(
  id: string,
  snapshot: CeoControlCenterSnapshot | null
): { def: AnalysisScenarioDef; run: ScenarioRun } | null {
  const def = getAnalysisScenario(id);
  if (!def) return null;
  if (!snapshot || def.readiness !== "live") {
    return { def, run: guidedRun(def, !snapshot && def.readiness === "live" ? "guided" : def.readiness) };
  }
  const runner = LIVE_RUNNERS[def.id];
  return { def, run: runner ? runner(snapshot) : guidedRun(def) };
}
