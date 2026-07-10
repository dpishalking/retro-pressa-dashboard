"use client";

import Link from "next/link";
import { Activity, AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Brain, CheckCircle2, Download, RefreshCcw, Settings2, SlidersHorizontal, Target, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { conversationIntelligenceDemo, dailyMetrics, managerMetrics, marketMetrics, monthlyMetrics, qualityMetrics, targetScenario } from "@/data/demo-data";
import { averageInvoice, averagePaidCheck, cashRoas, dailyPlan, delta, deltaPp, invoiceConversion, invoiceRoas, paidCpl, revenuePerLead, revenuePlanCompletion, salesConversion, scenarioForecast, totalLeads } from "@/lib/metrics-engine";
import { buildSignals } from "@/lib/signal-rules";
import { eur, number, pct, pp } from "@/lib/format";
import type { ConversationDashboardMetrics, ConversationImportFileDiagnostic, CountryInvoiceMetrics, DailyMetrics, GeminiConversationSummary, ManagerInvoiceMetrics, ManagerMetrics, MarketMetrics, MonthlyMetrics, ProductInvoiceMetrics, Status } from "@/types/metrics";
import { HUB_PATH } from "@/lib/auth/routes";
import { FinancialReportLiveSummary } from "@/components/financial-report/live-summary";

const tabs = ["Обзор", "Growth Intelligence", "План месяца", "План €100 000", "Воронка", "Маркетинг", "Продажи", "Качество переписок", "Рынки", "Менеджеры", "Данные и настройки"];
type SourceFilter = "all" | "paid" | "organic";
type ManagerOption = { value: string; label: string };
type DashboardMode = "analytics" | "rop";

const defaultCountryOptions = [
  "Латвия",
  "Беларусь",
  "Казахстан",
  "Эстония",
  "Германия",
  "Литва",
  "Россия",
  "Молдова",
  "Грузия",
  "Англия",
  "Израиль",
  "Испания",
  "Армения",
  "Финляндия",
  "Австрия",
  "Азербайджан",
  "Польша",
  "США",
  "Украина",
  "Швейцария",
  "Ирландия",
  "Италия",
  "Словакия",
  "Турция",
  "Франция",
  "Чехия",
  "Швеция",
  "Бельгия",
  "Болгария",
  "другие",
  "Исландия",
  "Люксембург",
  "Нидерланды",
  "Норвегия",
  "Остров Гернси",
  "Португалия",
  "Румыния",
  "Сербия",
  "Словения",
  "Туркменистан",
  "Хорватия",
  "Черногория"
];

type MonthlyPlan = {
  name: string;
  targetRevenue: number;
  totalLeads: number;
  paidLeads: number;
  organicLeads: number;
  qualifiedLeads: number;
  invoicesCount: number;
  salesCount: number;
  invoiceConversion: number;
  salesConversion: number;
  averagePaidCheck: number;
  adSpend: number;
  targetAdsBudget: number;
  seedingBudget: number;
  bloggersBudget: number;
  ugcBudget: number;
  calendarDays: number;
};

const defaultMonthlyPlan: MonthlyPlan = {
  name: "План июля",
  targetRevenue: 46667,
  totalLeads: 3333,
  paidLeads: 2667,
  organicLeads: 667,
  qualifiedLeads: 2333,
  invoicesCount: 733,
  salesCount: 667,
  invoiceConversion: 733 / 3333,
  salesConversion: 667 / 3333,
  averagePaidCheck: 70,
  adSpend: 4000,
  targetAdsBudget: 4000,
  seedingBudget: 300,
  bloggersBudget: 300,
  ugcBudget: 200,
  calendarDays: 31
};

function deriveMonthlyPlan(plan: MonthlyPlan) {
  const total = plan.totalLeads;
  const sales = plan.salesCount || Math.round(total * plan.salesConversion);
  const invoices = plan.invoicesCount || Math.round(total * plan.invoiceConversion);
  const invoicesAmount = invoices * plan.averagePaidCheck;
  const economyRevenue = sales * plan.averagePaidCheck;

  return {
    totalLeads: total,
    sales,
    invoices,
    invoicesAmount,
    economyRevenue,
    cpl: plan.adSpend / Math.max(1, plan.paidLeads),
    cashRoas: plan.targetRevenue / Math.max(1, plan.adSpend),
    dailyRevenue: plan.targetRevenue / plan.calendarDays,
    dailyLeads: total / plan.calendarDays,
    dailyPaidLeads: plan.paidLeads / plan.calendarDays,
    dailyOrganicLeads: plan.organicLeads / plan.calendarDays,
    dailySales: sales / plan.calendarDays,
    dailyInvoices: invoices / plan.calendarDays,
    dailyInvoicesAmount: invoicesAmount / plan.calendarDays,
    northStarProgress: plan.targetRevenue / targetScenario.targetRevenue
  };
}

const statusLabel: Record<Status, string> = {
  green: "Норма",
  orange: "Риск",
  red: "Критично"
};

const countryPalette = ["#2563eb", "#0f766e", "#d97706", "#dc2626", "#0891b2", "#7c3aed", "#ea580c", "#475569"];

const sampleReliabilityLabel: Record<ConversationDashboardMetrics["sampleReliability"], string> = {
  demo: "Демо",
  small: "Малая выборка",
  directional: "Направление",
  reliable: "Достаточная выборка"
};

function conversationSampleNote(dashboard: ConversationDashboardMetrics) {
  if (dashboard.sampleReliability === "reliable") {
    return `Выборка достаточная: ${number(dashboard.totalDialogs)} диалогов. Можно использовать в прогнозе и управленческих решениях.`;
  }

  return `Сейчас загружено ${number(dashboard.totalDialogs)} диалогов. Это разбор примеров и поиск симптомов, а не статистика месяца. Для управленческой аналитики нужно минимум ${number(dashboard.minimumReliableDialogs)} диалогов.`;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold status-${status}`}>{statusLabel[status]}</span>;
}

function MetricCard({ title, value, hint, formula, deltaValue }: { title: string; value: string; hint: string; formula: string; deltaValue?: number }) {
  return (
    <article className="card grid min-h-36 gap-3 p-4" title={formula}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-slate-500">{title}</span>
        {typeof deltaValue === "number" ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${deltaValue >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {deltaValue >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {pct(Math.abs(deltaValue))}
          </span>
        ) : null}
      </div>
      <strong className="text-3xl leading-none tracking-normal text-slate-950">{value}</strong>
      <small className="text-sm leading-5 text-slate-500">{hint}</small>
    </article>
  );
}

function planStatus(completion: number): Status {
  if (!Number.isFinite(completion)) return "red";
  if (completion >= 1) return "green";
  if (completion >= 0.9) return "orange";
  return "red";
}

function runRateStatus(completion: number, overPlanIsBad = false): Status {
  if (!Number.isFinite(completion)) return "red";
  if (overPlanIsBad) {
    if (completion <= 1) return "green";
    if (completion <= 1.1) return "orange";
    return "red";
  }
  return planStatus(completion);
}

function RunRateCard({
  title,
  fact,
  plan,
  forecast,
  daily,
  completion,
  status
}: {
  title: string;
  fact: string;
  plan: string;
  forecast: string;
  daily: string;
  completion: number;
  status: Status;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <strong className="text-sm text-slate-600">{title}</strong>
        <StatusBadge status={status} />
      </div>
      <div className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3"><span className="text-slate-500">Сейчас</span><b>{fact}</b></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">План</span><b>{plan}</b></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">Ранрейт</span><b>{forecast}</b></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">В день</span><b>{daily}</b></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, completion * 100))}%` }} />
      </div>
      <div className="mt-1 text-xs font-bold text-slate-500">{pct(completion)} от плана по ранрейту</div>
    </article>
  );
}

type CountryInvoiceSlice = CountryInvoiceMetrics & {
  color: string;
  share: number;
};

type InvoiceBreakdownItem = {
  id: string;
  label: string;
  invoicesCount: number;
  invoicesAmount: number;
  salesCount: number;
  revenue: number;
};

type InvoiceBreakdownSlice = InvoiceBreakdownItem & {
  color: string;
  share: number;
};

function buildInvoiceBreakdownSlices(items: InvoiceBreakdownItem[], limit = 7): InvoiceBreakdownSlice[] {
  const normalized = items
    .filter((item) => item.invoicesCount > 0)
    .sort((a, b) => b.invoicesCount - a.invoicesCount || b.invoicesAmount - a.invoicesAmount);
  const totalInvoices = normalized.reduce((sum, item) => sum + item.invoicesCount, 0);
  if (!totalInvoices) return [];

  const top = normalized.slice(0, limit);
  const rest = normalized.slice(limit);
  const slices = rest.length
    ? [...top, {
      id: "other",
      label: "Другие",
      invoicesCount: rest.reduce((sum, item) => sum + item.invoicesCount, 0),
      invoicesAmount: rest.reduce((sum, item) => sum + item.invoicesAmount, 0),
      salesCount: rest.reduce((sum, item) => sum + item.salesCount, 0),
      revenue: rest.reduce((sum, item) => sum + item.revenue, 0)
    }]
    : top;

  return slices.map((item, index) => ({
    ...item,
    color: countryPalette[index % countryPalette.length],
    share: item.invoicesCount / totalInvoices
  }));
}

