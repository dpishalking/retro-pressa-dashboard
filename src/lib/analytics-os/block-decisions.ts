import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { eur, number, pct } from "@/lib/format";

/** Simple one-line management takeaways per Analytics OS block. Null = empty slot. */
export type BlockDecision = string | null;

function gapOrders(plan: number | null | undefined, fact: number | null | undefined, aov: number | null | undefined) {
  if (plan == null || fact == null || aov == null || aov <= 0) return null;
  const gap = plan - fact;
  if (gap <= 0) return 0;
  return Math.ceil(gap / aov);
}

export function decisionPlanFact(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const plan = snapshot.plan.planRevenue.value;
  const fact = snapshot.plan.factRevenue.value;
  const forecast = snapshot.plan.forecastRevenue.value;
  const aov = snapshot.metrics.aov?.value ?? null;
  const daysRemaining = snapshot.plan.daysRemaining;
  if (plan == null || fact == null) return null;
  const needed = gapOrders(plan, fact, aov);
  if (forecast != null && forecast < plan) {
    const short = Math.round(plan - forecast);
    return needed != null && needed > 0
      ? `Темп до конца месяца: не хватает ≈ ${eur(short)} до плана (${daysRemaining} дн.). Нужно ещё ≈ ${number(needed)} оплат при текущем чеке.`
      : `Темп до конца месяца ниже плана примерно на ${eur(short)}. Смотрите воронку и рекламу.`;
  }
  if (fact >= plan || (forecast != null && forecast >= plan)) {
    return "При текущем темпе план месяца достижим или уже закрыт. Держите чек и не раздувайте скидки.";
  }
  return needed != null && needed > 0
    ? `До плана ≈ ${eur(plan - fact)}. При текущем чеке это ≈ ${number(needed)} оплат за ${daysRemaining} дн. — дожимайте пайплайн.`
    : `Факт ниже плана. Сверьте темп оплат и лиды до конца месяца.`;
}

export function decisionPlanIndicators(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const n = snapshot.plan.indicators?.length ?? 0;
  if (!n) return "План месяца не подтянут из таблицы — без него нельзя сказать, куда давить.";
  return `В плане ${number(n)} показателей. Сверяйте факт по блокам: где отстаёте — туда и внимание РОПа на неделю.`;
}

export function decisionRevenueTree(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const countries = snapshot.revenueTree.countries;
  const products = snapshot.revenueTree.products;
  const managers = snapshot.revenueTree.managers;
  if (!countries.length && !products.length && !managers.length) return null;
  const topC = countries[0];
  const topP = products[0];
  const topM = managers[0];
  const parts: string[] = [];
  if (topC) parts.push(`деньги в ${topC.name} (${pct(topC.share)})`);
  if (topP) parts.push(`продукт №1 — ${topP.name}`);
  if (topM) parts.push(`менеджер №1 — ${topM.name}`);
  return `Касса сидит здесь: ${parts.join("; ")}. Кликом фильтруйте слабые сегменты и смотрите, что чинить.`;
}

export function decisionFunnel(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const stages = snapshot.funnel;
  if (!stages.length) return null;
  let worst: { label: string; drop: number } | null = null;
  for (const stage of stages) {
    if (stage.dropOffFromPrevious == null || stage.dropOffFromPrevious <= 0) continue;
    if (!worst || stage.dropOffFromPrevious > worst.drop) {
      worst = { label: stage.label, drop: stage.dropOffFromPrevious };
    }
  }
  const cr = snapshot.metrics.unique_conversion_rate?.value;
  if (worst) {
    return `Самый большой отсев перед этапом «${worst.label}»: ${number(worst.drop)}. Сюда копать скрипт и скорость ответа.${
      cr != null ? ` Конверсия уникальных: ${pct(cr)}.` : ""
    }`;
  }
  return cr != null ? `Конверсия уникальных: ${pct(cr)}. Смотрите, на каком шаге воронки люди отваливаются.` : null;
}

