"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthlyMetrics } from "@/data/demo-data";
import { cashRoas, delta, invoiceRoas, paidCpl, totalLeads } from "@/lib/metrics-engine";
import { eur, number, pct } from "@/lib/format";
import { HUB_PATH } from "@/lib/auth/routes";
import { UtmGeneratorPanel } from "@/components/utm-generator-panel";
import type { PeriodKey } from "@/types/metrics";

type SyncStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

type Ga4SyncPayload = {
  summary: {
    newUsers: number;
    sessions: number;
    engagedSessions: number;
    returningUsers: number;
    unassignedUsers: number;
    unassignedShare: number;
    channels: string[];
  };
  byChannel: Array<{
    channel: string;
    newUsers: number;
    sessions: number;
    engagedSessions: number;
  }>;
  daily: Array<{
    date: string;
    newUsers: number;
    sessions: number;
  }>;
  dataSource: "snapshot" | "live";
};

type Ga4AskPayload = {
  model: string;
  answer: string;
  highlights: string[];
  caveats: string[];
};

type GoogleSyncPayload = {
  summary: {
    paidLeads: number;
    organicLeads: number;
    ql: number;
    spend: number;
    averageCpl: number;
    dataSource: "snapshot" | "live";
  };
};

const periods: Array<{ value: PeriodKey; label: string }> = [
  { value: "may-2026", label: "Май 2026" },
  { value: "june-2026", label: "Июнь 2026" },
  { value: "july-2026", label: "Июль 2026" }
];

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function MetricCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