function InvoiceBreakdownSection({
  title,
  subtitle,
  items,
  entityLabel,
  leaderLabel,
  emptyTitle,
  emptySubtitle
}: {
  title: string;
  subtitle: string;
  items: InvoiceBreakdownItem[];
  entityLabel: string;
  leaderLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
}) {
  const slices = buildInvoiceBreakdownSlices(items);
  const totalInvoices = items.reduce((sum, item) => sum + item.invoicesCount, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.invoicesAmount, 0);
  const totalEntities = items.filter((item) => item.invoicesCount > 0).length;
  const topEntity = slices[0];

  return (
    <section className="card p-4">
      <SectionHead title={title} subtitle={subtitle} />
      {slices.length ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-center">
          <div className="grid gap-4 justify-items-center">
            <div className="relative h-[280px] w-full max-w-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="invoicesCount" nameKey="label" innerRadius={76} outerRadius={108} paddingAngle={2} stroke="none">
                    {slices.map((slice) => <Cell key={slice.id} fill={slice.color} />)}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      const entry = payload?.[0]?.payload as InvoiceBreakdownSlice | undefined;
                      if (!active || !entry) return null;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                          <div className="font-bold text-slate-950">{entry.label}</div>
                          <div className="mt-1 text-slate-600">Счета: <b className="text-slate-950">{number(entry.invoicesCount)}</b></div>
                          <div className="text-slate-600">Сумма: <b className="text-slate-950">{eur(entry.invoicesAmount)}</b></div>
                          <div className="text-slate-600">Оплачено: <b className="text-slate-950">{number(entry.salesCount)} / {eur(entry.revenue)}</b></div>
                          <div className="text-slate-600">Доля: <b className="text-slate-950">{pct(entry.share)}</b></div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-4xl font-black leading-none text-slate-950">{number(totalInvoices)}</div>
                  <div className="mt-1 text-sm text-slate-500">счетов</div>
                  <div className="mt-2 text-sm font-bold text-slate-950">{eur(totalAmount)}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{number(totalEntities)} {entityLabel}</span>
              {topEntity ? <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{leaderLabel}: {topEntity.label}</span> : null}
            </div>
          </div>
          <div className="grid gap-3">
            {slices.map((slice) => (
              <div key={slice.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                      <strong className="truncate text-sm text-slate-950">{slice.label}</strong>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{eur(slice.invoicesAmount)} выставлено</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-950">{number(slice.invoicesCount)} · {pct(slice.share)}</div>
                    <div className="mt-1 text-xs text-slate-500">{number(slice.salesCount)} оплат · {eur(slice.revenue)}</div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(6, slice.share * 100)}%`, backgroundColor: slice.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <div>
            <h3 className="text-lg font-bold">{emptyTitle}</h3>
            <p className="mt-2 max-w-xl text-sm text-slate-500">{emptySubtitle}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function CountryInvoicesSection({ items }: { items: CountryInvoiceMetrics[] }) {
  return (
    <InvoiceBreakdownSection
      title="Выставленные счета по странам"
      subtitle="Структура счетов по странам внутри выбранного среза"
      items={items.map((item) => ({
        id: item.country,
        label: item.country,
        invoicesCount: item.invoicesCount,
        invoicesAmount: item.invoicesAmount,
        salesCount: item.salesCount,
        revenue: item.revenue
      }))}
      entityLabel="стран"
      leaderLabel="Лидер"
      emptyTitle="Здесь появится структура по странам"
      emptySubtitle="После синхронизации Битрикса покажем, из каких стран пришли выставленные счета."
    />
  );
}

function ManagerInvoicesSection({ items }: { items: ManagerInvoiceMetrics[] }) {
  return (
    <InvoiceBreakdownSection
      title="Выставленные счета по менеджерам"
      subtitle="Кто именно держит объём счетов внутри выбранного среза"
      items={items.map((item) => ({
        id: item.managerId,
        label: item.manager,
        invoicesCount: item.invoicesCount,
        invoicesAmount: item.invoicesAmount,
        salesCount: item.salesCount,
        revenue: item.revenue
      }))}
      entityLabel="менеджеров"
      leaderLabel="Лидер"
      emptyTitle="Здесь появится структура по менеджерам"
      emptySubtitle="После синхронизации Битрикса покажем, какие менеджеры формируют выставленные счета."
    />
  );
}

function ProductInvoicesSection({ items }: { items: ProductInvoiceMetrics[] }) {
  return (
    <InvoiceBreakdownSection
      title="Выставленные счета по продуктам"
      subtitle="Какой продукт чаще всего формирует выставленные счета внутри выбранного среза"
      items={items.map((item) => ({
        id: item.product,
        label: item.product,
        invoicesCount: item.invoicesCount,
        invoicesAmount: item.invoicesAmount,
        salesCount: item.salesCount,
        revenue: item.revenue
      }))}
      entityLabel="продуктов"
      leaderLabel="Лидер"
      emptyTitle="Здесь появится структура по продуктам"
      emptySubtitle="После синхронизации Битрикса покажем, какие продукты чаще всего стоят в выставленных счетах."
    />
  );
}

function PlanFactRow({ label, fact, plan, completion, unit = "" }: { label: string; fact: string; plan: string; completion: number; unit?: string }) {
  const normalizedCompletion = Number.isFinite(completion) ? completion : 0;
  const width = Math.min(100, Math.max(0, normalizedCompletion * 100));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <strong className="text-sm">{label}</strong>
        <StatusBadge status={planStatus(completion)} />
      </div>
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-3 text-sm">
        <span className="text-slate-500">Факт: <b className="text-slate-950">{fact}{unit}</b></span>
        <span className="text-slate-500">План: <b className="text-slate-950">{plan}{unit}</b></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-1 text-xs font-bold text-slate-500">{pct(normalizedCompletion)} выполнения</div>
    </div>
  );
}

function FocusMetric({ title, fact, plan, gap, status, runRate }: { title: string; fact: string; plan?: string; gap?: string; status?: Status; runRate?: string }) {
  return (
    <article className="card grid min-h-32 gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-bold text-slate-500">{title}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <strong className="text-3xl leading-none text-slate-950">{fact}</strong>
      {plan || gap || runRate ? (
        <div className="grid gap-1 text-sm text-slate-500">
          {plan ? <span>План: <b className="text-slate-900">{plan}</b></span> : null}
          {gap ? <span>Разрыв: <b className="text-slate-900">{gap}</b></span> : null}
          {runRate ? <span>Ранрейт: <b className="text-slate-900">{runRate}</b></span> : null}
        </div>
      ) : null}
    </article>
  );
}

function SignalCard({ signal }: { signal: ReturnType<typeof buildSignals>[number] }) {
  const Icon = signal.status === "green" ? CheckCircle2 : AlertTriangle;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={signal.status === "red" ? "text-red-600" : signal.status === "orange" ? "text-amber-600" : "text-emerald-700"} size={18} />
          <strong className="text-sm">{signal.title}</strong>
        </div>
        <StatusBadge status={signal.status} />
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
        <span className="rounded-lg bg-slate-50 p-2">Факт: <b>{signal.current}</b></span>
        <span className="rounded-lg bg-slate-50 p-2">Цель: <b>{signal.target}</b></span>
      </div>
      <p className="text-sm leading-5 text-slate-600">{signal.explanation}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{signal.action}</p>
    </article>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function GlobalFilters({
  period,
  setPeriod,
  sourceFilter,
  setSourceFilter,
  countryFilter,
  setCountryFilter,
  countryOptions,
  managerFilter,
  setManagerFilter,
  managerOptions,
  productFilter,
  setProductFilter,
  productOptions = []
}: {
  period: string;
  setPeriod: (period: string) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (source: SourceFilter) => void;
  countryFilter: string;
  setCountryFilter: (country: string) => void;
  countryOptions: string[];
  managerFilter: string;
  setManagerFilter: (manager: string) => void;
  managerOptions: ManagerOption[];
  productFilter: string;
  setProductFilter: (product: string) => void;
  productOptions?: string[];
}) {
  return (
    <section className="card mb-4 grid gap-3 p-4 lg:grid-cols-7">
      <label className="grid gap-1 text-xs font-bold text-slate-500">
        Период
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="july-2026">Июль 2026</option>
          <option value="june-2026">Июнь 2026</option>
          <option value="may-2026">Май 2026</option>
          <option value="week">Неделя</option>
          <option value="custom">Произвольный</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-slate-500">
        Страна
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
          <option value="all">Все</option>
          {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-slate-500">
        Источник
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
          <option value="all">Все</option>
          <option value="paid">Платный трафик</option>
          <option value="organic">Органика</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-slate-500">
        Менеджер
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)}>
          <option value="all">Все</option>
          {managerOptions.map((manager) => <option key={manager.value} value={manager.value}>{manager.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-slate-500">
        Продукт
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
          <option value="all">Все</option>
          {productOptions.map((product) => <option key={product} value={product}>{product}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-slate-500">
        Статус
        <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950">
          <option>Все</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-slate-500">
        Поиск
        <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" placeholder="рынок, менеджер, статус" />
      </label>
    </section>
  );
}

function elapsedDaysForPeriod(period: string) {
  if (period === "july-2026") return 2;
  if (period === "june-2026") return 30;
  if (period === "may-2026") return 31;
  return 2;
}

function monthPrefixForPeriod(period: string) {
  if (period === "july-2026") return "2026-07";
  if (period === "june-2026") return "2026-06";
  if (period === "may-2026") return "2026-05";
  return "2026-07";
}

function periodLabel(period: string) {
  if (period === "july-2026") return "Июль 2026";
  if (period === "june-2026") return "Июнь 2026";
  if (period === "may-2026") return "Май 2026";
  return "Выбранный период";
}

function safeCompletion(fact: number, plan: number) {
  return plan > 0 ? fact / plan : 0;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function filterDailyBySource(items: DailyMetrics[], source: SourceFilter) {
  if (source === "all") return items;
  return items.map((item) => ({
    ...item,
    paidLeads: source === "paid" ? item.paidLeads : 0,
    organicLeads: source === "organic" ? item.organicLeads : 0,
    qualifiedLeads: source === "organic" ? item.organicQualifiedLeads : item.paidQualifiedLeads,
    adSpend: source === "paid" ? item.adSpend : 0
  }));
}

function filterMonthlyTrafficBySource(current: MonthlyMetrics, daily: DailyMetrics[], source: SourceFilter) {
  if (source === "all") return current;
  const filteredDaily = filterDailyBySource(daily, source);
  return {
    ...current,
    paidLeads: filteredDaily.reduce((sum, item) => sum + item.paidLeads, 0),
    organicLeads: filteredDaily.reduce((sum, item) => sum + item.organicLeads, 0),
    qualifiedLeads: filteredDaily.reduce((sum, item) => sum + item.qualifiedLeads, 0),
    adSpend: filteredDaily.reduce((sum, item) => sum + item.adSpend, 0)
  };
}

function dailyFactAt(items: DailyMetrics[], elapsedDays: number) {
  return items[Math.min(Math.max(elapsedDays - 1, 0), items.length - 1)] ?? {
    date: "",
    paidLeads: 0,
    organicLeads: 0,
    qualifiedLeads: 0,
    paidQualifiedLeads: 0,
    organicQualifiedLeads: 0,
    invoicesCount: 0,
    invoicesAmount: 0,
    salesCount: 0,
    revenue: 0,
    adSpend: 0,
    averagePaidCheck: 0,
    activeManagers: 0
  };
}

function Overview({
  current,
  monthlyPlan,
  daily,
  showPlan,
  invoiceCountries,
  invoiceManagers,
  invoiceProducts
}: {
  current: MonthlyMetrics;
  previous: MonthlyMetrics;
  monthlyPlan: MonthlyPlan;
  daily: DailyMetrics[];
  showPlan: boolean;
  invoiceCountries: CountryInvoiceMetrics[];
  invoiceManagers: ManagerInvoiceMetrics[];
  invoiceProducts: ProductInvoiceMetrics[];
}) {
  const elapsedDays = elapsedDaysForPeriod(current.month);
  const monthPlan = deriveMonthlyPlan(monthlyPlan);
  const tempo = revenuePlanCompletion(current.revenue, monthlyPlan.targetRevenue) / (elapsedDays / monthlyPlan.calendarDays);
  const currentLeads = totalLeads(current);
  const qlGap = current.qualifiedLeads - monthlyPlan.qualifiedLeads;
  const hasFacts = current.revenue > 0 || currentLeads > 0 || current.salesCount > 0;
  const todayFact = hasFacts ? dailyFactAt(daily, elapsedDays) : null;
  const chart = hasFacts ? daily.slice(0, Math.max(1, elapsedDays)).map((day) => {
    return {
      day: day.date.slice(-2),
      revenue: day.revenue,
      plan: Math.round(monthPlan.dailyRevenue),
      forecast: Math.round((current.revenue / elapsedDays) * targetScenario.calendarDays / targetScenario.calendarDays),
      paid: day.paidLeads,
      organic: day.organicLeads,
      sales: day.salesCount,
      cr: day.salesCount / (day.paidLeads + day.organicLeads),
      check: day.averagePaidCheck
    };
  }) : [];
  const todayLeadsFact = todayFact ? todayFact.paidLeads + todayFact.organicLeads : 0;
  const todayInvoicesFact = todayFact?.invoicesCount ?? 0;
  const todayInvoicesAmount = todayFact?.invoicesAmount ?? 0;
  const todaySalesFact = todayFact?.salesCount ?? 0;
  const todayRevenueFact = todayFact?.revenue ?? 0;
  const revenueGap = current.revenue - monthlyPlan.targetRevenue;
  const leadsGap = currentLeads - monthPlan.totalLeads;
  const salesGap = current.salesCount - monthPlan.sales;
  const todayRevenueGap = todayRevenueFact - monthPlan.dailyRevenue;
  const todayLeadsGap = todayLeadsFact - monthPlan.dailyLeads;
  const todaySalesGap = todaySalesFact - monthPlan.dailySales;
  const invoicesGap = current.invoicesCount - monthPlan.invoices;
  const invoicesAmountGap = current.invoicesAmount - monthPlan.invoicesAmount;
  const projectMonth = (value: number) => elapsedDays > 0 ? (value / elapsedDays) * monthlyPlan.calendarDays : 0;
  const leadsRunRate = projectMonth(currentLeads);
  const qlRunRate = projectMonth(current.qualifiedLeads);
  const adSpendRunRate = projectMonth(current.adSpend);
  const invoicesRunRate = projectMonth(current.invoicesCount);
  const invoicesAmountRunRate = projectMonth(current.invoicesAmount);
  const salesRunRate = projectMonth(current.salesCount);
  const revenueRunRate = projectMonth(current.revenue);

  return (
    <div className="grid gap-4">
      <FinancialReportLiveSummary period={current.month} />
      <div className="grid gap-4">
        <section className="card p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Сегодня и месяц</h2>
              <p className="mt-1 text-sm text-slate-500">
                {showPlan
                  ? `${monthlyPlan.name} · North Star ${eur(targetScenario.targetRevenue)} · рабочий план закрывает ${pct(monthPlan.northStarProgress)}`
                  : `Фактические показатели за ${periodLabel(current.month)}`}
              </p>
            </div>
          <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              {showPlan ? hasFacts ? "Текущий период с планом" : "Демо-режим: факты не загружены" : "Фактический период"}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <FocusMetric title="Выставлено счетов" fact={`${number(current.invoicesCount)} / ${eur(current.invoicesAmount)}`} plan={showPlan ? `${number(monthPlan.invoices)} / ${eur(monthPlan.invoicesAmount)}` : undefined} gap={showPlan ? `${number(invoicesGap)} / ${eur(invoicesAmountGap)}` : undefined} runRate={showPlan ? `${number(invoicesRunRate)} / ${eur(invoicesAmountRunRate)}` : undefined} status={showPlan ? planStatus(safeCompletion(current.invoicesAmount, monthPlan.invoicesAmount)) : undefined} />
            <FocusMetric title="Оплачено счетов" fact={`${number(current.salesCount)} / ${eur(current.revenue)}`} plan={showPlan ? `${number(monthPlan.sales)} / ${eur(monthlyPlan.targetRevenue)}` : undefined} gap={showPlan ? `${number(salesGap)} / ${eur(revenueGap)}` : undefined} runRate={showPlan ? `${number(salesRunRate)} / ${eur(revenueRunRate)}` : undefined} status={showPlan ? planStatus(safeCompletion(current.revenue, monthlyPlan.targetRevenue)) : undefined} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <FocusMetric title="Лиды" fact={number(currentLeads)} plan={showPlan ? number(monthPlan.totalLeads) : undefined} gap={showPlan ? number(leadsGap) : undefined} runRate={showPlan ? number(leadsRunRate) : undefined} status={showPlan ? planStatus(safeCompletion(currentLeads, monthPlan.totalLeads)) : undefined} />
            <FocusMetric title="Qualified лиды" fact={number(current.qualifiedLeads)} plan={showPlan ? number(monthlyPlan.qualifiedLeads) : undefined} gap={showPlan ? number(qlGap) : undefined} runRate={showPlan ? number(qlRunRate) : undefined} status={showPlan ? planStatus(safeCompletion(current.qualifiedLeads, monthlyPlan.qualifiedLeads)) : undefined} />
            <FocusMetric title="Бюджет трафика" fact={eur(current.adSpend)} plan={showPlan ? eur(monthlyPlan.adSpend) : undefined} gap={showPlan ? eur(current.adSpend - monthlyPlan.adSpend) : undefined} runRate={showPlan ? eur(adSpendRunRate) : undefined} status={showPlan ? current.adSpend <= monthlyPlan.adSpend ? "green" : "orange" : undefined} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FocusMetric title="CR в счет" fact={pct(invoiceConversion(current))} plan={showPlan ? pct(monthlyPlan.invoiceConversion) : undefined} gap={showPlan ? pp(deltaPp(invoiceConversion(current), monthlyPlan.invoiceConversion)) : undefined} status={showPlan ? planStatus(safeCompletion(invoiceConversion(current), monthlyPlan.invoiceConversion)) : undefined} />
            <FocusMetric title="CR в продажу" fact={pct(salesConversion(current))} plan={showPlan ? pct(monthlyPlan.salesConversion) : undefined} gap={showPlan ? pp(deltaPp(salesConversion(current), monthlyPlan.salesConversion)) : undefined} status={showPlan ? planStatus(safeCompletion(salesConversion(current), monthlyPlan.salesConversion)) : undefined} />
            <FocusMetric title="Средний выставленный чек" fact={eur(averageInvoice(current))} plan={showPlan ? eur(monthlyPlan.averagePaidCheck) : undefined} gap={showPlan ? eur(averageInvoice(current) - monthlyPlan.averagePaidCheck) : undefined} status={showPlan ? planStatus(safeCompletion(averageInvoice(current), monthlyPlan.averagePaidCheck)) : undefined} />
            <FocusMetric title="Средний оплаченный чек" fact={eur(averagePaidCheck(current))} plan={showPlan ? eur(monthlyPlan.averagePaidCheck) : undefined} gap={showPlan ? eur(averagePaidCheck(current) - monthlyPlan.averagePaidCheck) : undefined} status={showPlan ? planStatus(safeCompletion(averagePaidCheck(current), monthlyPlan.averagePaidCheck)) : undefined} />
          </div>
        </section>

        <div className="grid gap-4 2xl:grid-cols-2">
          <CountryInvoicesSection items={invoiceCountries} />
          <ManagerInvoicesSection items={invoiceManagers} />
          <ProductInvoicesSection items={invoiceProducts} />
        </div>

        {showPlan ? <section className="card p-4">
          <SectionHead title="План на сегодня" subtitle="Минимальный дневной ориентир без лишней аналитики" />
          <div className="grid gap-3 md:grid-cols-3">
            <PlanFactRow label="Счета" fact={`${number(todayInvoicesFact)} / ${eur(todayInvoicesAmount)}`} plan={`${number(monthPlan.dailyInvoices)} / ${eur(monthPlan.dailyInvoicesAmount)}`} completion={safeCompletion(todayInvoicesAmount, monthPlan.dailyInvoicesAmount)} />
            <PlanFactRow label="Оплачено счетов" fact={`${number(todaySalesFact)} / ${eur(todayRevenueFact)}`} plan={`${number(monthPlan.dailySales)} / ${eur(monthPlan.dailyRevenue)}`} completion={safeCompletion(todayRevenueFact, monthPlan.dailyRevenue)} />
            <PlanFactRow label="Лиды" fact={number(todayLeadsFact)} plan={number(monthPlan.dailyLeads)} completion={safeCompletion(todayLeadsFact, monthPlan.dailyLeads)} />
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Разрыв дня: {eur(todayRevenueGap)} оплат · {number(todayLeadsGap)} лидов · {number(todaySalesGap)} продаж. Темп месяца: <b className="text-slate-950">{pct(tempo)}</b>.
          </div>
        </section> : null}

        <section className="card p-4">
          <SectionHead title={showPlan ? "План-факт оплат" : "Факт оплат по дням"} subtitle={hasFacts ? "Оплаты внутри когорты выставленных счетов" : `Факты за ${periodLabel(current.month).toLowerCase()} ещё не загружены из Битрикса`} />
          {hasFacts ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" name="Выручка" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  {showPlan ? <Line dataKey="plan" name="План дня" stroke="#c2413a" strokeDasharray="5 5" dot={false} /> : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div>
                <h3 className="text-lg font-bold">Здесь появится динамика после синхронизации</h3>
                <p className="mt-2 max-w-xl text-sm text-slate-500">Пока показываем пустое состояние, чтобы демо-данные не выглядели как реальные факты июля.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PlanningInput({ label, value, onChange, suffix = "", step = 1 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: number }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-600">
      <span>{label}</span>
      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        <input className="h-11 min-w-0 flex-1 px-3 text-slate-950 outline-none" type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix ? <span className="border-l border-slate-200 bg-slate-50 px-3 text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function MonthPlanningTab({ current, monthlyPlan, setMonthlyPlan, daily }: { current: MonthlyMetrics; monthlyPlan: MonthlyPlan; setMonthlyPlan: (plan: MonthlyPlan) => void; daily: DailyMetrics[] }) {
  const derived = deriveMonthlyPlan(monthlyPlan);
  const elapsedDays = elapsedDaysForPeriod(current.month);
  const expectedRevenueByToday = derived.dailyRevenue * elapsedDays;
  const expectedLeadsByToday = derived.dailyLeads * elapsedDays;
  const expectedSalesByToday = derived.dailySales * elapsedDays;
  const planGap = derived.economyRevenue - monthlyPlan.targetRevenue;
  const northStarGap = targetScenario.targetRevenue - monthlyPlan.targetRevenue;
  const update = (patch: Partial<MonthlyPlan>) => setMonthlyPlan({ ...monthlyPlan, ...patch });

  const presets: Array<{ label: string; plan: MonthlyPlan }> = [
    {
      label: "Осторожный рост",
      plan: { ...monthlyPlan, name: "Осторожный рост", targetRevenue: 40000, totalLeads: 3120, paidLeads: 2600, organicLeads: 520, qualifiedLeads: 2050, salesCount: 562, invoicesCount: 562, salesConversion: 0.18, invoiceConversion: 0.18, averagePaidCheck: 71, adSpend: 5600 }
    },
    {
      label: "Рабочий план",
      plan: defaultMonthlyPlan
    },
    {
      label: "Шаг к North Star",
      plan: { ...monthlyPlan, name: "Шаг к North Star", targetRevenue: 65000, totalLeads: 4050, paidLeads: 3400, organicLeads: 650, qualifiedLeads: 2900, salesCount: 932, invoicesCount: 891, salesConversion: 0.23, invoiceConversion: 0.22, averagePaidCheck: 76, adSpend: 8500 }
    },
    {
      label: "North Star модель",
      plan: { name: "North Star модель", targetRevenue: 100000, totalLeads: targetScenario.totalLeads, paidLeads: targetScenario.paidLeads, organicLeads: targetScenario.organicLeads, qualifiedLeads: 3400, salesCount: targetScenario.salesCount, invoicesCount: 1305, salesConversion: targetScenario.salesConversion, invoiceConversion: 0.29, averagePaidCheck: targetScenario.averagePaidCheck, adSpend: 11000, targetAdsBudget: 10000, seedingBudget: 500, bloggersBudget: 300, ugcBudget: 200, calendarDays: targetScenario.calendarDays }
    }
  ];

  const planRows = [
    ["Выручка", eur(current.revenue), eur(monthlyPlan.targetRevenue), current.revenue / monthlyPlan.targetRevenue],
    ["Лиды", number(totalLeads(current)), number(derived.totalLeads), totalLeads(current) / derived.totalLeads],
    ["Продажи", number(current.salesCount), number(derived.sales), current.salesCount / derived.sales],
    ["Счета", number(current.invoicesCount), number(derived.invoices), current.invoicesCount / derived.invoices],
    ["CR в продажу", pct(salesConversion(current)), pct(monthlyPlan.salesConversion), salesConversion(current) / monthlyPlan.salesConversion],
    ["Средний чек", eur(averagePaidCheck(current)), eur(monthlyPlan.averagePaidCheck), averagePaidCheck(current) / monthlyPlan.averagePaidCheck],
    ["Бюджет", eur(current.adSpend), eur(monthlyPlan.adSpend), current.adSpend / monthlyPlan.adSpend],
    ["CPL", eur(paidCpl(current)), `≤ ${eur(derived.cpl)}`, derived.cpl / paidCpl(current)]
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <section className="card p-4">
        <SectionHead title="Планирование месяца" subtitle="Рабочий план текущего месяца отдельно от North Star €100 000" />
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          {presets.map((preset) => (
            <button key={preset.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold hover:border-blue-300" onClick={() => setMonthlyPlan(preset.plan)}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-600 md:col-span-3">
            Название плана
            <input className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-slate-950 outline-none" value={monthlyPlan.name} onChange={(event) => update({ name: event.target.value })} />
          </label>
          <PlanningInput label="План выручки" value={monthlyPlan.targetRevenue} onChange={(targetRevenue) => update({ targetRevenue })} suffix="€" />
          <PlanningInput label="Все лиды" value={monthlyPlan.totalLeads} onChange={(totalLeads) => update({ totalLeads })} />
          <PlanningInput label="Платные лиды" value={monthlyPlan.paidLeads} onChange={(paidLeads) => update({ paidLeads })} />
          <PlanningInput label="Органические лиды" value={monthlyPlan.organicLeads} onChange={(organicLeads) => update({ organicLeads })} />
          <PlanningInput label="QL" value={monthlyPlan.qualifiedLeads} onChange={(qualifiedLeads) => update({ qualifiedLeads })} />
          <PlanningInput label="Продажи" value={monthlyPlan.salesCount} onChange={(salesCount) => update({ salesCount, salesConversion: salesCount / Math.max(1, monthlyPlan.totalLeads) })} />
          <PlanningInput label="Счета" value={monthlyPlan.invoicesCount} onChange={(invoicesCount) => update({ invoicesCount, invoiceConversion: invoicesCount / Math.max(1, monthlyPlan.totalLeads) })} />
          <PlanningInput label="CR в счёт" value={monthlyPlan.invoiceConversion * 100} onChange={(value) => update({ invoiceConversion: value / 100 })} suffix="%" step={0.1} />
          <PlanningInput label="CR в продажу" value={monthlyPlan.salesConversion * 100} onChange={(value) => update({ salesConversion: value / 100 })} suffix="%" step={0.1} />
          <PlanningInput label="Средний оплаченный чек" value={monthlyPlan.averagePaidCheck} onChange={(averagePaidCheck) => update({ averagePaidCheck })} suffix="€" step={0.5} />
          <PlanningInput label="Рекламный бюджет" value={monthlyPlan.adSpend} onChange={(adSpend) => update({ adSpend })} suffix="€" />
          <PlanningInput label="Таргет" value={monthlyPlan.targetAdsBudget} onChange={(targetAdsBudget) => update({ targetAdsBudget })} suffix="€" />
          <PlanningInput label="Посевы" value={monthlyPlan.seedingBudget} onChange={(seedingBudget) => update({ seedingBudget })} suffix="€" />
          <PlanningInput label="Блогеры" value={monthlyPlan.bloggersBudget} onChange={(bloggersBudget) => update({ bloggersBudget })} suffix="€" />
          <PlanningInput label="UGC" value={monthlyPlan.ugcBudget} onChange={(ugcBudget) => update({ ugcBudget })} suffix="€" />
          <PlanningInput label="Календарные дни" value={monthlyPlan.calendarDays} onChange={(calendarDays) => update({ calendarDays })} />
        </div>
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div><span className="text-xs font-bold uppercase text-blue-700">Расчётная выручка</span><strong className="block text-2xl">{eur(derived.economyRevenue)}</strong></div>
            <div><span className="text-xs font-bold uppercase text-blue-700">Разрыв к плану</span><strong className={`block text-2xl ${planGap >= 0 ? "text-emerald-700" : "text-red-700"}`}>{planGap >= 0 ? "+" : ""}{eur(planGap)}</strong></div>
            <div><span className="text-xs font-bold uppercase text-blue-700">До North Star</span><strong className="block text-2xl">{eur(Math.max(0, northStarGap))}</strong></div>
            <div><span className="text-xs font-bold uppercase text-blue-700">Доля North Star</span><strong className="block text-2xl">{pct(derived.northStarProgress)}</strong></div>
          </div>
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="card p-4">
          <SectionHead title="Декомпозиция дня" subtitle="Что нужно делать каждый день по этому плану" />
          <div className="grid gap-3">
            <PlanFactRow label="Выручка / день" fact={eur(dailyFactAt(daily, elapsedDays).revenue)} plan={eur(derived.dailyRevenue)} completion={safeCompletion(dailyFactAt(daily, elapsedDays).revenue, derived.dailyRevenue)} />
            <PlanFactRow label="Лиды / день" fact={number(dailyFactAt(daily, elapsedDays).paidLeads + dailyFactAt(daily, elapsedDays).organicLeads)} plan={number(derived.dailyLeads)} completion={safeCompletion(dailyFactAt(daily, elapsedDays).paidLeads + dailyFactAt(daily, elapsedDays).organicLeads, derived.dailyLeads)} />
            <PlanFactRow label="Продажи / день" fact={number(dailyFactAt(daily, elapsedDays).salesCount)} plan={number(derived.dailySales)} completion={safeCompletion(dailyFactAt(daily, elapsedDays).salesCount, derived.dailySales)} />
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6">
            К {elapsedDays}-му дню должно быть: {eur(expectedRevenueByToday)}, {number(expectedLeadsByToday)} лидов, {number(expectedSalesByToday)} продаж.
          </div>
          <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between gap-3"><span>QL</span><b>{number(monthlyPlan.qualifiedLeads)}</b></div>
            <div className="flex justify-between gap-3"><span>CPL</span><b>{eur(derived.cpl)}</b></div>
            <div className="flex justify-between gap-3"><span>Таргет</span><b>{eur(monthlyPlan.targetAdsBudget)}</b></div>
            <div className="flex justify-between gap-3"><span>Посевы</span><b>{eur(monthlyPlan.seedingBudget)}</b></div>
            <div className="flex justify-between gap-3"><span>Блогеры</span><b>{eur(monthlyPlan.bloggersBudget)}</b></div>
            <div className="flex justify-between gap-3"><span>UGC</span><b>{eur(monthlyPlan.ugcBudget)}</b></div>
          </div>
        </section>
        <section className="card p-4">
          <SectionHead title="План-факт" subtitle="Текущий факт против рабочего плана" />
          <div className="grid gap-3">
            {planRows.map(([label, fact, plan, completion]) => (
              <PlanFactRow key={label} label={label} fact={fact} plan={plan} completion={completion} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PlanTab({ current, daily }: { current: MonthlyMetrics; daily: DailyMetrics[] }) {
  const [leads, setLeads] = useState(4500);
  const [cr, setCr] = useState(28);
  const [check, setCheck] = useState(80);
  const [budget, setBudget] = useState(12000);
  const [organic, setOrganic] = useState(600);
  const forecast = scenarioForecast({ ...targetScenario, totalLeads: leads, paidLeads: Math.max(0, leads - organic), organicLeads: organic, salesConversion: cr / 100, averagePaidCheck: check, monthlyAdSpendMax: budget });
  const plan = dailyPlan(targetScenario, daily, 20);
  const scenarioFields: Array<{ label: string; value: number; setValue: (value: number) => void; min: number; max: number; digits?: number }> = [
    { label: "Количество лидов", value: leads, setValue: setLeads, min: 2000, max: 6000 },
    { label: "CR, %", value: cr, setValue: setCr, min: 10, max: 35, digits: 1 },
    { label: "Средний чек, €", value: check, setValue: setCheck, min: 50, max: 120 },
    { label: "Рекламный бюджет, €", value: budget, setValue: setBudget, min: 3000, max: 16000 },
    { label: "Органические лиды", value: organic, setValue: setOrganic, min: 200, max: 900 }
  ];

  const presets = [
    ["Текущая экономика июня", 2710, 16.75, 74.85, 4548, 450],
    ["Умеренный рост", 3600, 22, 78, 8500, 550],
    ["Целевая модель €100 000", 4500, 28, 80, 12000, 600]
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <section className="card p-4">
        <SectionHead title="Что необходимо закрыть для €100 000" subtitle="4500 лидов × 28% × €80 = €100 800" />
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Выручка" value={eur(current.revenue)} hint={`План ${eur(targetScenario.targetRevenue)}`} formula="revenue / targetRevenue" />
          <MetricCard title="Лиды" value={number(totalLeads(current))} hint={`План ${number(targetScenario.totalLeads)}`} formula="paidLeads + organicLeads" />
          <MetricCard title="Продажи" value={number(current.salesCount)} hint={`План ${number(targetScenario.salesCount)}`} formula="totalLeads × salesConversion" />
          <MetricCard title="CPL" value={eur(paidCpl(current))} hint={`Максимум ${eur(targetScenario.maxPaidCpl)}`} formula="adSpend / paidLeads" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {presets.map(([name, pLeads, pCr, pCheck, pBudget, pOrganic]) => (
            <button key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-bold" onClick={() => { setLeads(pLeads); setCr(pCr); setCheck(pCheck); setBudget(pBudget); setOrganic(pOrganic); }}>
              {name}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {scenarioFields.map((field) => (
            <label key={field.label} className="grid gap-2 text-sm font-bold text-slate-600">
              <span className="flex justify-between"><span>{field.label}</span><b>{number(field.value, field.digits ?? 0)}</b></span>
              <input type="range" min={field.min} max={field.max} value={field.value} onChange={(event) => field.setValue(Number(event.target.value))} />
            </label>
          ))}
        </div>
      </section>
      <aside className="card p-4">
        <SectionHead title="Сценарный прогноз" subtitle="Пересчитывается при изменении полей" />
        <div className="grid gap-3">
          <MetricCard title="Прогноз продаж" value={number(forecast.sales)} hint={`Дефицит: ${number(Math.min(0, forecast.salesGap))}`} formula="totalLeads × CR" />
          <MetricCard title="Прогноз выручки" value={eur(forecast.revenue)} hint={`${forecast.revenueGap >= 0 ? "Избыток" : "Дефицит"} ${eur(Math.abs(forecast.revenueGap))}`} formula="sales × averagePaidCheck" />
          <MetricCard title="Прогноз Cash ROAS" value={pct(forecast.cashRoas)} hint={`${eur(forecast.revenue)} / ${eur(budget)}`} formula="forecastRevenue / adBudget" />
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6">
            <b>План на сегодня:</b><br />
            {number(plan.todayLeadsPlan)} лидов, {number(plan.todaySalesPlan)} продаж, {eur(plan.todayRevenuePlan)} выручки.<br />
            На менеджера: {number(plan.perManagerLeads)} лидов, {number(plan.perManagerSales)} продаж, {eur(plan.perManagerRevenue)}.
          </div>
        </div>
      </aside>
    </div>
  );
}

function FunnelTab({ current, quality }: { current: MonthlyMetrics; quality: (typeof qualityMetrics)[number] }) {
  const leads = totalLeads(current);
  const stages = [
    ["Все лиды", leads],
    ["Содержательные диалоги", quality.meaningfulDialogs],
    ["Квалифицирован получатель", Math.round(quality.meaningfulDialogs * quality.recipientQualificationPct / 100)],
    ["Персональная рекомендация", Math.round(quality.meaningfulDialogs * quality.personalRecommendationPct / 100)],
    ["Получен визуал", Math.round(quality.meaningfulDialogs * quality.visualContentPct / 100)],
    ["Названа полная сумма", Math.round(quality.meaningfulDialogs * quality.fullFinalPricePct / 100)],
    ["Вопрос об оформлении", Math.round(quality.meaningfulDialogs * quality.directClosingQuestionPct / 100)],
    ["Выставлен счёт", current.invoicesCount],
    ["Продажа", current.salesCount],
    ["Оплата / выручка", Math.round(current.revenue / averagePaidCheck(current))]
  ];
  const rows = stages.map(([name, value], index) => {
    const prev = index === 0 ? Number(value) : Number(stages[index - 1][1]);
    const loss = Math.max(0, prev - Number(value));
    return { name: String(name), value: Number(value), fromPrev: index === 0 ? 1 : Number(value) / prev, fromAll: Number(value) / leads, loss, lostRevenue: loss * averagePaidCheck(current) };
  });
  const bottleneck = rows.slice(1).reduce((min, row) => row.fromPrev < min.fromPrev ? row : min, rows[1]);

  return (
    <section className="card p-4">
      <SectionHead title="Воронка" subtitle={`Узкое место: ${bottleneck.name}`} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="h-[430px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={140} />
              <Tooltip />
              <Bar dataKey="value" name="Количество" fill="#2563eb" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Этап</th><th>Кол-во</th><th>От пред.</th><th>От всех</th><th>Потери</th><th>Потерянная выручка</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.name} className={row.name === bottleneck.name ? "bg-amber-50" : ""}><td>{row.name}</td><td>{number(row.value)}</td><td>{pct(row.fromPrev)}</td><td>{pct(row.fromAll)}</td><td>{number(row.loss)}</td><td>{eur(row.lostRevenue)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MarketingTab({ current, previous }: { current: MonthlyMetrics; previous: MonthlyMetrics }) {
  const comparison = [
    ["Платные лиды", previous.paidLeads, current.paidLeads],
    ["Органика", previous.organicLeads, current.organicLeads],
    ["Общий объём лидов", totalLeads(previous), totalLeads(current)],
    ["Бюджет", previous.adSpend, current.adSpend],
    ["CPL", paidCpl(previous), paidCpl(current)],
    ["Выручка", previous.revenue, current.revenue]
  ];
  return (
    <div className="grid gap-4">
      <section className="card border-l-4 border-l-emerald-500 p-4">
        <SectionHead title="Аналитика рекламы" subtitle="GA4, каналы, сверка с CRM и вопросы к Gemini — в отдельном разделе" />
        <Link href="/ad-analytics" className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
          Открыть аналитику рекламы →
        </Link>
      </section>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Платные лиды" value={number(current.paidLeads)} hint={`Май: ${number(previous.paidLeads)}`} formula="paidLeads" deltaValue={delta(current.paidLeads, previous.paidLeads)} />
        <MetricCard title="Органика" value={number(current.organicLeads)} hint={`Май: ${number(previous.organicLeads)}`} formula="organicLeads" deltaValue={delta(current.organicLeads, previous.organicLeads)} />
        <MetricCard title="Cash ROAS" value={pct(cashRoas(current))} hint="Оплаченная выручка / бюджет" formula="revenue / adSpend" />
        <MetricCard title="Invoice ROAS" value={pct(invoiceRoas(current))} hint="Сумма счетов / бюджет" formula="invoicesAmount / adSpend" />
      </div>
      <section className="card p-4">
        <SectionHead title="Май против июня" subtitle="Все изменения рассчитаны автоматически" />
        <div className="table-scroll"><table><thead><tr><th>Метрика</th><th>Май</th><th>Июнь</th><th>Изменение</th></tr></thead><tbody>{comparison.map(([name, prev, cur]) => <tr key={String(name)}><td>{name}</td><td>{String(name) === "CPL" ? eur(Number(prev)) : String(name) === "Бюджет" || String(name) === "Выручка" ? eur(Number(prev)) : number(Number(prev))}</td><td>{String(name) === "CPL" ? eur(Number(cur)) : String(name) === "Бюджет" || String(name) === "Выручка" ? eur(Number(cur)) : number(Number(cur))}</td><td>{pct(delta(Number(cur), Number(prev)))}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function SalesTab({ current }: { current: MonthlyMetrics }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Выставлено счетов" value={number(current.invoicesCount)} hint={eur(current.invoicesAmount)} formula="invoicesCount / invoicesAmount" />
          <MetricCard title="Оплачено денег" value={eur(current.revenue)} hint={`${number(current.salesCount)} продаж`} formula="paid deals inside selected cohort" />
        <MetricCard title="Средний выставленный счёт" value={eur(averageInvoice(current))} hint="invoicesAmount / invoicesCount" formula="invoicesAmount / invoicesCount" />
        <MetricCard title="Средний оплаченный чек" value={eur(averagePaidCheck(current))} hint="revenue / salesCount" formula="revenue / salesCount" />
        <MetricCard title="CR в счёт" value={pct(invoiceConversion(current))} hint="Счета / все лиды" formula="invoicesCount / totalLeads" />
        <MetricCard title="CR в продажу" value={pct(salesConversion(current))} hint="Продажи / все лиды" formula="salesCount / totalLeads" />
        <MetricCard title="Аннулированные счета" value={number(current.cancelledInvoicesCount)} hint={eur(current.cancelledInvoicesAmount)} formula="cancelledInvoicesCount, cancelledInvoicesAmount" />
        <MetricCard title="Выручка на лид" value={eur(revenuePerLead(current))} hint="revenue / totalLeads" formula="revenue / totalLeads" />
      </div>
      <section className="card p-4">
        <SectionHead title="Счета против оплат" subtitle="Когорта выбранного месяца: счета по дате создания, оплаты среди этих счетов" />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Выставлено счетов", value: current.invoicesAmount }, { name: "Аннулировано", value: current.cancelledInvoicesAmount }, { name: "Получено выручки", value: current.revenue }]}><CartesianGrid stroke="#e5e7eb" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function QualityTab({ dashboard, onConversationImport }: { dashboard: ConversationDashboardMetrics; onConversationImport: (dashboard: ConversationDashboardMetrics) => void }) {
  const may = qualityMetrics[0];
  const june = qualityMetrics[1];
  const [conversationStatus, setConversationStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Полный gift-ai импорт уже загружается автоматически. Можно перезагрузить период вручную."
  });
  const [lastConversationImport, setLastConversationImport] = useState<ConversationDashboardMetrics | null>(null);
  const [conversationDiagnostics, setConversationDiagnostics] = useState<ConversationImportFileDiagnostic[]>([]);
  const [geminiStatus, setGeminiStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Gemini-анализ ещё не запускался."
  });
  const [geminiSummary, setGeminiSummary] = useState<GeminiConversationSummary | null>(null);
  const rows = [
    ["Персональная рекомендация", may.personalRecommendationPct, june.personalRecommendationPct],
    ["Квалификация получателя", may.recipientQualificationPct, june.recipientQualificationPct],
    ["Фотографии и примеры", may.visualContentPct, june.visualContentPct],
    ["Прямой вопрос об оформлении", may.directClosingQuestionPct, june.directClosingQuestionPct],
    ["Полная итоговая сумма", may.fullFinalPricePct, june.fullFinalPricePct],
    ["Стоимость доставки", may.shippingPriceMentionPct, june.shippingPriceMentionPct],
    ["SLA медиана, мин", may.medianResponseMinutes, june.medianResponseMinutes],
    ["Расширенное предложение", may.extendedOfferPct, june.extendedOfferPct]
  ];
  const importGiftAiExport = useCallback(async (key: "may" | "june" | "may-june") => {
    const label = key === "may" ? "майский экспорт" : key === "june" ? "июньский экспорт" : "экспорты за май и июнь";
    setConversationStatus({ state: "loading", message: `Загружаю ${label} из gift-ai...` });
    try {
      const response = await fetch("/api/conversations/import-local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key })
      });
      const data = await response.json() as ConversationImportPayload;
      setConversationDiagnostics(data.diagnostics ?? []);
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить экспорт gift-ai");
      onConversationImport(data.dashboard);
      setLastConversationImport(data.dashboard);
      setConversationStatus({
        state: "ok",
        message: `Экспорт gift-ai загружен: файлов ${number(data.summary.filesLoaded)}, сообщений ${number(data.summary.messagesLoaded)}, диалогов ${number(data.summary.dialogsLoaded)}.`
      });
    } catch (error) {
      setConversationStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить экспорт gift-ai"
      });
    }
  }, [onConversationImport]);

  const analyzeWithGemini = useCallback(async () => {
    setGeminiStatus({ state: "loading", message: "Gemini размечает диалоги. Первый запуск может занять до пары минут..." });
    try {
      const response = await fetch("/api/conversations/gemini", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "may-june", limit: 80, batchSize: 8 })
      });
      const data = await response.json() as GeminiConversationPayload;
      if (!response.ok) throw new Error(data.error || "Gemini-анализ не выполнился");
      setGeminiSummary(data.summary);
      setGeminiStatus({
        state: "ok",
        message: `Gemini обработал ${number(data.summary.analyzedDialogs)} диалогов: новых ${number(data.summary.newDialogs)}, из кеша ${number(data.summary.cachedDialogs)}.`
      });
    } catch (error) {
      setGeminiStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Gemini-анализ не выполнился"
      });
    }
  }, []);

  return (
    <div className="grid gap-4">
      <div className={`card border-l-4 p-5 ${dashboard.sampleReliability === "reliable" ? "border-l-blue-600" : "border-l-amber-500"}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">Главный вывод</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${dashboard.sampleReliability === "reliable" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800"}`}>
            {sampleReliabilityLabel[dashboard.sampleReliability]}
          </span>
        </div>
        <p className="text-slate-600">{conversationSampleNote(dashboard)}</p>
        <p className="mt-2 text-slate-600">Интерпретация ниже показывает, какие симптомы встречаются в загруженных переписках: рекомендация, доставка, полный расчёт, закрытие и follow-up.</p>
      </div>
      <section className="card p-4">
        <SectionHead title="Импорт и AI-разметка" subtitle="gift-ai экспорт и смысловой анализ Gemini для этой вкладки" />
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-60"
            onClick={() => importGiftAiExport("may")}
            disabled={conversationStatus.state === "loading"}
          >
            Загрузить gift-ai за май
          </button>
          <button
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-60"
            onClick={() => importGiftAiExport("june")}
            disabled={conversationStatus.state === "loading"}
          >
            Загрузить gift-ai за июнь
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            onClick={() => importGiftAiExport("may-june")}
            disabled={conversationStatus.state === "loading"}
          >
            Загрузить май + июнь
          </button>
          <button
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            onClick={analyzeWithGemini}
            disabled={geminiStatus.state === "loading"}
          >
            {geminiStatus.state === "loading" ? "Анализирую..." : "Запустить Gemini"}
          </button>
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold">
          <p className={conversationStatus.state === "error" ? "text-red-700" : conversationStatus.state === "ok" ? "text-emerald-700" : "text-slate-500"}>
            {conversationStatus.message}
          </p>
          <p className={geminiStatus.state === "error" ? "text-red-700" : geminiStatus.state === "ok" ? "text-emerald-700" : "text-slate-500"}>
            {geminiStatus.message}
          </p>
        </div>
        {conversationDiagnostics.length ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">Что реально прочиталось из файлов</div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Файл</th><th>Статус</th><th>Сообщения</th><th>Диалоги</th><th>Комментарий</th></tr></thead>
                <tbody>
                  {conversationDiagnostics.map((item) => (
                    <tr key={item.filename}>
                      <td>{item.filename}</td>
                      <td><span className={item.status === "ok" ? "text-emerald-700" : "text-red-700"}>{item.status === "ok" ? "Прочитан" : "Ошибка"}</span></td>
                      <td>{number(item.messages)}</td>
                      <td>{number(item.dialogs)}</td>
                      <td>{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {lastConversationImport ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:grid-cols-4">
            <div><span className="text-xs font-bold uppercase text-emerald-700">Диалоги</span><strong className="mt-1 block text-2xl text-slate-950">{number(lastConversationImport.totalDialogs)}</strong></div>
            <div><span className="text-xs font-bold uppercase text-emerald-700">CR в заказ</span><strong className="mt-1 block text-2xl text-slate-950">{pct(lastConversationImport.orderConversion)}</strong></div>
            <div><span className="text-xs font-bold uppercase text-emerald-700">Quality Score</span><strong className="mt-1 block text-2xl text-slate-950">{number(lastConversationImport.qualityScore)}/100</strong></div>
            <div><span className="text-xs font-bold uppercase text-emerald-700">Потерянная выручка</span><strong className="mt-1 block text-2xl text-slate-950">{eur(lastConversationImport.potentialLostRevenue)}</strong></div>
          </div>
        ) : null}
        {geminiSummary ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-white p-3"><span className="text-xs font-bold uppercase text-violet-700">Модель</span><b className="mt-1 block text-slate-950">{geminiSummary.model}</b></div>
              <div className="rounded-lg bg-white p-3"><span className="text-xs font-bold uppercase text-violet-700">Диалоги</span><b className="mt-1 block text-slate-950">{number(geminiSummary.analyzedDialogs)}</b></div>
              <div className="rounded-lg bg-white p-3"><span className="text-xs font-bold uppercase text-violet-700">Средний score</span><b className="mt-1 block text-slate-950">{number(geminiSummary.averageQualityScore)}/100</b></div>
              <div className="rounded-lg bg-white p-3"><span className="text-xs font-bold uppercase text-violet-700">На ревью</span><b className="mt-1 block text-slate-950">{number(geminiSummary.needsHumanReview)}</b></div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-3">
                <b className="text-sm">Частые упущения</b>
                <div className="mt-2 grid gap-2">
                  {geminiSummary.topMissedOpportunities.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex justify-between gap-3 text-sm"><span>{item.name}</span><b>{number(item.count)}</b></div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <b className="text-sm">Причины потерь</b>
                <div className="mt-2 grid gap-2">
                  {geminiSummary.topLossReasons.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex justify-between gap-3 text-sm"><span>{item.name}</span><b>{number(item.count)}</b></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="table-scroll rounded-lg bg-white">
              <table>
                <thead><tr><th>Диалог</th><th>Score</th><th>Итог</th><th>Вывод</th><th>Следующий шаг</th></tr></thead>
                <tbody>
                  {geminiSummary.sample.slice(0, 6).map((item) => (
                    <tr key={item.dialogId}>
                      <td>{item.dialogId}</td>
                      <td>{number(item.qualityScore)}</td>
                      <td>{item.outcome}</td>
                      <td>{item.summary}</td>
                      <td>{item.recommendedNextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Диалоги" value={number(dashboard.totalDialogs)} hint="структурированы из переписок" formula="count(dialogs)" />
        <MetricCard title="CR в заказ" value={pct(dashboard.orderConversion)} hint="по импортированным диалогам" formula="orders / dialogs" />
        <MetricCard title="Quality Score" value={`${number(dashboard.qualityScore)}/100`} hint="рекомендация, доставка, расчёт" formula="weighted dialogue quality" />
        <MetricCard title="Потерянная выручка" value={eur(dashboard.potentialLostRevenue)} hint="оценка по худшим точкам" formula="lost points × average order × risk" />
      </div>
      <section className="card p-4">
        <SectionHead title="Качество переписок" subtitle="Сравнение мая и июня" />
        <div className="table-scroll"><table><thead><tr><th>Метрика</th><th>Май</th><th>Июнь</th><th>Изменение</th></tr></thead><tbody>{rows.map(([name, mayValue, juneValue]) => <tr key={String(name)}><td>{name}</td><td>{String(name).includes("мин") ? `${mayValue}` : `${Number(mayValue).toFixed(1)}%`}</td><td>{String(name).includes("мин") ? `${juneValue}` : `${Number(juneValue).toFixed(1)}%`}</td><td>{String(name).includes("мин") ? number(Number(juneValue) - Number(mayValue)) : pp((Number(juneValue) - Number(mayValue)) / 100)}</td></tr>)}</tbody></table></div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <SectionHead title="Конверсия по каналам" subtitle="После нормализации dialog_id и исходного канала" />
          <div className="table-scroll"><table><thead><tr><th>Канал</th><th>Диалоги</th><th>Заказы</th><th>CR</th></tr></thead><tbody>{dashboard.conversionByChannel.map((row) => <tr key={row.channel}><td>{row.channel}</td><td>{number(row.dialogs)}</td><td>{number(row.orders)}</td><td>{pct(row.conversion)}</td></tr>)}</tbody></table></div>
        </section>
        <section className="card p-4">
          <SectionHead title="Худшие точки" subtitle="Что чаще всего оставляет деньги в переписках" />
          <div className="grid gap-3">
            {dashboard.worstDialoguePoints.map((point) => (
              <div key={point.name} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex justify-between gap-3 text-sm"><b>{point.name}</b><span>{number(point.count)} диалогов</span></div>
                <strong className="mt-1 block text-red-700">− {eur(point.lostRevenue)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <SectionHead title="Топ возражений и причин потери" subtitle="Извлекается из текста сообщений" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">{dashboard.topObjections.map((item) => <div key={item.name} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{item.name}</span><b>{number(item.count)}</b></div>)}</div>
            <div className="grid gap-2">{dashboard.topLossReasons.map((item) => <div key={item.name} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{item.name}</span><b>{number(item.count)}</b></div>)}</div>
          </div>
        </section>
        <section className="card p-4">
          <SectionHead title="Лучшие сценарии продаж" subtitle="Комбинации действий, которые дают лучший CR" />
          <div className="grid gap-3">
            {dashboard.bestSalesScenarios.map((scenario) => (
              <div key={scenario.name} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex justify-between gap-3 text-sm"><b>{scenario.name}</b><span>{number(scenario.dialogs)} диалогов</span></div>
                <div className="mt-1 text-sm text-slate-500">CR <b className="text-slate-950">{pct(scenario.conversion)}</b> · средний заказ <b className="text-slate-950">{eur(scenario.averageOrder)}</b></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="card p-4">
        <SectionHead title="Факторный анализ" subtitle="Влияние факторов на продажу относительно базовой конверсии" />
        <div className="table-scroll"><table><thead><tr><th>Фактор</th><th>Сегмент</th><th>Диалоги</th><th>CR</th><th>Влияние</th><th>Оценка денег</th></tr></thead><tbody>{dashboard.factors.slice(0, 14).map((factor) => <tr key={`${factor.factor}-${factor.segment}`}><td>{factor.factor}</td><td>{factor.segment}</td><td>{number(factor.dialogs)}</td><td>{pct(factor.conversion)}</td><td>{pp(factor.influencePp)}</td><td>{eur(factor.estimatedRevenueImpact)}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function marketStatus(market: MarketMetrics): Status {
  const completion = market.revenue / market.targetRevenue;
  if (completion >= 0.9) return "green";
  if (completion >= 0.65) return "orange";
  return "red";
}

function MarketsTab() {
  const [markets, setMarkets] = useState(marketMetrics);
  const sum = markets.reduce((acc, market) => acc + market.targetRevenue, 0);
  return (
    <section className="card p-4">
      <SectionHead title="Рынки" subtitle="План каждого рынка можно редактировать" />
      {sum !== 100000 ? <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Сумма планов рынков: {eur(sum)}. Нужно ровно €100 000.</div> : null}
      <div className="table-scroll"><table><thead><tr><th>Рынок</th><th>План</th><th>Факт</th><th>Лиды</th><th>Продажи</th><th>CR</th><th>Чек</th><th>Бюджет</th><th>CPL</th><th>Cash ROAS</th><th>Прогноз</th><th>Статус</th></tr></thead><tbody>{markets.map((market, index) => <tr key={market.market}><td>{market.market}</td><td><input className="w-28 rounded-lg border border-slate-200 px-2 py-1" type="number" value={market.targetRevenue} onChange={(event) => setMarkets((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, targetRevenue: Number(event.target.value) } : item))} /></td><td>{eur(market.revenue)}</td><td>{number(market.paidLeads + market.organicLeads)}</td><td>{number(market.sales)}</td><td>{pct(market.sales / (market.paidLeads + market.organicLeads))}</td><td>{eur(market.averagePaidCheck)}</td><td>{eur(market.adSpend)}</td><td>{eur(market.adSpend / market.paidLeads)}</td><td>{pct(market.revenue / market.adSpend)}</td><td>{eur(market.revenue / 20 * 30)}</td><td><StatusBadge status={marketStatus(market)} /></td></tr>)}</tbody></table></div>
    </section>
  );
}

function managerStatus(manager: ManagerMetrics): Status {
  if (manager.medianResponseMinutes > 10 || manager.personalRecommendationPct < 20 || manager.fullFinalPricePct < 10) return "red";
  if (manager.recipientQualificationPct < 50 || manager.visualContentPct < 50) return "orange";
  return "green";
}

function ManagersTab({ managers, daily, managerFilter }: { managers: ManagerMetrics[]; daily: DailyMetrics[]; managerFilter: string }) {
  const [status, setStatus] = useState<"all" | Status>("all");
  const plan = dailyPlan(targetScenario, daily, 20);
  const rows = managers
    .filter((manager) => managerFilter === "all" || manager.managerId === managerFilter || manager.manager === managerFilter)
    .filter((manager) => status === "all" || managerStatus(manager) === status)
    .sort((a, b) => (b.recentClientsLast10Days - a.recentClientsLast10Days) || (b.newLeads - a.newLeads));
  return (
    <section className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionHead title="Менеджеры" subtitle={`Дневной план на менеджера: ${number(plan.perManagerLeads)} лидов, ${number(plan.perManagerSales)} продаж, ${eur(plan.perManagerRevenue)}`} />
        <div className="flex gap-2">{(["all", "green", "orange", "red"] as const).map((item) => <button key={item} className={`rounded-lg border px-3 py-2 text-sm font-bold ${status === item ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white"}`} onClick={() => setStatus(item)}>{item === "all" ? "Все" : statusLabel[item]}</button>)}</div>
      </div>
      <div className="table-scroll"><table><thead><tr><th>Имя</th><th>Клиенты 10 дней</th><th>Последний клиент</th><th>Лиды месяца</th><th>Диалоги</th><th>Продажи</th><th>Выручка</th><th>CR</th><th>Чек</th><th>SLA</th><th>Квалиф.</th><th>Рекоменд.</th><th>Визуал</th><th>Полная сумма</th><th>Закрывающий вопрос</th><th>Статус</th></tr></thead><tbody>{rows.map((manager) => <tr key={manager.manager}><td><button className="font-bold text-blue-700" title="Drawer MVP: детализация будет подключена следующим шагом">{manager.manager}</button></td><td>{number(manager.recentClientsLast10Days)}</td><td>{formatDateTime(manager.lastClientAt)}</td><td>{number(manager.newLeads)}</td><td>{number(manager.meaningfulDialogs)}</td><td>{number(manager.sales)}</td><td>{eur(manager.revenue)}</td><td>{pct(manager.sales / manager.newLeads)}</td><td>{eur(manager.revenue / manager.sales)}</td><td>{manager.medianResponseMinutes} мин</td><td>{manager.recipientQualificationPct.toFixed(1)}%</td><td>{manager.personalRecommendationPct.toFixed(1)}%</td><td>{manager.visualContentPct.toFixed(1)}%</td><td>{manager.fullFinalPricePct.toFixed(1)}%</td><td>{manager.directClosingQuestionPct.toFixed(1)}%</td><td><StatusBadge status={managerStatus(manager)} /></td></tr>)}</tbody></table></div>
    </section>
  );
}

type GrowthScreen = "summary" | "forecast" | "bottleneck" | "losses" | "simulator" | "warnings" | "recommendations";

type GrowthContext = ReturnType<typeof buildGrowthContext>;

const growthScreens: Array<{ id: GrowthScreen; label: string }> = [
  { id: "summary", label: "Executive Summary" },
  { id: "forecast", label: "Forecast" },
  { id: "bottleneck", label: "Bottleneck Analyzer" },
  { id: "losses", label: "Loss Map" },
  { id: "simulator", label: "What If" },
  { id: "warnings", label: "Early Warning" },
  { id: "recommendations", label: "Recommendations" }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function averageLast(items: number[], count: number) {
  const slice = items.slice(Math.max(0, items.length - count));
  if (!slice.length) return 0;
  return slice.reduce((sum, item) => sum + item, 0) / slice.length;
}

function growthStatus(value: number): Status {
  if (value >= 0.9) return "green";
  if (value >= 0.7) return "orange";
  return "red";
}

function buildForecastSeries(current: MonthlyMetrics, daily: DailyMetrics[], monthlyPlan: MonthlyPlan, elapsedDays: number) {
  const plan = deriveMonthlyPlan(monthlyPlan);
  const actualDaily = daily.slice(0, Math.max(1, elapsedDays));
  const dayRevenue = actualDaily.map((day) => day.revenue);
  const monthRevenue = current.revenue || dayRevenue.reduce((sum, value) => sum + value, 0);
  const runRateDaily = elapsedDays > 0 ? monthRevenue / elapsedDays : 0;
  const movingAverageDaily = averageLast(dayRevenue, 7) || runRateDaily;
  const last3Daily = averageLast(dayRevenue, 3) || movingAverageDaily;
  const weightedDaily = last3Daily * 0.5 + movingAverageDaily * 0.3 + runRateDaily * 0.2;
  const runRateRevenue = runRateDaily * monthlyPlan.calendarDays;
  const movingAverageRevenue = monthRevenue + movingAverageDaily * Math.max(0, monthlyPlan.calendarDays - elapsedDays);
  const weightedRevenue = monthRevenue + weightedDaily * Math.max(0, monthlyPlan.calendarDays - elapsedDays);
  const expectedOrders = current.salesCount + (elapsedDays > 0 ? current.salesCount / elapsedDays : 0) * Math.max(0, monthlyPlan.calendarDays - elapsedDays);
  const expectedProfit = weightedRevenue * 0.52 - (current.adSpend + (elapsedDays > 0 ? current.adSpend / elapsedDays : 0) * Math.max(0, monthlyPlan.calendarDays - elapsedDays));
  const expectedRoas = weightedRevenue / Math.max(1, current.adSpend || monthlyPlan.adSpend);
  const expectedAov = weightedRevenue / Math.max(1, expectedOrders);
  const chart = Array.from({ length: monthlyPlan.calendarDays }, (_, index) => {
    const day = index + 1;
    const fact = daily[index]?.revenue ?? null;
    const cumulativeFact = daily.slice(0, day).reduce((sum, item) => sum + item.revenue, 0);
    return {
      day: String(day).padStart(2, "0"),
      fact: day <= elapsedDays ? cumulativeFact : null,
      plan: Math.round(plan.dailyRevenue * day),
      forecast: Math.round(day <= elapsedDays ? cumulativeFact : monthRevenue + weightedDaily * (day - elapsedDays))
    };
  });

  return {
    runRateRevenue,
    movingAverageRevenue,
    weightedRevenue,
    expectedOrders,
    expectedProfit,
    expectedRoas,
    expectedAov,
    chart
  };
}

function buildGrowthContext(current: MonthlyMetrics, previous: MonthlyMetrics, quality: (typeof qualityMetrics)[number], daily: DailyMetrics[], monthlyPlan: MonthlyPlan, conversationDashboard: ConversationDashboardMetrics) {
  const elapsedDays = elapsedDaysForPeriod(current.month);
  const plan = deriveMonthlyPlan(monthlyPlan);
  const leads = totalLeads(current);
  const aov = averagePaidCheck(current) || monthlyPlan.averagePaidCheck;
  const forecast = buildForecastSeries(current, daily, monthlyPlan, elapsedDays);
  const canUseConversationForForecast = conversationDashboard.sampleReliability === "reliable";
  const dialogueDrag = canUseConversationForForecast ? conversationDashboard.recommendationMissingShare * 0.07 + conversationDashboard.deliveryRiskShare * 0.05 : 0;
  const dialogueAdjustedRevenue = forecast.weightedRevenue * (1 - dialogueDrag);
  const forecastGap = dialogueAdjustedRevenue - monthlyPlan.targetRevenue;
  const probability = clamp(0.5 + (dialogueAdjustedRevenue / Math.max(1, monthlyPlan.targetRevenue) - 0.85) * 1.35 - dialogueDrag, 0.05, 0.98);
  const productionLimit = Math.max(620, Math.round(monthlyPlan.salesCount * 0.92));
  const projectedOrders = forecast.expectedOrders;
  const productionPressure = projectedOrders / productionLimit;
  const margin = (current.revenue * 0.52 - current.adSpend) / Math.max(1, current.revenue);
  const roasScore = clamp((cashRoas(current) || forecast.expectedRoas) / 8, 0, 1);
  const ctrScore = clamp((current.paidLeads / Math.max(1, monthlyPlan.paidLeads)) * 1.1, 0, 1);
  const crScore = clamp(salesConversion(current) / Math.max(0.01, monthlyPlan.salesConversion), 0, 1);
  const aovScore = clamp(aov / Math.max(1, monthlyPlan.averagePaidCheck), 0, 1);
  const marginScore = clamp(margin / 0.48, 0, 1);
  const planScore = clamp(forecast.weightedRevenue / Math.max(1, monthlyPlan.targetRevenue), 0, 1);
  const tempoScore = clamp((current.revenue / Math.max(1, monthlyPlan.targetRevenue)) / (elapsedDays / monthlyPlan.calendarDays), 0, 1);
  const dialogueScore = clamp(conversationDashboard.qualityScore / 100, 0, 1);
  const health = Math.round((roasScore * 0.14 + ctrScore * 0.09 + crScore * 0.18 + aovScore * 0.13 + marginScore * 0.12 + planScore * 0.13 + tempoScore * 0.09 + dialogueScore * 0.12) * 100);
  const process = [
    { name: "Трафик", value: Math.max(leads * 9, current.paidLeads * 12), targetRate: 1, actualRate: 1, cost: current.adSpend, targetValue: Math.max(monthlyPlan.totalLeads * 9, monthlyPlan.paidLeads * 12) },
    { name: "Клики", value: Math.max(leads * 3, current.paidLeads * 4), targetRate: 0.34, actualRate: leads > 0 ? 0.29 : 0, cost: current.adSpend, targetValue: monthlyPlan.totalLeads * 4 },
    { name: "Диалоги", value: leads, targetRate: 0.34, actualRate: leads / Math.max(1, current.paidLeads * 4), cost: current.adSpend / Math.max(1, leads), targetValue: monthlyPlan.totalLeads },
    { name: "Квалификация", value: current.qualifiedLeads, targetRate: monthlyPlan.qualifiedLeads / Math.max(1, monthlyPlan.totalLeads), actualRate: current.qualifiedLeads / Math.max(1, leads), cost: current.adSpend / Math.max(1, current.qualifiedLeads), targetValue: monthlyPlan.qualifiedLeads },
    { name: "Заказы", value: current.invoicesCount, targetRate: monthlyPlan.invoiceConversion, actualRate: current.invoicesCount / Math.max(1, leads), cost: current.adSpend / Math.max(1, current.invoicesCount), targetValue: monthlyPlan.invoicesCount },
    { name: "Оплата", value: current.salesCount, targetRate: monthlyPlan.salesConversion, actualRate: current.salesCount / Math.max(1, leads), cost: current.adSpend / Math.max(1, current.salesCount), targetValue: monthlyPlan.salesCount },
    { name: "Производство", value: Math.round(current.salesCount * 0.94), targetRate: 0.97, actualRate: 0.94, cost: 0, targetValue: Math.round(monthlyPlan.salesCount * 0.97) },
    { name: "Отправка", value: Math.round(current.salesCount * 0.9), targetRate: 0.96, actualRate: 0.9, cost: 0, targetValue: Math.round(monthlyPlan.salesCount * 0.96) },
    { name: "Доставка", value: Math.round(current.salesCount * 0.85), targetRate: 0.93, actualRate: 0.85, cost: 0, targetValue: Math.round(monthlyPlan.salesCount * 0.93) },
    { name: "Получение", value: Math.round(current.salesCount * 0.81), targetRate: 0.9, actualRate: 0.81, cost: 0, targetValue: Math.round(monthlyPlan.salesCount * 0.9) },
    { name: "Повторная покупка", value: Math.round(current.salesCount * 0.16), targetRate: 0.22, actualRate: 0.16, cost: 0, targetValue: Math.round(monthlyPlan.salesCount * 0.22) }
  ].map((stage) => {
    const missing = Math.max(0, stage.targetValue * elapsedDays / monthlyPlan.calendarDays - stage.value);
    return {
      ...stage,
      missing,
      loss: Math.round(missing * aov)
    };
  });
  const bottleneck = process.reduce((max, stage) => stage.loss > max.loss ? stage : max, process[0]);
  const losses = [
    { name: "Низкий CTR", loss: Math.round(Math.max(0, monthlyPlan.paidLeads - current.paidLeads) * 0.24 * aov), cause: "Трафик не даёт нужный объём входящих." },
    { name: "Низкий CR сайта", loss: Math.round(Math.max(0, monthlyPlan.qualifiedLeads - current.qualifiedLeads) * 0.33 * aov), cause: "Мало лидов проходит квалификацию." },
    { name: "Конверсия диалог → заказ", loss: Math.round(Math.max(0, monthlyPlan.invoicesCount - current.invoicesCount) * aov), cause: "Диалоги не доводятся до счёта." },
    { name: "Низкий средний чек", loss: Math.round(Math.max(0, monthlyPlan.averagePaidCheck - aov) * Math.max(1, current.salesCount || projectedOrders)), cause: "Апселл и комплекты недобирают деньги." },
    { name: "Проблема производства", loss: Math.round(Math.max(0, projectedOrders - productionLimit) * aov), cause: "Спрос может упереться в лимит выпуска." },
    { name: "Проблема доставки", loss: Math.round(current.salesCount * Math.max(0, 0.93 - 0.85) * aov), cause: "Часть оплат теряется после отправки." },
    { name: "Стоимость рекламы", loss: Math.round(Math.max(0, paidCpl(current) - plan.cpl) * Math.max(1, current.paidLeads)), cause: "Лид обходится дороже рабочего плана." }
  ].sort((a, b) => b.loss - a.loss);
  const warnings = [
    {
      title: "Вероятность выполнения плана ниже 80%",
      active: probability < 0.8,
      reason: `Прогноз показывает ${eur(forecast.weightedRevenue)} против плана ${eur(monthlyPlan.targetRevenue)}.`,
      effect: `Ожидаемый разрыв ${eur(Math.abs(Math.min(0, forecastGap)))}.`,
      action: "Сначала чинить самое дорогое ограничение, затем масштабировать трафик."
    },
    {
      title: "ROAS проседает относительно прошлого месяца",
      active: cashRoas(current) < cashRoas(previous) * 0.9,
      reason: `Cash ROAS сейчас ${pct(cashRoas(current))}, прошлый месяц ${pct(cashRoas(previous))}.`,
      effect: `Потери по рекламной экономике до ${eur(losses.find((item) => item.name === "Стоимость рекламы")?.loss ?? 0)}.`,
      action: "Остановить дорогие связки и перераспределить бюджет в рынки с лучшим CPL."
    },
    {
      title: "Конверсия сайта/диалога ниже цели",
      active: salesConversion(current) < monthlyPlan.salesConversion * 0.9,
      reason: `CR в продажу ${pct(salesConversion(current))}, цель ${pct(monthlyPlan.salesConversion)}.`,
      effect: `Основной денежный разрыв: ${eur(losses.find((item) => item.name === "Конверсия диалог → заказ")?.loss ?? 0)}.`,
      action: "Поднять скорость ответа, прямой вопрос об оформлении и полную сумму в первом диалоге."
    },
    {
      title: "Производство приблизится к лимиту",
      active: productionPressure > 0.92,
      reason: `Прогноз заказов ${number(projectedOrders)}, лимит выпуска ${number(productionLimit)}.`,
      effect: `Риск заморозить до ${eur(losses.find((item) => item.name === "Проблема производства")?.loss ?? 0)}.`,
      action: "Не увеличивать рекламу без подтверждённого окна производства."
    },
    {
      title: "Качество переписок ограничивает рост",
      active: quality.fullFinalPricePct < 10 || quality.directClosingQuestionPct < 20,
      reason: `Полная сумма названа в ${quality.fullFinalPricePct.toFixed(1)}% диалогов, закрывающий вопрос в ${quality.directClosingQuestionPct.toFixed(1)}%.`,
      effect: `Деньги остаются в диалогах, а не переходят в счета.`,
      action: "Дать менеджерам короткий скрипт: сумма, срок, доставка, вопрос об оформлении."
    },
    {
      title: "Растёт доля диалогов без конкретной рекомендации",
      active: canUseConversationForForecast && conversationDashboard.recommendationMissingShare > 0.35,
      reason: `Без конкретного подарка ${pct(conversationDashboard.recommendationMissingShare)} диалогов.`,
      effect: `Прогноз выручки снижен до ${eur(dialogueAdjustedRevenue)} с учётом качества переписок.`,
      action: "В каждом диалоге фиксировать один лучший подарок: повод, получатель, дата, вариант и следующий шаг."
    },
    {
      title: "Вопросы о доставке остаются без полного ответа",
      active: canUseConversationForForecast && conversationDashboard.deliveryRiskShare > 0.12,
      reason: `Риск по доставке найден в ${pct(conversationDashboard.deliveryRiskShare)} диалогов.`,
      effect: `Потенциальная потерянная выручка по перепискам: ${eur(conversationDashboard.potentialLostRevenue)}.`,
      action: "Отвечать на доставку полным блоком: цена, срок, страна/город, дата отправки и финальная сумма."
    }
  ].filter((warning) => warning.active);
  const recommendations = [
    {
      title: `Повысить средний чек на 5 €`,
      effect: Math.round(Math.max(current.salesCount, projectedOrders) * 5),
      why: "Это даёт деньги без роста нагрузки на маркетинг и производство.",
      days: "2-4 дня",
      priority: 5
    },
    {
      title: `Поднять конверсию диалог → заказ на 0.8 п.п.`,
      effect: Math.round(leads * 0.008 * aov + conversationDashboard.potentialLostRevenue * 0.12),
      why: "Самый быстрый рычаг в текущей воронке, особенно если в диалогах нет конкретного подарка.",
      days: "3-5 дней",
      priority: bottleneck.name === "Заказы" || bottleneck.name === "Оплата" ? 5 : 4
    },
    {
      title: "Закрыть пробелы в ответах про доставку",
      effect: Math.round(conversationDashboard.potentialLostRevenue * conversationDashboard.deliveryRiskShare),
      why: "Вопросы про доставку без полного ответа повышают риск потери заказа.",
      days: "1-2 дня",
      priority: conversationDashboard.deliveryRiskShare > 0.12 ? 5 : 3
    },
    {
      title: "Ускорить ответы в чате",
      effect: Math.round(quality.meaningfulDialogs * 0.035 * aov),
      why: "SLA напрямую влияет на переход из диалога в счёт.",
      days: "1-3 дня",
      priority: quality.medianResponseMinutes > 10 ? 4 : 3
    },
    {
      title: "Перераспределить бюджет в рынки с лучшим CPL",
      effect: Math.round(Math.max(0, plan.cpl - paidCpl(current)) * -current.paidLeads + monthlyPlan.adSpend * 0.18),
      why: "Рост бюджета имеет смысл только после проверки экономики лида.",
      days: "2 дня",
      priority: paidCpl(current) > plan.cpl ? 4 : 3
    },
    {
      title: "Подтвердить производственный запас перед масштабированием",
      effect: Math.round(Math.max(0, projectedOrders - productionLimit) * aov),
      why: "Иначе реклама создаст очередь, а не выручку.",
      days: "сегодня",
      priority: productionPressure > 0.92 ? 5 : 3
    }
  ].map((item) => ({ ...item, effect: Math.max(0, item.effect) })).sort((a, b) => b.priority - a.priority || b.effect - a.effect).slice(0, 5);

  return { elapsedDays, plan, leads, aov, forecast, forecastGap, probability, health, process, bottleneck, losses, warnings, recommendations, productionLimit, projectedOrders, dialogueAdjustedRevenue, conversationDashboard, canUseConversationForForecast };
}

function GrowthMetricCard({ title, children, status }: { title: string; children: ReactNode; status?: Status }) {
  return (
    <article className="card min-h-44 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-sm font-bold text-slate-500">{title}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      {children}
    </article>
  );
}

function ProbabilityGauge({ value }: { value: number }) {
  const status = growthStatus(value);
  const color = status === "green" ? "#15803d" : status === "orange" ? "#b7791f" : "#c2413a";
  return (
    <div className="flex items-center gap-4">
      <div className="h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={[{ value }, { value: 1 - value }]} dataKey="value" innerRadius={38} outerRadius={52} startAngle={90} endAngle={-270}>
              <Cell fill={color} />
              <Cell fill="#edf1f5" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div>
        <strong className="block text-4xl leading-none text-slate-950">{pct(value)}</strong>
        <span className="text-sm text-slate-500">пересчёт по темпу, CR и прогнозу</span>
      </div>
    </div>
  );
}

function ExecutiveSummary({ context, monthlyPlan }: { context: GrowthContext; monthlyPlan: MonthlyPlan }) {
  const bestAction = context.recommendations[0];
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-4">
        <GrowthMetricCard title="План месяца" status={growthStatus(context.dialogueAdjustedRevenue / Math.max(1, monthlyPlan.targetRevenue))}>
          <div className="grid gap-2">
            <strong className="text-4xl leading-none">{eur(monthlyPlan.targetRevenue)}</strong>
            <span className="text-sm text-slate-500">Факт <b className="text-slate-950">{eur(context.forecast.chart[context.elapsedDays - 1]?.fact ?? 0)}</b></span>
            <span className="text-sm text-slate-500">Прогноз с качеством диалогов <b className="text-slate-950">{eur(context.dialogueAdjustedRevenue)}</b></span>
            <span className={`text-lg font-black ${context.forecastGap >= 0 ? "text-emerald-700" : "text-red-700"}`}>{context.forecastGap >= 0 ? "+" : ""}{pct(context.forecastGap / Math.max(1, monthlyPlan.targetRevenue))}</span>
          </div>
        </GrowthMetricCard>
        <GrowthMetricCard title="Вероятность выполнения плана" status={growthStatus(context.probability)}>
          <ProbabilityGauge value={context.probability} />
        </GrowthMetricCard>
        <GrowthMetricCard title="Главное ограничение" status="red">
          <strong className="block text-2xl leading-tight">{context.bottleneck.name}</strong>
          <p className="mt-3 text-sm text-slate-500">Оценка потерь</p>
          <b className="text-3xl text-red-700">≈ {eur(context.bottleneck.loss)}/месяц</b>
        </GrowthMetricCard>
        <GrowthMetricCard title="Лучшее действие сегодня" status={bestAction.priority >= 5 ? "green" : "orange"}>
          <p className="text-lg font-black leading-7">{bestAction.title}</p>
          <p className="mt-3 text-sm leading-5 text-slate-600">{bestAction.why}</p>
          <p className="mt-3 text-sm font-bold text-emerald-700">Эффект: +{eur(bestAction.effect)} · {bestAction.days}</p>
        </GrowthMetricCard>
      </div>
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Health Score</h2>
            <p className="text-sm text-slate-500">ROAS, CTR, CR, AOV, маржа, выполнение плана и темп роста</p>
          </div>
          <strong className="text-5xl leading-none">{context.health}/100</strong>
        </div>
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {[
            ["ROAS", cashRoas({ ...monthlyMetrics[0], revenue: context.forecast.weightedRevenue, adSpend: Math.max(1, monthlyPlan.adSpend) }) / 8],
            ["CTR", context.leads / Math.max(1, monthlyPlan.totalLeads)],
            ["CR", context.process[5].actualRate / Math.max(0.01, monthlyPlan.salesConversion)],
            ["AOV", context.aov / Math.max(1, monthlyPlan.averagePaidCheck)],
            ["Маржа", 0.82],
            ["План", context.dialogueAdjustedRevenue / Math.max(1, monthlyPlan.targetRevenue)],
            ["Темп", context.forecast.runRateRevenue / Math.max(1, monthlyPlan.targetRevenue)],
            ["Диалоги", context.conversationDashboard.qualityScore / 100]
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
              <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${clamp(Number(value), 0, 1) * 100}%` }} />
              </div>
              <b className="mt-2 block text-sm">{pct(clamp(Number(value), 0, 1))}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ForecastScreen({ context }: { context: GrowthContext }) {
  return (
    <div className="grid gap-4">
      <section className="card p-5">
        <SectionHead title="Forecast" subtitle="Три независимые модели: Run Rate, Moving Average и Weighted Forecast" />
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={context.forecast.chart}>
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="fact" name="Факт" stroke="#0f172a" strokeWidth={3} dot={false} connectNulls />
              <Line dataKey="plan" name="План" stroke="#c2413a" strokeDasharray="5 5" dot={false} />
              <Area dataKey="forecast" name="Прогноз" fill="#dbeafe" stroke="#2563eb" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard title="Run Rate" value={eur(context.forecast.runRateRevenue)} hint="Текущий темп месяца" formula="fact / elapsedDays × days" />
        <MetricCard title="Moving Average" value={eur(context.forecast.movingAverageRevenue)} hint="Среднее последних 7 дней" formula="fact + avg7 × remainingDays" />
        <MetricCard title="Weighted Forecast" value={eur(context.forecast.weightedRevenue)} hint="3 дня 50%, 7 дней 30%, месяц 20%" formula="weighted daily forecast" />
        <MetricCard title="Ожидаемые заказы" value={number(context.forecast.expectedOrders)} hint={`AOV ${eur(context.forecast.expectedAov)}`} formula="orders run rate" />
        <MetricCard title="Ожидаемая прибыль" value={eur(context.forecast.expectedProfit)} hint={`ROAS ${pct(context.forecast.expectedRoas)}`} formula="revenue × margin - spend" />
      </div>
    </div>
  );
}

function BottleneckScreen({ context }: { context: GrowthContext }) {
  return (
    <section className="card p-5">
      <SectionHead title="Bottleneck Analyzer" subtitle={`Главное ограничение системы: ${context.bottleneck.name}`} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {context.process.map((stage, index) => (
          <article key={stage.name} className={`rounded-xl border p-4 ${stage.name === context.bottleneck.name ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase text-slate-500">Этап {index + 1}</span>
                <h3 className="text-lg font-black">{stage.name}</h3>
              </div>
              {stage.name === context.bottleneck.name ? <AlertTriangle className="text-red-600" size={20} /> : <Activity className="text-blue-600" size={20} />}
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Количество</span><b>{number(stage.value)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Конверсия</span><b>{pct(stage.actualRate)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Цель</span><b>{pct(stage.targetRate)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Стоимость</span><b>{stage.cost ? eur(stage.cost) : "—"}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Потери</span><b>{number(stage.missing)} · {eur(stage.loss)}</b></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LossMapScreen({ context }: { context: GrowthContext }) {
  return (
    <section className="card p-5">
      <SectionHead title="Loss Map" subtitle="Самая дорогая проблема всегда сверху" />
      <div className="grid gap-3">
        {context.losses.map((loss, index) => (
          <div key={loss.name} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[44px_1fr_180px] md:items-center">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-sm font-black">{index + 1}</span>
            <div>
              <h3 className="font-black">{loss.name}</h3>
              <p className="text-sm text-slate-500">{loss.cause}</p>
            </div>
            <strong className="text-2xl text-red-700">− {eur(loss.loss)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SimulatorScreen({ current, monthlyPlan }: { current: MonthlyMetrics; monthlyPlan: MonthlyPlan }) {
  const [budget, setBudget] = useState(monthlyPlan.adSpend);
  const [ctr, setCtr] = useState(100);
  const [cpc, setCpc] = useState(2.1);
  const [dialogCost, setDialogCost] = useState(3.2);
  const [qualificationCost, setQualificationCost] = useState(4.7);
  const [siteCr, setSiteCr] = useState(monthlyPlan.invoiceConversion * 100);
  const [dialogCr, setDialogCr] = useState(monthlyPlan.salesConversion * 100);
  const [check, setCheck] = useState(monthlyPlan.averagePaidCheck);
  const [upsell, setUpsell] = useState(4);
  const [repeat, setRepeat] = useState(14);
  const [cost, setCost] = useState(48);
  const [production, setProduction] = useState(720);
  const before = {
    leads: totalLeads(current),
    orders: current.salesCount,
    revenue: current.revenue,
    profit: current.revenue * 0.52 - current.adSpend,
    roas: cashRoas(current),
    margin: (current.revenue * 0.52 - current.adSpend) / Math.max(1, current.revenue)
  };
  const paidTraffic = Math.max(1, budget / Math.max(0.1, cpc));
  const leads = Math.round(paidTraffic * (ctr / 100) / Math.max(1, dialogCost / 3.2));
  const qualified = Math.round(leads * clamp(qualificationCost > 0 ? 4.7 / qualificationCost : 1, 0.3, 1.6) * 0.72);
  const orders = Math.min(production, Math.round(qualified * (siteCr / 100) * (dialogCr / Math.max(1, monthlyPlan.salesConversion * 100))));
  const revenue = Math.round(orders * (check + upsell) * (1 + repeat / 100));
  const profit = Math.round(revenue * (1 - cost / 100) - budget);
  const after = { leads, orders, revenue, profit, roas: revenue / Math.max(1, budget), margin: profit / Math.max(1, revenue) };
  const controls = [
    ["Рекламный бюджет", budget, setBudget, 1000, 18000, "€"],
    ["CTR индекс", ctr, setCtr, 60, 160, "%"],
    ["Стоимость клика", cpc, setCpc, 0.8, 5, "€"],
    ["Стоимость диалога", dialogCost, setDialogCost, 1, 8, "€"],
    ["Стоимость квалификации", qualificationCost, setQualificationCost, 2, 10, "€"],
    ["Конверсия сайта", siteCr, setSiteCr, 8, 40, "%"],
    ["Конверсия диалог → заказ", dialogCr, setDialogCr, 8, 40, "%"],
    ["Средний чек", check, setCheck, 50, 120, "€"],
    ["Апселл", upsell, setUpsell, 0, 20, "€"],
    ["Повторные покупки", repeat, setRepeat, 0, 35, "%"],
    ["Себестоимость", cost, setCost, 30, 70, "%"],
    ["Производительность", production, setProduction, 300, 1200, ""]
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <section className="card p-5">
        <SectionHead title="What If Simulator" subtitle="Любое изменение мгновенно пересчитывает деньги, заказы и вероятность плана" />
        <div className="grid gap-4 md:grid-cols-2">
          {controls.map(([label, value, setter, min, max, suffix]) => (
            <label key={label} className="grid gap-2 text-sm font-bold text-slate-600">
              <span className="flex justify-between gap-3"><span>{label}</span><b>{number(value, String(value).includes(".") ? 1 : 0)}{suffix}</b></span>
              <input type="range" min={min} max={max} step={String(value).includes(".") ? 0.1 : 1} value={value} onChange={(event) => setter(Number(event.target.value))} />
            </label>
          ))}
        </div>
      </section>
      <aside className="card p-5">
        <SectionHead title="До / После" subtitle="Финансовый эффект сценария" />
        <div className="grid gap-3">
          {[
            ["Выручка", eur(before.revenue), eur(after.revenue), after.revenue - before.revenue],
            ["Прибыль", eur(before.profit), eur(after.profit), after.profit - before.profit],
            ["ROAS", pct(before.roas), pct(after.roas), after.roas - before.roas],
            ["ROMI", pct(before.profit / Math.max(1, current.adSpend)), pct(after.profit / Math.max(1, budget)), after.profit / Math.max(1, budget) - before.profit / Math.max(1, current.adSpend)],
            ["Заказы", number(before.orders), number(after.orders), after.orders - before.orders],
            ["Маржа", pct(before.margin), pct(after.margin), after.margin - before.margin],
            ["Вероятность плана", pct(before.revenue / Math.max(1, monthlyPlan.targetRevenue)), pct(after.revenue / Math.max(1, monthlyPlan.targetRevenue)), after.revenue / Math.max(1, monthlyPlan.targetRevenue) - before.revenue / Math.max(1, monthlyPlan.targetRevenue)]
          ].map(([label, prev, next, diff]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><b className={Number(diff) >= 0 ? "text-emerald-700" : "text-red-700"}>{Number(diff) >= 0 ? "+" : ""}{String(label).includes("ROAS") || String(label).includes("Маржа") || String(label).includes("Вероятность") || String(label).includes("ROMI") ? pp(Number(diff)) : String(label).includes("Заказы") ? number(Number(diff)) : eur(Number(diff))}</b></div>
              <div className="mt-1 text-sm font-bold">{prev} → {next}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function EarlyWarningScreen({ context }: { context: GrowthContext }) {
  return (
    <section className="card p-5">
      <SectionHead title="Early Warning System" subtitle="Система предупреждает до конца месяца" />
      <div className="grid gap-3">
        {(context.warnings.length ? context.warnings : [{ title: "Критичных предупреждений нет", reason: "Текущий темп не показывает резкого ухудшения.", effect: "Следить за ограничением и прогнозом.", action: "Продолжать ежедневный пересчёт после обновления данных." }]).map((warning) => (
          <article key={warning.title} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3 flex items-center gap-2"><AlertTriangle className="text-amber-700" size={20} /><h3 className="font-black">{warning.title}</h3></div>
            <div className="grid gap-2 text-sm leading-5 md:grid-cols-4">
              <p><b>Причина:</b><br />{warning.reason}</p>
              <p><b>Последствия:</b><br />{warning.effect}</p>
              <p><b>Потери:</b><br />{context.losses[0] ? eur(context.losses[0].loss) : "—"}</p>
              <p><b>Что сделать:</b><br />{warning.action}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecommendationsScreen({ context }: { context: GrowthContext }) {
  return (
    <section className="card p-5">
      <SectionHead title="Growth Recommendations" subtitle="Не больше пяти действий, отсортированы по приоритету и финансовому эффекту" />
      <div className="grid gap-3">
        {context.recommendations.map((item) => (
          <article key={item.title} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[160px_1fr_180px] md:items-center">
            <div>
              <div className="text-lg text-amber-500">{"★".repeat(item.priority)}{"☆".repeat(5 - item.priority)}</div>
              <span className="text-xs font-bold uppercase text-slate-500">Приоритет</span>
            </div>
            <div>
              <h3 className="text-lg font-black">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.why}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">Эффект проявится: {item.days}</p>
            </div>
            <strong className="text-2xl text-emerald-700">+{eur(item.effect)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function GrowthIntelligenceTab({ current, previous, quality, daily, monthlyPlan, conversationDashboard }: { current: MonthlyMetrics; previous: MonthlyMetrics; quality: (typeof qualityMetrics)[number]; daily: DailyMetrics[]; monthlyPlan: MonthlyPlan; conversationDashboard: ConversationDashboardMetrics }) {
  const [screen, setScreen] = useState<GrowthScreen>("summary");
  const context = useMemo(() => buildGrowthContext(current, previous, quality, daily, monthlyPlan, conversationDashboard), [current, previous, quality, daily, monthlyPlan, conversationDashboard]);

  return (
    <div className="grid gap-4">
      <section className="card overflow-hidden p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-sm font-extrabold uppercase text-blue-600">Система поддержки решений</p>
            <h2 className="text-3xl font-black">Growth Intelligence</h2>
          </div>
          <div className="grid gap-2 text-sm font-bold text-slate-600 md:grid-cols-4">
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><Target size={16} />План: {eur(monthlyPlan.targetRevenue)}</span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><Activity size={16} />Прогноз: {eur(context.dialogueAdjustedRevenue)}</span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><Brain size={16} />Health: {context.health}/100</span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><Zap size={16} />Рычаг: {context.bottleneck.name}</span>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {growthScreens.map((item) => (
            <button key={item.id} className={`min-h-10 shrink-0 rounded-lg border px-3 text-sm font-bold ${screen === item.id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`} onClick={() => setScreen(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>
      {screen === "summary" ? <ExecutiveSummary context={context} monthlyPlan={monthlyPlan} /> : null}
      {screen === "forecast" ? <ForecastScreen context={context} /> : null}
      {screen === "bottleneck" ? <BottleneckScreen context={context} /> : null}
      {screen === "losses" ? <LossMapScreen context={context} /> : null}
      {screen === "simulator" ? <SimulatorScreen current={current} monthlyPlan={monthlyPlan} /> : null}
      {screen === "warnings" ? <EarlyWarningScreen context={context} /> : null}
      {screen === "recommendations" ? <RecommendationsScreen context={context} /> : null}
    </div>
  );
}

type SyncStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

type GoogleSyncPayload = {
  daily: DailyMetrics[];
  summary: {
    rowsLoaded: number;
    sourcesLoaded?: string[];
    paidLeads: number;
    organicLeads: number;
    ql: number;
    spend: number;
    averageCpl: number;
    dataSource: "snapshot" | "live";
    snapshotUpdatedAt: string | null;
    snapshotPath: string;
  };
};

type BitrixSyncPayload = {
  monthly: MonthlyMetrics;
  daily: DailyMetrics[];
  managers: ManagerMetrics[];
  invoiceCountries: CountryInvoiceMetrics[];
  invoiceManagers: ManagerInvoiceMetrics[];
  invoiceProducts: ProductInvoiceMetrics[];
  countryOptions?: string[];
  productOptions?: string[];
  summary: {
    leadsLoaded: number;
    recentClientsLoaded: number;
    dealsLoaded: number;
    usersLoaded: number;
    periodStart: string;
    periodEnd: string;
    dataSource: "snapshot" | "live";
    snapshotUpdatedAt: string | null;
    snapshotPath: string;
  };
};

type ConversationImportPayload = {
  dashboard: ConversationDashboardMetrics;
  diagnostics?: ConversationImportFileDiagnostic[];
  sourcePaths?: string[];
  summary: {
    filesLoaded: number;
    messagesLoaded: number;
    dialogsLoaded: number;
    filesParsed?: number;
    filesFailed?: number;
  };
  error?: string;
};

type ConversationHistoryItem = {
  importedDay: string;
  importedAt: string;
  source: "manual" | "gift-ai" | "bitrix";
  label: string;
  dialogs: number;
  conversion: number;
  qualityScore: number;
  potentialLostRevenue: number;
};

type ConversationHistoryPayload = {
  latest?: {
    importedAt: string;
    importedDay: string;
    label: string;
    source: "manual" | "gift-ai" | "bitrix";
    dashboard: ConversationDashboardMetrics;
  } | null;
  history?: ConversationHistoryItem[];
  error?: string;
};

type BitrixConversationSyncPayload = {
  source: "bitrix";
  importedAt: string;
  dashboard: ConversationDashboardMetrics;
  diagnostics?: ConversationImportFileDiagnostic[];
  summary: {
    dialogsScanned: number;
    dialogsImported: number;
    messagesLoaded: number;
    daysBack: number;
    lookbackSince: string;
    filesLoaded: number;
    dialogsLoaded: number;
  };
  error?: string;
};

type GeminiConversationPayload = {
  summary: GeminiConversationSummary;
  sourcePaths?: string[];
  error?: string;
};

function DataTab({
  googleStatus,
  bitrixStatus,
  syncGoogleTraffic,
  syncBitrix,
  onConversationImport,
  setActiveTab
}: {
  googleStatus: SyncStatus;
  bitrixStatus: SyncStatus;
  syncGoogleTraffic: (options?: { refresh?: boolean }) => Promise<void>;
  syncBitrix: (options?: { refresh?: boolean }) => Promise<boolean>;
  onConversationImport: (dashboard: ConversationDashboardMetrics) => void;
  setActiveTab: (tab: string) => void;
}) {
  const [conversationStatus, setConversationStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Переписки ещё не загружались."
  });
  const [conversationFiles, setConversationFiles] = useState<File[]>([]);
  const [conversationText, setConversationText] = useState("");
  const [lastConversationImport, setLastConversationImport] = useState<ConversationDashboardMetrics | null>(null);
  const [conversationDiagnostics, setConversationDiagnostics] = useState<ConversationImportFileDiagnostic[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryItem[]>([]);
  const [bitrixConversationStatus, setBitrixConversationStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Автоматический импорт Bitrix ещё не запускался."
  });

  useEffect(() => {
    let cancelled = false;

    async function loadConversationHistory() {
      try {
        const response = await fetch("/api/conversations/history?limit=7");
        const data = await response.json() as ConversationHistoryPayload;
        if (!response.ok || cancelled) return;
        setConversationHistory(data.history ?? []);
        if (data.latest?.dashboard) {
          setLastConversationImport(data.latest.dashboard);
          setConversationStatus({
            state: "ok",
            message: `Последний сохранённый анализ: ${data.latest.label.toLowerCase()} от ${new Date(data.latest.importedAt).toLocaleString("ru-RU")}.`
          });
        }
      } catch {
        // Нет истории — просто оставляем ручной импорт доступным.
      }
    }

    void loadConversationHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const importConversations = useCallback(async () => {
    if (!conversationFiles.length && !conversationText.trim()) {
      setConversationStatus({ state: "error", message: "Выберите файл или вставьте текст переписки." });
      return;
    }
    setConversationStatus({ state: "loading", message: "Разбираю переписки и считаю факторы..." });
    try {
      const formData = new FormData();
      conversationFiles.forEach((file) => formData.append("files", file));
      if (conversationText.trim()) {
        formData.append("files", new File([conversationText], "manual-chat.txt", { type: "text/plain" }));
      }
      const response = await fetch("/api/conversations/import", { method: "POST", body: formData });
      const data = await response.json() as ConversationImportPayload;
      setConversationDiagnostics(data.diagnostics ?? []);
      if (!response.ok) throw new Error(data.error || "Не удалось импортировать переписки");
      onConversationImport(data.dashboard);
      setLastConversationImport(data.dashboard);
      const averageMessagesPerDialog = data.summary.messagesLoaded / Math.max(1, data.summary.dialogsLoaded);
      const groupingWarning = data.summary.messagesLoaded > 100 && averageMessagesPerDialog < 3
        ? ` Внимание: в среднем ${averageMessagesPerDialog.toFixed(1)} сообщения на диалог, группировка выглядит слишком дробной.`
        : "";
      setConversationStatus({
        state: "ok",
        message: `Загружено файлов: ${number(data.summary.filesLoaded)}, сообщений: ${number(data.summary.messagesLoaded)}, диалогов: ${number(data.summary.dialogsLoaded)}.${groupingWarning}`
      });
      setConversationHistory((items) => {
        const importedAt = new Date().toISOString();
        const nextItem: ConversationHistoryItem = {
          importedDay: importedAt.slice(0, 10),
          importedAt,
          source: "manual",
          label: "Ручной импорт переписок",
          dialogs: data.dashboard.totalDialogs,
          conversion: data.dashboard.orderConversion,
          qualityScore: data.dashboard.qualityScore,
          potentialLostRevenue: data.dashboard.potentialLostRevenue
        };
        return [nextItem, ...items].slice(0, 7);
      });
    } catch (error) {
      setConversationStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось импортировать переписки"
      });
    }
  }, [conversationFiles, conversationText, onConversationImport]);

  const importBitrixConversations = useCallback(async () => {
    setBitrixConversationStatus({ state: "loading", message: "Забираю свежие переписки из Bitrix..." });
    try {
      const response = await fetch("/api/conversations/sync-bitrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ daysBack: 1, dialogLimit: 80 })
      });
      const data = await response.json() as BitrixConversationSyncPayload;
      setConversationDiagnostics(data.diagnostics ?? []);
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить переписки из Bitrix");
      onConversationImport(data.dashboard);
      setLastConversationImport(data.dashboard);
      setConversationHistory((items) => {
        const nextItem: ConversationHistoryItem = {
          importedDay: data.importedAt.slice(0, 10),
          importedAt: data.importedAt,
          source: "bitrix",
          label: "Bitrix daily sync",
          dialogs: data.dashboard.totalDialogs,
          conversion: data.dashboard.orderConversion,
          qualityScore: data.dashboard.qualityScore,
          potentialLostRevenue: data.dashboard.potentialLostRevenue
        };
        return [nextItem, ...items].slice(0, 7);
      });
      setBitrixConversationStatus({
        state: "ok",
        message: `Bitrix: просмотрено ${number(data.summary.dialogsScanned)} чатов, загружено ${number(data.summary.dialogsLoaded)} диалогов и ${number(data.summary.messagesLoaded)} сообщений.`
      });
    } catch (error) {
      setBitrixConversationStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить переписки из Bitrix"
      });
    }
  }, [onConversationImport]);

  return (
    <section className="card p-4">
      <SectionHead title="Данные и настройки" subtitle="Приватные подключения к Google Sheets и CRM" />
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Bitrix24: продажи и счета</h3>
            <p className="text-sm text-slate-500">Закрытые месяцы читаются из локального snapshot. Текущий месяц обновляется автоматически один раз в день при первом открытии дашборда, а кнопка ниже запускает внеочередное обновление.</p>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60" onClick={() => void syncBitrix({ refresh: true })} disabled={bitrixStatus.state === "loading"}>
            {bitrixStatus.state === "loading" ? "Обновляю..." : "Обновить snapshot Bitrix"}
          </button>
        </div>
        <p className={`mt-3 text-sm font-semibold ${bitrixStatus.state === "error" ? "text-red-700" : bitrixStatus.state === "ok" ? "text-emerald-700" : "text-slate-500"}`}>
          {bitrixStatus.message}
        </p>
      </div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Google Sheets: Facebook-трафик</h3>
            <p className="text-sm text-slate-500">Закрытые месяцы читаются из локального snapshot. Текущий месяц обновляется автоматически один раз в день при первом открытии дашборда, а кнопка ниже запускает внеочередное обновление. Читает приватные таблицы подрядчиков через service account: лиды, QL, бюджет, CPL, каналы и рынки.</p>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60" onClick={() => void syncGoogleTraffic({ refresh: true })} disabled={googleStatus.state === "loading"}>
            {googleStatus.state === "loading" ? "Обновляю..." : "Обновить snapshot Google"}
          </button>
        </div>
        <p className={`mt-3 text-sm font-semibold ${googleStatus.state === "error" ? "text-red-700" : googleStatus.state === "ok" ? "text-emerald-700" : "text-slate-500"}`}>
          {googleStatus.message}
        </p>
      </div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Анализ клиентских переписок</h3>
            <p className="text-sm text-slate-500">Bitrix можно забирать ежедневно автоматически. Для ручного добора остаются csv, json, txt и базовый PDF fallback.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-60" onClick={importBitrixConversations} disabled={bitrixConversationStatus.state === "loading"}>
              {bitrixConversationStatus.state === "loading" ? "Загружаю Bitrix..." : "Забрать из Bitrix"}
            </button>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60" onClick={importConversations} disabled={conversationStatus.state === "loading"}>
              {conversationStatus.state === "loading" ? "Импортирую..." : "Импортировать файлы"}
            </button>
          </div>
        </div>
        <input
          multiple
          type="file"
          accept=".txt,.csv,.json,.pdf"
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
          onChange={(event) => setConversationFiles(Array.from(event.target.files ?? []))}
        />
        <textarea
          className="mt-3 min-h-40 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-950 outline-none"
          placeholder={`Или вставьте переписку сюда:
2026-07-02 10:12 Клиент: Сколько стоит доставка?
2026-07-02 10:15 Менеджер Анна: Итого 86 евро с доставкой, отправим завтра.`}
          value={conversationText}
          onChange={(event) => setConversationText(event.target.value)}
        />
        <p className={`mt-3 text-sm font-semibold ${conversationStatus.state === "error" ? "text-red-700" : conversationStatus.state === "ok" ? "text-emerald-700" : "text-slate-500"}`}>
          {conversationStatus.message}
        </p>
        <p className={`mt-1 text-sm font-semibold ${bitrixConversationStatus.state === "error" ? "text-red-700" : bitrixConversationStatus.state === "ok" ? "text-emerald-700" : "text-slate-500"}`}>
          {bitrixConversationStatus.message}
        </p>
        {conversationHistory.length ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">Последние сохранённые срезы переписок</div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Когда</th><th>Источник</th><th>Диалоги</th><th>CR</th><th>Quality</th><th>Потери</th></tr></thead>
                <tbody>
                  {conversationHistory.map((item) => (
                    <tr key={`${item.importedAt}-${item.source}`}>
                      <td>{new Date(item.importedAt).toLocaleString("ru-RU")}</td>
                      <td>{item.label}</td>
                      <td>{number(item.dialogs)}</td>
                      <td>{pct(item.conversion)}</td>
                      <td>{number(item.qualityScore)}/100</td>
                      <td>{eur(item.potentialLostRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {conversationDiagnostics.length ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">Что реально прочиталось из файлов</div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Файл</th><th>Статус</th><th>Сообщения</th><th>Диалоги</th><th>Комментарий</th></tr></thead>
                <tbody>
                  {conversationDiagnostics.map((item) => (
                    <tr key={item.filename}>
                      <td>{item.filename}</td>
                      <td><span className={item.status === "ok" ? "text-emerald-700" : "text-red-700"}>{item.status === "ok" ? "Прочитан" : "Ошибка"}</span></td>
                      <td>{number(item.messages)}</td>
                      <td>{number(item.dialogs)}</td>
                      <td>{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {lastConversationImport ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <span className="text-xs font-bold uppercase text-emerald-700">Диалоги</span>
                <strong className="mt-1 block text-2xl text-slate-950">{number(lastConversationImport.totalDialogs)}</strong>
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-emerald-700">CR в заказ</span>
                <strong className="mt-1 block text-2xl text-slate-950">{pct(lastConversationImport.orderConversion)}</strong>
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-emerald-700">Quality Score</span>
                <strong className="mt-1 block text-2xl text-slate-950">{number(lastConversationImport.qualityScore)}/100</strong>
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-emerald-700">Потерянная выручка</span>
                <strong className="mt-1 block text-2xl text-slate-950">{eur(lastConversationImport.potentialLostRevenue)}</strong>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setActiveTab("Качество переписок")}>
                Смотреть интерпретацию
              </button>
              <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700" onClick={() => setActiveTab("Growth Intelligence")}>
                Смотреть влияние на план
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {["Месячные финансовые показатели", "Дневные показатели", "Рынки", "Менеджеры"].map((name) => (
          <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2"><Download size={18} /><b>{name}</b></div>
            <input type="file" accept=".csv" className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm" />
            <p className="mt-3 text-sm text-slate-500">Предпросмотр, сопоставление колонок и ошибки Zod-валидации подготовлены как следующий слой подключения.</p>
          </div>
        ))}
      </div>
      <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Download size={16} />Скачать шаблон таблицы</button>
    </section>
  );
}

function DetailNavigation({ activeTab, setActiveTab, compact = false }: { activeTab: string; setActiveTab: (tab: string) => void; compact?: boolean }) {
  const detailTabs = tabs.filter((tab) => tab !== "Обзор");

  if (compact) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="min-h-10 rounded-lg border border-blue-600 bg-blue-50 px-4 text-sm font-bold text-blue-700" onClick={() => setActiveTab("Обзор")}>
          ← Обзор
        </button>
        <select className="h-10 min-w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
          {detailTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </div>
    );
  }

  return (
    <section className="card mt-4 p-4">
      <SectionHead title="Детализация" subtitle="Разделы для анализа, когда нужно провалиться глубже" />
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
        {detailTabs.map((tab) => (
          <button key={tab} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50" onClick={() => setActiveTab(tab)}>
            <SlidersHorizontal size={15} />
            {tab}
          </button>
        ))}
      </div>
    </section>
  );
}

function mergeMonthly(items: MonthlyMetrics[], next: MonthlyMetrics) {
  return items.map((item) => item.month === next.month ? next : item);
}

function mergeDailyByDate(base: DailyMetrics[], incoming: DailyMetrics[], merge: (base: DailyMetrics, incoming: DailyMetrics) => DailyMetrics) {
  const byDate = new Map(base.map((item) => [item.date, item]));
  for (const row of incoming) {
    byDate.set(row.date, merge(byDate.get(row.date) ?? row, row));
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function clearMonthlyFacts(item: MonthlyMetrics): MonthlyMetrics {
  return {
    ...item,
    paidLeads: 0,
    organicLeads: 0,
    qualifiedLeads: 0,
    invoicesCount: 0,
    invoicesAmount: 0,
    cancelledInvoicesCount: 0,
    cancelledInvoicesAmount: 0,
    salesCount: 0,
    revenue: 0,
    adSpend: 0,
    paidSalesCount: null
  };
}

function clearDailyFacts(item: DailyMetrics): DailyMetrics {
  return {
    ...item,
    paidLeads: 0,
    organicLeads: 0,
    qualifiedLeads: 0,
    paidQualifiedLeads: 0,
    organicQualifiedLeads: 0,
    invoicesCount: 0,
    invoicesAmount: 0,
    salesCount: 0,
    revenue: 0,
    adSpend: 0,
    averagePaidCheck: 0,
    activeManagers: 0
  };
}

export function DashboardApp({
  mode = "analytics",
  initialTab
}: {
  mode?: DashboardMode;
  initialTab?: string;
} = {}) {
  const [activeTab, setActiveTab] = useState(initialTab && tabs.includes(initialTab) ? initialTab : tabs[0]);
  const [period, setPeriod] = useState("july-2026");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [countryOptions, setCountryOptions] = useState(defaultCountryOptions);
  const [managerFilter, setManagerFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan>(defaultMonthlyPlan);
  const [liveMonthly, setLiveMonthly] = useState<MonthlyMetrics[]>(monthlyMetrics);
  const [liveDaily, setLiveDaily] = useState<DailyMetrics[]>(dailyMetrics);
  const [liveManagers, setLiveManagers] = useState<ManagerMetrics[]>(managerMetrics);
  const [liveInvoiceCountries, setLiveInvoiceCountries] = useState<CountryInvoiceMetrics[]>([]);
  const [liveInvoiceManagers, setLiveInvoiceManagers] = useState<ManagerInvoiceMetrics[]>([]);
  const [liveInvoiceProducts, setLiveInvoiceProducts] = useState<ProductInvoiceMetrics[]>([]);
  const [conversationDashboard, setConversationDashboard] = useState<ConversationDashboardMetrics>(conversationIntelligenceDemo.dashboard);
  const [syncStatus, setSyncStatus] = useState("Факты ещё не загружены");
  const [googleStatus, setGoogleStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Google Sheets ещё не проверялась."
  });
  const [bitrixStatus, setBitrixStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Bitrix ещё не синхронизировался."
  });
  const bitrixRequestId = useRef(0);
  const lastGooglePeriod = useRef<string | null>(null);
  const conversationImportLoaded = useRef(false);
  const rawCurrent = liveMonthly.find((item) => item.month === period) ?? liveMonthly[2];
  const rawCurrentDaily = liveDaily.filter((item) => item.date.startsWith(monthPrefixForPeriod(rawCurrent.month)));
  const currentDaily = filterDailyBySource(rawCurrentDaily, sourceFilter);
  const current = filterMonthlyTrafficBySource(rawCurrent, rawCurrentDaily, sourceFilter);
  const previous = current.month === "july-2026" ? liveMonthly[1] : current.month === "june-2026" ? liveMonthly[0] : liveMonthly[1];
  const quality = qualityMetrics.find((item) => item.month === current.month) ?? qualityMetrics[1];
  const signals = useMemo(() => buildSignals(current, previous, quality, targetScenario, elapsedDaysForPeriod(current.month)), [current, previous, quality]);
  const managerOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const manager of liveManagers) {
      if (!manager.managerId) continue;
      options.set(manager.managerId, manager.manager);
    }
    if (managerFilter !== "all" && !options.has(managerFilter)) {
      options.set(managerFilter, managerFilter);
    }
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [liveManagers, managerFilter]);
  const hasCohortFilter = countryFilter !== "all" || managerFilter !== "all" || productFilter !== "all";
  const showCurrentPlan = period === "july-2026" && !hasCohortFilter;
  const selectedManagerLabel = useMemo(() => {
    if (managerFilter === "all") return "все менеджеры";
    return managerOptions.find((manager) => manager.value === managerFilter)?.label ?? managerFilter;
  }, [managerFilter, managerOptions]);
  const selectedProductLabel = useMemo(() => {
    if (productFilter === "all") return "все продукты";
    return productFilter;
  }, [productFilter]);

  useEffect(() => {
    if (conversationImportLoaded.current) return;
    conversationImportLoaded.current = true;
    let cancelled = false;

    async function loadConversationBaseline() {
      try {
        const historyResponse = await fetch("/api/conversations/history?limit=1");
        const historyData = await historyResponse.json() as ConversationHistoryPayload;
        if (!cancelled && historyResponse.ok && historyData.latest?.dashboard) {
          setConversationDashboard(historyData.latest.dashboard);
          setSyncStatus(`Переписки загружены из сохранённой истории: ${number(historyData.latest.dashboard.totalDialogs)} диалогов`);
          return;
        }

        const response = await fetch("/api/conversations/import-local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: "may-june" })
        });
        const data = await response.json() as ConversationImportPayload;
        if (cancelled || !response.ok || !data.dashboard) return;
        setConversationDashboard(data.dashboard);
        setSyncStatus(`Переписки gift-ai загружены: ${number(data.summary.dialogsLoaded)} диалогов`);
      } catch {
        // Оставляем демо-выборку, если локальный экспорт временно недоступен.
      }
    }

    void loadConversationBaseline();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasCohortFilter) return;
    lastGooglePeriod.current = null;
    setSyncStatus("Обновляю факты по выбранному срезу...");
    setGoogleStatus({
      state: "idle",
      message: "Google Sheets не применяются к срезу по стране, менеджеру или продукту."
    });
    setLiveMonthly((items) => items.map((item) => item.month === period ? clearMonthlyFacts(item) : item));
    setLiveDaily((items) => items.map((item) => item.date.startsWith(monthPrefixForPeriod(period)) ? clearDailyFacts(item) : item));
  }, [countryFilter, hasCohortFilter, managerFilter, period, productFilter]);

  useEffect(() => {
    if (countryFilter !== "all" && !countryOptions.includes(countryFilter)) {
      setCountryFilter("all");
    }
  }, [countryFilter, countryOptions]);

  useEffect(() => {
    if (productFilter !== "all" && !productOptions.includes(productFilter)) {
      setProductFilter("all");
    }
  }, [productFilter, productOptions]);

  const applyGoogleSync = useCallback((payload: GoogleSyncPayload) => {
    if (hasCohortFilter) {
      setGoogleStatus({
        state: "idle",
        message: "Google Sheets не применяются к срезу по стране, менеджеру или продукту."
      });
      return;
    }
    const adSpend = payload.summary.spend;
    setLiveMonthly((items) => items.map((item) => {
      if (item.month !== period) return item;
      return {
        ...item,
        paidLeads: payload.summary.paidLeads,
        organicLeads: payload.summary.organicLeads,
        qualifiedLeads: payload.summary.ql,
        adSpend
      };
    }));
    setLiveDaily((items) => mergeDailyByDate(items, payload.daily, (base, incoming) => ({
      ...base,
      paidLeads: incoming.paidLeads,
      organicLeads: incoming.organicLeads,
      qualifiedLeads: incoming.qualifiedLeads,
      paidQualifiedLeads: incoming.paidQualifiedLeads,
      organicQualifiedLeads: incoming.organicQualifiedLeads,
      adSpend: incoming.adSpend
    })));
    setSyncStatus(`Google Sheets обновлены: лиды ${number(payload.summary.paidLeads + payload.summary.organicLeads)}, QL ${number(payload.summary.ql)}, бюджет ${eur(adSpend)}`);
  }, [hasCohortFilter, period]);

  const applyBitrixSync = useCallback((payload: BitrixSyncPayload) => {
    const useBitrixLeadTotals = hasCohortFilter;
    setLiveMonthly((items) => {
      const existing = items.find((item) => item.month === payload.monthly.month) ?? payload.monthly;
      return mergeMonthly(items, {
        ...payload.monthly,
        paidLeads: useBitrixLeadTotals ? payload.monthly.paidLeads : existing.paidLeads || payload.monthly.paidLeads,
        organicLeads: useBitrixLeadTotals ? payload.monthly.organicLeads : existing.organicLeads || payload.monthly.organicLeads,
        qualifiedLeads: useBitrixLeadTotals ? payload.monthly.qualifiedLeads : existing.qualifiedLeads || payload.monthly.qualifiedLeads,
        adSpend: useBitrixLeadTotals ? 0 : existing.adSpend
      });
    });
    setLiveDaily((items) => mergeDailyByDate(items, payload.daily, (base, incoming) => ({
      ...base,
      invoicesCount: incoming.invoicesCount,
      invoicesAmount: incoming.invoicesAmount,
      salesCount: incoming.salesCount,
      revenue: incoming.revenue,
      averagePaidCheck: incoming.averagePaidCheck,
      activeManagers: incoming.activeManagers,
      adSpend: useBitrixLeadTotals ? 0 : base.adSpend,
      paidLeads: useBitrixLeadTotals ? incoming.paidLeads : base.paidLeads || incoming.paidLeads,
      organicLeads: useBitrixLeadTotals ? incoming.organicLeads : base.organicLeads || incoming.organicLeads,
      qualifiedLeads: useBitrixLeadTotals ? incoming.qualifiedLeads : base.qualifiedLeads || incoming.qualifiedLeads,
      paidQualifiedLeads: useBitrixLeadTotals ? incoming.paidQualifiedLeads : base.paidQualifiedLeads || incoming.paidQualifiedLeads,
      organicQualifiedLeads: useBitrixLeadTotals ? incoming.organicQualifiedLeads : base.organicQualifiedLeads || incoming.organicQualifiedLeads
    })));
    setLiveManagers(payload.managers);
    setLiveInvoiceCountries(payload.invoiceCountries);
    setLiveInvoiceManagers(payload.invoiceManagers);
    setLiveInvoiceProducts(payload.invoiceProducts);
    if (payload.countryOptions?.length) {
      setCountryOptions(payload.countryOptions);
    }
    setProductOptions(payload.productOptions ?? []);
    setSyncStatus(`Bitrix обновлён: счета ${number(payload.summary.dealsLoaded)}, оплачено ${eur(payload.monthly.revenue)}, продаж ${number(payload.monthly.salesCount)}`);
  }, [hasCohortFilter]);

  const syncGoogleTraffic = useCallback(async (syncOptions?: { refresh?: boolean }) => {
    if (hasCohortFilter) {
      setGoogleStatus({
        state: "idle",
        message: "Google Sheets не применяются к срезу по стране, менеджеру или продукту."
      });
      return;
    }
    setGoogleStatus({ state: "loading", message: "Проверяю Google Sheets..." });
    try {
      const response = await fetch("/api/sync/google-traffic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period,
          refresh: syncOptions?.refresh === true
        })
      });
      const data = await response.json() as GoogleSyncPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось прочитать Google Sheets");
      applyGoogleSync(data);
      const sources = data.summary.sourcesLoaded?.length ? ` Источники: ${data.summary.sourcesLoaded.join(", ")}.` : "";
      const sourceText = data.summary.dataSource === "snapshot" ? "snapshot" : "Google live";
      setGoogleStatus({
        state: "ok",
        message: `${sourceText}: загружено строк ${data.summary.rowsLoaded}. Платные лиды ${number(data.summary.paidLeads)}, органика ${number(data.summary.organicLeads)}, QL ${number(data.summary.ql)}, бюджет ${eur(data.summary.spend)}, CPL ${eur(data.summary.averageCpl)}.${sources}`
      });
    } catch (error) {
      setGoogleStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось прочитать Google Sheets"
      });
    }
  }, [applyGoogleSync, hasCohortFilter, period]);

  const syncBitrix = useCallback(async (syncOptions?: { refresh?: boolean }) => {
    const requestId = bitrixRequestId.current + 1;
    bitrixRequestId.current = requestId;
    const requestPeriod = period;
    const requestCountry = countryFilter;
    const requestManager = managerFilter;
    const requestProduct = productFilter;
    const requestHasCohortFilter = requestCountry !== "all" || requestManager !== "all" || requestProduct !== "all";
    setBitrixStatus({ state: "loading", message: "Загружаю факт из Bitrix..." });
    setLiveInvoiceCountries([]);
    setLiveInvoiceManagers([]);
    setLiveInvoiceProducts([]);
    if (requestHasCohortFilter) {
      setLiveMonthly((items) => items.map((item) => item.month === requestPeriod ? clearMonthlyFacts(item) : item));
      setLiveDaily((items) => items.map((item) => item.date.startsWith(monthPrefixForPeriod(requestPeriod)) ? clearDailyFacts(item) : item));
    }
    try {
      const response = await fetch("/api/sync/bitrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period: requestPeriod,
          country: requestCountry,
          manager: requestManager,
          product: requestProduct,
          refresh: syncOptions?.refresh === true
        })
      });
      const data = await response.json();
      if (requestId !== bitrixRequestId.current) return false;
      if (!response.ok) throw new Error(data.error || "Не удалось прочитать Bitrix");
      applyBitrixSync(data);
      const countryText = requestCountry === "all" ? "все страны" : requestCountry;
      const managerText = requestManager === "all" ? "все менеджеры" : selectedManagerLabel;
      const productText = requestProduct === "all" ? "все продукты" : selectedProductLabel;
      const sourceText = data.summary.dataSource === "snapshot" ? "snapshot" : "Bitrix live";
      setBitrixStatus({
        state: "ok",
        message: `${sourceText}: ${countryText}, ${managerText}, ${productText}. Лиды ${number(data.summary.leadsLoaded)}, клиенты 10 дней ${number(data.summary.recentClientsLoaded)}, счета ${number(data.summary.dealsLoaded)}, продажи ${number(data.monthly.salesCount)}, выручка ${eur(data.monthly.revenue)}.`
      });
      return true;
    } catch (error) {
      if (requestId !== bitrixRequestId.current) return false;
      setBitrixStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось прочитать Bitrix"
      });
      return false;
    }
  }, [applyBitrixSync, countryFilter, managerFilter, period, productFilter, selectedManagerLabel, selectedProductLabel]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const shouldSyncGoogle = !hasCohortFilter && lastGooglePeriod.current !== period;

      setSyncStatus("Автосинхронизация фактов...");
      const bitrixOk = await syncBitrix();
      if (cancelled) return;
      if (shouldSyncGoogle) {
        await syncGoogleTraffic();
        lastGooglePeriod.current = period;
      }
      if (!cancelled && bitrixOk) setSyncStatus("Факты обновлены автоматически");
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [period, countryFilter, hasCohortFilter, managerFilter, productFilter, syncBitrix, syncGoogleTraffic]);

  return (
    <main className="mx-auto w-[min(1480px,calc(100%-32px))] py-6">
      <Link href={HUB_PATH} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600">
        <ArrowLeft size={16} />
        К рабочему кабинету
      </Link>
      <header className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">{mode === "rop" ? "ИНСТРУМЕНТЫ РОП" : "ОПЕРАЦИОННЫЙ ПУЛЬТ"}</p>
          <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">{mode === "rop" ? "Инструменты РОП" : "Аналитика Retro Pressa"}</h1>
          <p className="mt-2 text-base text-slate-600">
            {mode === "rop"
              ? "План-факт, команда, качество переписок, ежедневный импорт Bitrix и управленческие решения."
              : "North Star €100 000 • рабочий план месяца • маркетинг • продажи • качество переписок"}
          </p>
        </div>
        <div className="card flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600">
          <span className="h-3 w-3 rounded-full bg-emerald-600" />
          <span>{syncStatus}</span>
          <button className="rounded-lg border border-slate-200 p-2" title="Перейти к синхронизации" onClick={() => setActiveTab("Данные и настройки")}><RefreshCcw size={16} /></button>
          <button className="rounded-lg border border-slate-200 p-2" title="Настройки"><Settings2 size={16} /></button>
        </div>
      </header>
      <GlobalFilters
        period={period}
        setPeriod={setPeriod}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        countryOptions={countryOptions}
        managerFilter={managerFilter}
        setManagerFilter={setManagerFilter}
        managerOptions={managerOptions}
        productFilter={productFilter}
        setProductFilter={setProductFilter}
        productOptions={productOptions}
      />
      {activeTab !== "Обзор" ? <DetailNavigation activeTab={activeTab} setActiveTab={setActiveTab} compact /> : null}
      {activeTab === "Обзор" ? <Overview current={current} previous={previous} monthlyPlan={monthlyPlan} daily={currentDaily} showPlan={showCurrentPlan} invoiceCountries={liveInvoiceCountries} invoiceManagers={liveInvoiceManagers} invoiceProducts={liveInvoiceProducts} /> : null}
      {activeTab === "Обзор" ? <DetailNavigation activeTab={activeTab} setActiveTab={setActiveTab} /> : null}
      {activeTab === "Growth Intelligence" ? <GrowthIntelligenceTab current={current} previous={previous} quality={quality} daily={currentDaily} monthlyPlan={monthlyPlan} conversationDashboard={conversationDashboard} /> : null}
      {activeTab === "План месяца" ? <MonthPlanningTab current={current} monthlyPlan={monthlyPlan} setMonthlyPlan={setMonthlyPlan} daily={currentDaily} /> : null}
      {activeTab === "План €100 000" ? <PlanTab current={current} daily={currentDaily} /> : null}
      {activeTab === "Воронка" ? <FunnelTab current={current} quality={quality} /> : null}
      {activeTab === "Маркетинг" ? <MarketingTab current={current} previous={previous} /> : null}
      {activeTab === "Продажи" ? <SalesTab current={current} /> : null}
      {activeTab === "Качество переписок" ? <QualityTab dashboard={conversationDashboard} onConversationImport={setConversationDashboard} /> : null}
      {activeTab === "Рынки" ? <MarketsTab /> : null}
      {activeTab === "Менеджеры" ? <ManagersTab managers={liveManagers} daily={currentDaily} managerFilter={managerFilter} /> : null}
      {activeTab === "Данные и настройки" ? <DataTab googleStatus={googleStatus} bitrixStatus={bitrixStatus} syncGoogleTraffic={syncGoogleTraffic} syncBitrix={syncBitrix} onConversationImport={setConversationDashboard} setActiveTab={setActiveTab} /> : null}
    </main>
  );
}