export function decisionManagers(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const rows = snapshot.managers.filter((row) => row.leads >= 10);
  if (!rows.length) return "Мало лидов на менеджера — выводы по людям пока рано делать.";
  const top = [...rows].sort((a, b) => (b.revenuePerLead ?? 0) - (a.revenuePerLead ?? 0))[0];
  const weak = [...rows].sort((a, b) => (a.revenuePerLead ?? 0) - (b.revenuePerLead ?? 0))[0];
  if (!top || !weak || top.managerId === weak.managerId) {
    return "Смотрите €/лид и конверсию: у кого ниже медианы — разбор диалогов и наставничество.";
  }
  return `${top.managerName} лучше по €/лид; ${weak.managerName} отстаёт. Перенесите приёмы топа на отстающих (скрипт, скорость, дожим).`;
}

export function decisionProducts(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const rows = snapshot.products.filter(
    (row) => !/^(без продукта|не заполнен в crm|crm_missing_product|no_product|unknown)$/i.test(row.productName.trim())
  );
  const missing = snapshot.crmMissingProducts;
  if (!rows.length) {
    return missing?.orders
      ? `Товары в CRM не заполнены у ${number(missing.orders)} оплат (${eur(missing.revenue)}). Без этого нельзя управлять ассортиментом.`
      : null;
  }
  const top = rows[0];
  const thin = [...rows]
    .filter((row) => row.marginRate != null && row.orders >= 3)
    .sort((a, b) => (a.marginRate ?? 1) - (b.marginRate ?? 1))[0];
  const parts = [`№1 по выручке — ${top.productName} (${eur(top.revenue)})`];
  if (thin && thin.marginRate != null) {
    parts.push(`ниже маржа у «${thin.productName}» (${pct(thin.marginRate)}) — проверьте цену и COGS`);
  }
  if (missing?.orders) {
    parts.push(`${number(missing.orders)} оплат без товара в карточке — закрыть дыру в CRM`);
  }
  return `${parts.join(". ")}.`;
}

export function decisionPricing(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const rows = snapshot.pricingCompare || [];
  if (!rows.length) return null;
  const skewed = rows.find(
    (row) => row.listPrice != null && row.soldAvg != null && row.soldMedian != null && row.soldAvg > row.listPrice * 1.25
  );
  if (skewed && skewed.listPrice != null && skewed.soldMedian != null) {
    return `У «${skewed.productName}» средняя выше витрины из‑за дорогих вариантов; типичная цена ≈ ${eur(skewed.soldMedian)} при витрине ${eur(skewed.listPrice)}. Смотрите медиану, не среднее.`;
  }
  return "Сравнивайте медиану продажи с витриной: если медиана сильно ниже — менеджеры демпингуют; если выше — в прайсе не отражены премиум-опции.";
}

export function decisionCountries(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const rows = snapshot.countries;
  if (!rows.length) return null;
  const top = rows[0];
  const weak = [...rows]
    .filter((row) => (row.leads ?? 0) >= 20 && row.leadConversionRate != null)
    .sort((a, b) => (a.leadConversionRate ?? 1) - (b.leadConversionRate ?? 1))[0];
  if (weak && weak.country !== top.country) {
    return `${top.country} даёт больше кассы. В ${weak.country} конверсия ниже (${pct(weak.leadConversionRate!)}) — проверьте оффер, язык и доставку.`;
  }
  return `Основная касса — ${top.country}. Не размывайте бюджет по слабым странам без роста конверсии.`;
}

export function decisionCustomers(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const repeat = snapshot.customers.repeatRate.value;
  const customers = snapshot.customers.customers.value;
  if (customers == null) return null;
  if (repeat == null) return `Покупателей за период: ${number(customers)}. Долю повторных пока не считаем стабильно.`;
  if (repeat < 0.1) {
    return `Повторных мало (${pct(repeat)}). После оплаты — допродажа и напоминание; база почти не возвращается сама.`;
  }
  return `Повторных ${pct(repeat)} из ${number(customers)} покупателей. Держите базу тёплой: повтор дешевле нового лида.`;
}

export function decisionUnitEconomics(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const ue = snapshot.unitEconomics;
  const avg = ue.units?.find((unit) => unit.kind === "average") || ue.units?.[0];
  const cac = ue.cac;
  const aov = snapshot.metrics.aov?.value ?? avg?.aov ?? null;
  const after = avg?.profitAfterSaleCost ?? null;
  if (after == null && cac == null) return null;
  if (after != null && after < 0) {
    return `После стоимости продажи вклад отрицательный (${eur(after)}). Либо режьте CPL, либо поднимайте чек/конверсию — иначе рост убивает маржу.`;
  }
  if (cac != null && aov != null && cac > aov * 0.4) {
    return `CAC ${eur(cac)} высок относительно чека ${eur(aov)}. Не масштабируйте рекламу, пока не вырастет конверсия или AOV.`;
  }
  return after != null
    ? `После стоимости продажи остаётся ≈ ${eur(after)}. Можно осторожно масштабировать каналы с лучшим CAC.`
    : `CAC ${eur(cac!)}. Сверяйте с чеком: покупка должна окупать привлечение.`;
}