export function AdAnalyticsScreen() {
  const [period, setPeriod] = useState<PeriodKey>("july-2026");
  const [ga4Status, setGa4Status] = useState<SyncStatus>({
    state: "idle",
    message: "Загружаю GA4..."
  });
  const [marketingStatus, setMarketingStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Загружаю CRM-лиды..."
  });
  const [ga4Summary, setGa4Summary] = useState<Ga4SyncPayload["summary"] | null>(null);
  const [ga4Channels, setGa4Channels] = useState<Ga4SyncPayload["byChannel"]>([]);
  const [ga4Daily, setGa4Daily] = useState<Ga4SyncPayload["daily"]>([]);
  const [marketingSummary, setMarketingSummary] = useState<GoogleSyncPayload["summary"] | null>(null);
  const [ga4Question, setGa4Question] = useState("");
  const [ga4Answer, setGa4Answer] = useState<Ga4AskPayload | null>(null);

  const current = useMemo(
    () => monthlyMetrics.find((item) => item.month === period) ?? monthlyMetrics[2],
    [period]
  );
  const previous = useMemo(() => {
    if (period === "july-2026") return monthlyMetrics[1];
    if (period === "june-2026") return monthlyMetrics[0];
    return monthlyMetrics[1];
  }, [period]);

  const loadGa4 = useCallback(async (refresh = false) => {
    setGa4Status({ state: "loading", message: refresh ? "Обновляю GA4..." : "Загружаю GA4..." });
    try {
      const response = await fetch("/api/sync/ga4", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period, refresh })
      });
      const data = await response.json() as Ga4SyncPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить GA4");
      setGa4Summary(data.summary);
      setGa4Channels(data.byChannel);
      setGa4Daily(data.daily);
      setGa4Status({
        state: "ok",
        message: `${data.dataSource}: ${number(data.summary.newUsers)} новых пользователей, ${number(data.summary.sessions)} сессий, Unassigned ${pct(data.summary.unassignedShare)}.`
      });
    } catch (error) {
      setGa4Status({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить GA4"
      });
    }
  }, [period]);

  const loadMarketing = useCallback(async () => {
    setMarketingStatus({ state: "loading", message: "Загружаю лиды из Google Sheets..." });
    try {
      const response = await fetch("/api/sync/google-traffic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period })
      });
      const data = await response.json() as GoogleSyncPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить маркетинг");
      setMarketingSummary(data.summary);
      setMarketingStatus({
        state: "ok",
        message: `${data.summary.dataSource}: платные ${number(data.summary.paidLeads)}, органика ${number(data.summary.organicLeads)}, бюджет ${eur(data.summary.spend)}.`
      });
    } catch (error) {
      setMarketingStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить маркетинг"
      });
    }
  }, [period]);

  const askGa4 = useCallback(async () => {
    const question = ga4Question.trim();
    if (!question) return;
    setGa4Status({ state: "loading", message: "Gemini отвечает на вопрос..." });
    try {
      const response = await fetch("/api/analytics/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, period })
      });
      const data = await response.json() as Ga4AskPayload & Ga4SyncPayload & { error?: string; model?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось получить ответ");
      setGa4Answer({
        model: data.model ?? "gemini",
        answer: data.answer,
        highlights: data.highlights ?? [],
        caveats: data.caveats ?? []
      });
      if (data.summary) setGa4Summary(data.summary);
      if (data.byChannel) setGa4Channels(data.byChannel);
      setGa4Status({ state: "ok", message: "Ответ готов." });
    } catch (error) {
      setGa4Status({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось получить ответ"
      });
    }
  }, [ga4Question, period]);

  useEffect(() => {
    void loadGa4(false);
    void loadMarketing();
  }, [loadGa4, loadMarketing]);

  const crmLeads = marketingSummary
    ? marketingSummary.paidLeads + marketingSummary.organicLeads
    : totalLeads(current);
  const sessionToLeadRate = ga4Summary && ga4Summary.sessions > 0
    ? crmLeads / ga4Summary.sessions
    : 0;

  return (
    <main className="mx-auto w-[min(1480px,calc(100%-32px))] py-6">
      <Link href={HUB_PATH} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-600">
        <ArrowLeft size={16} />
        К рабочему кабинету
      </Link>

      <header className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-emerald-600">Аналитика рекламы</p>
          <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">Веб-трафик и реклама</h1>
          <p className="mt-2 max-w-3xl text-base text-slate-600">
            Google Analytics 4, каналы привлечения, сверка с CRM-лидами и ответы на вопросы через Gemini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodKey)}
          >
            {periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            onClick={() => {
              void loadGa4(true);
              void loadMarketing();
            }}
            disabled={ga4Status.state === "loading"}
          >
            <RefreshCcw size={16} />
            {ga4Status.state === "loading" ? "Обновляю..." : "Обновить данные"}
          </button>
        </div>
      </header>

      <div className="mb-4">
        <UtmGeneratorPanel />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Новые пользователи GA4" value={number(ga4Summary?.newUsers ?? 0)} hint="Посетители сайта" />
        <MetricCard title="Сессии GA4" value={number(ga4Summary?.sessions ?? 0)} hint="Все визиты за период" />
        <MetricCard title="CRM лиды" value={number(crmLeads)} hint={`Платные ${number(marketingSummary?.paidLeads ?? current.paidLeads)} • Органика ${number(marketingSummary?.organicLeads ?? current.organicLeads)}`} />
        <MetricCard title="Session → Lead" value={pct(sessionToLeadRate)} hint="Лиды / сессии GA4" />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Unassigned" value={pct(ga4Summary?.unassignedShare ?? 0)} hint={`${number(ga4Summary?.unassignedUsers ?? 0)} пользователей без канала`} />
        <MetricCard title="Бюджет" value={eur(marketingSummary?.spend ?? current.adSpend)} hint={`CPL ${eur(marketingSummary?.averageCpl ?? paidCpl(current))}`} />
        <MetricCard title="Cash ROAS" value={pct(cashRoas(current))} hint="Выручка / бюджет" />
        <MetricCard title="Invoice ROAS" value={pct(invoiceRoas(current))} hint="Счета / бюджет" />
      </div>

      <p className={`mb-4 text-sm font-semibold ${ga4Status.state === "error" || marketingStatus.state === "error" ? "text-red-700" : "text-slate-600"}`}>
        GA4: {ga4Status.message} • CRM: {marketingStatus.message}
      </p>

      <section className="card mb-4 p-4">
        <SectionHead title="Каналы GA4" subtitle="Откуда приходят пользователи на сайт" />
        {ga4Channels.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Канал</th>
                  <th>Новые пользователи</th>
                  <th>Сессии</th>
                  <th>Engaged sessions</th>
                  <th>Доля</th>
                </tr>
              </thead>
              <tbody>
                {ga4Channels.map((row) => (
                  <tr key={row.channel}>
                    <td>{row.channel}</td>
                    <td>{number(row.newUsers)}</td>
                    <td>{number(row.sessions)}</td>
                    <td>{number(row.engagedSessions)}</td>
                    <td>{pct((ga4Summary?.newUsers ?? 0) > 0 ? row.newUsers / (ga4Summary?.newUsers ?? 1) : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Данные каналов появятся после синхронизации GA4.</p>
        )}
      </section>

      <section className="card mb-4 p-4">
        <SectionHead title="Динамика по дням" subtitle="Новые пользователи GA4" />
        <div className="h-72">
          {ga4Daily.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ga4Daily}>
                <CartesianGrid stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="newUsers" stroke="#059669" fill="#d1fae5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Нет дневных данных GA4</div>
          )}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <SectionHead title="Спросить про трафик" subtitle="Gemini отвечает на основе GA4 и CRM-лидов за выбранный месяц" />
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none"
            placeholder="Например: почему Unassigned такой высокий?"
            value={ga4Question}
            onChange={(event) => setGa4Question(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void askGa4();
            }}
          />
          <button
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            onClick={() => void askGa4()}
            disabled={ga4Status.state === "loading" || !ga4Question.trim()}
          >
            Спросить
          </button>
        </div>
        {ga4Answer ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm leading-6 text-slate-800">{ga4Answer.answer}</p>
            {ga4Answer.highlights.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {ga4Answer.highlights.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
            {ga4Answer.caveats.length ? (
              <p className="mt-3 text-xs text-slate-500">Ограничения: {ga4Answer.caveats.join(" ")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card p-4">
        <SectionHead title="CRM-метрики месяца" subtitle="Лиды и бюджет из Google Sheets — для сверки с GA4" />
        <div className="table-scroll">
          <table>
            <thead><tr><th>Метрика</th><th>Предыдущий месяц</th><th>Текущий</th><th>Изменение</th></tr></thead>
            <tbody>
              {[
                ["Платные лиды", previous.paidLeads, marketingSummary?.paidLeads ?? current.paidLeads],
                ["Органика", previous.organicLeads, marketingSummary?.organicLeads ?? current.organicLeads],
                ["Бюджет", previous.adSpend, marketingSummary?.spend ?? current.adSpend],
                ["CPL", paidCpl(previous), marketingSummary?.averageCpl ?? paidCpl(current)],
                ["Выручка", previous.revenue, current.revenue]
              ].map(([name, prev, cur]) => (
                <tr key={String(name)}>
                  <td>{name}</td>
                  <td>{String(name) === "CPL" || String(name) === "Бюджет" || String(name) === "Выручка" ? eur(Number(prev)) : number(Number(prev))}</td>
                  <td>{String(name) === "CPL" || String(name) === "Бюджет" || String(name) === "Выручка" ? eur(Number(cur)) : number(Number(cur))}</td>
                  <td>{pct(delta(Number(cur), Number(prev)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