export function decisionPipeline(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const amount = snapshot.pipeline.pipelineAmount.value;
  const stuck = snapshot.pipeline.age?.stuckOver7d;
  if (amount == null) return null;
  if (stuck && stuck.deals > 0) {
    return `В пайплайне ${eur(amount)}, из них ${number(stuck.deals)} сделок старше 7 дней без движения (${eur(stuck.amount)}). Разберите «зависшие» завтра на планёрке.`;
  }
  return `Открыто ${eur(amount)}. Это запас кассы — двигайте ближайшие стадии к счёту и оплате.`;
}

export function decisionOpportunities(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const rows = snapshot.opportunities || [];
  if (!rows.length) return "Крупных разрывов по сегментам нет (или мало лидов). Держите медиану команды как норму.";
  const top = rows[0];
  return `${top.title}: ${top.body}${top.euroImpact != null ? ` Потенциал ≈ ${eur(top.euroImpact)}.` : ""}`;
}

export function decisionMarketing(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const spend = snapshot.marketing.adSpend.value;
  const cpl = snapshot.marketing.cpl.value;
  const cac = snapshot.marketing.cac.value;
  if (spend == null) return "Нет spend в снимке — нельзя решить, масштабировать рекламу или нет.";
  if (cpl != null && cac != null) {
    return `Потратили ${eur(spend)}. CPL ${eur(cpl)}, CAC ${eur(cac)}. Если CAC растёт быстрее чека — урежьте слабые кампании.`;
  }
  return `Реклама ${eur(spend)}. Сверяйте CPL/CAC с конверсией и чеком, прежде чем крутить бюджет.`;
}

export function decisionProduction(_snapshot: CeoControlCenterSnapshot): BlockDecision {
  return "Производство ещё не подключено. Не принимайте решения о мощности и сроках только по кассе — здесь будет узкое место при росте.";
}

export function decisionReconciliation(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const r = snapshot.reconciliation;
  const bitrix = r.bitrixRevenue.value;
  const maria = r.mariaRevenue.value;
  if (bitrix == null) return null;
  if (maria == null) {
    return `Опора на Bitrix (${eur(bitrix)}). Maria/СВОД не сверяются — не смешивайте цифры в одном отчёте.`;
  }
  const delta = Math.abs(bitrix - maria);
  if (delta > Math.max(50, bitrix * 0.05)) {
    return `Bitrix ${eur(bitrix)} и Maria ${eur(maria)} расходятся на ≈ ${eur(delta)}. Сначала сверка, потом решения по плану.`;
  }
  return `Bitrix и Maria близки. Можно опираться на Bitrix как на основную кассу.`;
}

export function decisionDataQuality(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const score = snapshot.dataQuality?.overallScore;
  if (score == null) return null;
  if (score < 70) {
    return `Качество данных ${number(score)}/100 — низкое. Не принимайте жёстких решений по слабым метрикам, пока не закроете дыры в источниках.`;
  }
  if (score < 85) {
    return `Качество ${number(score)}/100. Цифрам можно верить осторожно: сначала смотрите контуры с высоким score.`;
  }
  return `Качество ${number(score)}/100. Можно опираться на цифры блока.`;
}

export function decisionDataFoundation(snapshot: CeoControlCenterSnapshot): BlockDecision {
  const connected =
    snapshot.sources?.filter((s) => s.connection === "connected" || s.connection === "partial").length ?? 0;
  const total = snapshot.sources?.length ?? 0;
  if (!total) return null;
  return `Подключено/частично: ${number(connected)} из ${number(total)} источников. Решения только по живым контурам; «Нет» — не масштабировать.`;
}

export function decisionKpis(snapshot: CeoControlCenterSnapshot): BlockDecision {
  return decisionPlanFact(snapshot);
}
