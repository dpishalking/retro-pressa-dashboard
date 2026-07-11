"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, RefreshCcw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthlyMetrics } from "@/data/demo-data";
import { cashRoas, delta, invoiceRoas, paidCpl, totalLeads } from "@/lib/metrics-engine";
import { eur, number, pct } from "@/lib/format";
import { HUB_PATH, UTM_GENERATOR_PUBLIC_PATH } from "@/lib/auth/routes";
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
    compliantSessionShare?: number;
    sessionsWithoutUtm?: number;
  };
  byChannel: Array<{
    channel: string;
    newUsers: number;
    sessions: number;
    engagedSessions: number;
  }>;
  byCampaign?: Array<{
    campaign: string;
    source: string;
    medium: string;
    sessions: number;
    newUsers: number;
    compliant: boolean;
  }>;
  byLanding?: Array<{
    landingPage: string;
    source: string;
    medium: string;
    sessions: number;
  }>;
  daily: Array<{
    date: string;
    newUsers: number;
    sessions: number;
  }>;
  dataSource: "snapshot" | "live";
};

type ClaritySyncPayload = {
  summary: {
    totalSessions: number;
    totalRageClicks: number;
    totalDeadClicks: number;
    totalQuickbackClicks: number;
    mobileSessionShare: number;
    topCampaign: string | null;
    topUrl: string | null;
  };
  byUrl: Array<{
    value: string;
    sessions: number;
    rageClicks?: number;
    deadClicks?: number;
    quickbackClicks?: number;
  }>;
  byCampaign: Array<{
    value: string;
    sessions: number;
    rageClicks?: number;
    deadClicks?: number;
  }>;
  numOfDays: number;
  dataSource: "snapshot" | "live";
  dashboardUrl: string | null;
};

type ClarityAskPayload = {
  model: string;
  answer: string;
  highlights: string[];
  caveats: string[];
};

type UtmAuditPayload = {
  summary: {
    compliantSessionShare: number;
    sessionsWithoutUtm: number;
    unassignedShare: number;
    bitrixLeadsWithUtm: number;
    bitrixLeadsTotal: number;
    bitrixLeadsWithLanding: number;
    issues: string[];
  };
  campaigns: Array<{
    campaign: string;
    ga4Sessions: number;
    ga4Compliant: boolean;
    sheetsLeads: number;
    bitrixLeads: number;
    bitrixWonDeals: number;
    status: string;
  }>;
  landingPages: Array<{
    landingPage: string;
    ga4Sessions: number;
    bitrixLeads: number;
    source: string;
    medium: string;
  }>;
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
  const [ga4Campaigns, setGa4Campaigns] = useState<NonNullable<Ga4SyncPayload["byCampaign"]>>([]);
  const [ga4Landing, setGa4Landing] = useState<NonNullable<Ga4SyncPayload["byLanding"]>>([]);
  const [ga4Daily, setGa4Daily] = useState<Ga4SyncPayload["daily"]>([]);
  const [utmAudit, setUtmAudit] = useState<UtmAuditPayload | null>(null);
  const [clarityStatus, setClarityStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Clarity ещё не синхронизировался."
  });
  const [claritySummary, setClaritySummary] = useState<ClaritySyncPayload["summary"] | null>(null);
  const [clarityUrls, setClarityUrls] = useState<ClaritySyncPayload["byUrl"]>([]);
  const [clarityDashboardUrl, setClarityDashboardUrl] = useState<string | null>(null);
  const [clarityQuestion, setClarityQuestion] = useState("");
  const [clarityAnswer, setClarityAnswer] = useState<ClarityAskPayload | null>(null);
  const [marketingSummary, setMarketingSummary] = useState<GoogleSyncPayload["summary"] | null>(null);
  const [ga4Question, setGa4Question] = useState("");
  const [ga4Answer, setGa4Answer] = useState<Ga4AskPayload | null>(null);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);

  const publicUtmUrl = useMemo(() => {
    if (typeof window === "undefined") return UTM_GENERATOR_PUBLIC_PATH;
    return `${window.location.origin}${UTM_GENERATOR_PUBLIC_PATH}`;
  }, []);
  const [askStatus, setAskStatus] = useState<SyncStatus>({
    state: "idle",
    message: ""
  });

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
      setGa4Campaigns(data.byCampaign ?? []);
      setGa4Landing(data.byLanding ?? []);
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

  const loadClarity = useCallback(async (refresh = false) => {
    setClarityStatus({ state: "loading", message: refresh ? "Обновляю Clarity..." : "Загружаю Clarity..." });
    try {
      const response = await fetch("/api/sync/clarity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh })
      });
      const data = await response.json() as ClaritySyncPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить Clarity");
      setClaritySummary(data.summary);
      setClarityUrls(data.byUrl ?? []);
      setClarityDashboardUrl(data.dashboardUrl ?? null);
      setClarityStatus({
        state: "ok",
        message: `${data.dataSource}: ${number(data.summary.totalSessions)} сессий за ${data.numOfDays} дн., rage ${number(data.summary.totalRageClicks)}, dead ${number(data.summary.totalDeadClicks)}.`
      });
    } catch (error) {
      setClarityStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить Clarity"
      });
    }
  }, []);

  const askClarity = useCallback(async () => {
    const question = clarityQuestion.trim();
    if (!question) return;
    setClarityStatus({ state: "loading", message: "Gemini анализирует поведение на сайте..." });
    try {
      const response = await fetch("/api/sync/clarity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, period, refresh: false })
      });
      const data = await response.json() as ClarityAskPayload & { error?: string; model?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось получить ответ");
      setClarityAnswer({
        model: data.model ?? "gemini",
        answer: data.answer,
        highlights: data.highlights ?? [],
        caveats: data.caveats ?? []
      });
      setClarityStatus({ state: "ok", message: "Ответ Clarity готов." });
    } catch (error) {
      setClarityStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось получить ответ"
      });
    }
  }, [clarityQuestion, period]);

  const loadUtmAudit = useCallback(async (refresh = false) => {
    try {
      const response = await fetch("/api/sync/utm-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period, refresh })
      });
      const data = await response.json() as UtmAuditPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить UTM-аудит");
      setUtmAudit(data);
    } catch {
      setUtmAudit(null);
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
    if (!question) {
      setAskStatus({ state: "error", message: "Введите вопрос." });
      return;
    }
    setAskStatus({ state: "loading", message: "Gemini отвечает на вопрос..." });
    setGa4Answer(null);
    try {
      const response = await fetch("/api/analytics/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, period })
      });
      const data = await response.json() as Ga4AskPayload & Ga4SyncPayload & {
        error?: string;
        model?: string;
        ga4Summary?: Ga4SyncPayload["summary"];
        ga4ByChannel?: Ga4SyncPayload["byChannel"];
      };
      if (!response.ok) throw new Error(data.error || "Не удалось получить ответ");
      setGa4Answer({
        model: data.model ?? "gemini",
        answer: data.answer,
        highlights: data.highlights ?? [],
        caveats: data.caveats ?? []
      });
      const summary = data.summary ?? data.ga4Summary;
      const byChannel = data.byChannel ?? data.ga4ByChannel;
      if (summary) setGa4Summary(summary);
      if (byChannel) setGa4Channels(byChannel);
      setAskStatus({ state: "ok", message: "Ответ готов." });
    } catch (error) {
      setAskStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось получить ответ"
      });
    }
  }, [ga4Question, period]);

  useEffect(() => {
    void loadGa4(false);
    void loadMarketing();
    void loadUtmAudit(false);
    void loadClarity(false);
  }, [loadGa4, loadMarketing, loadUtmAudit, loadClarity]);

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
              void loadUtmAudit(true);
              void loadClarity(true);
            }}
            disabled={ga4Status.state === "loading"}
          >
            <RefreshCcw size={16} />
            {ga4Status.state === "loading" ? "Обновляю..." : "Обновить данные"}
          </button>
        </div>
      </header>

      <div className="mb-4">
        <section className="card mb-4 border-l-4 border-l-emerald-500 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Публичная ссылка для подрядчиков</h2>
              <p className="mt-1 text-sm text-slate-600">
                Передайте эту ссылку рекламным подрядчикам — доступ к дашборду не нужен.
              </p>
              <p className="mt-2 text-sm font-semibold text-emerald-700">{publicUtmUrl}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                onClick={() => {
                  void navigator.clipboard.writeText(publicUtmUrl);
                  setPublicLinkCopied(true);
                  window.setTimeout(() => setPublicLinkCopied(false), 1800);
                }}
              >
                <Copy size={16} />
                {publicLinkCopied ? "Скопировано" : "Скопировать ссылку"}
              </button>
              <Link
                href={UTM_GENERATOR_PUBLIC_PATH}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              >
                <ExternalLink size={16} />
                Открыть генератор
              </Link>
            </div>
          </div>
        </section>
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
        <MetricCard title="UTM OK" value={pct(ga4Summary?.compliantSessionShare ?? utmAudit?.summary.compliantSessionShare ?? 0)} hint="Сессии с правильной парой source/medium" />
        <MetricCard title="Без UTM" value={number(ga4Summary?.sessionsWithoutUtm ?? utmAudit?.summary.sessionsWithoutUtm ?? 0)} hint="Сессии Direct / без campaign" />
        <MetricCard title="Bitrix UTM" value={`${number(utmAudit?.summary.bitrixLeadsWithUtm ?? 0)} / ${number(utmAudit?.summary.bitrixLeadsTotal ?? 0)}`} hint={`Landing: ${number(utmAudit?.summary.bitrixLeadsWithLanding ?? 0)} лидов`} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Бюджет" value={eur(marketingSummary?.spend ?? current.adSpend)} hint={`CPL ${eur(marketingSummary?.averageCpl ?? paidCpl(current))}`} />
        <MetricCard title="Cash ROAS" value={pct(cashRoas(current))} hint="Выручка / бюджет" />
        <MetricCard title="Invoice ROAS" value={pct(invoiceRoas(current))} hint="Счета / бюджет" />
        <MetricCard title="CRM лиды" value={number(crmLeads)} hint={`Платные ${number(marketingSummary?.paidLeads ?? current.paidLeads)} • Органика ${number(marketingSummary?.organicLeads ?? current.organicLeads)}`} />
      </div>

      <p className={`mb-4 text-sm font-semibold ${ga4Status.state === "error" || marketingStatus.state === "error" || clarityStatus.state === "error" ? "text-red-700" : "text-slate-600"}`}>
        GA4: {ga4Status.message} • CRM: {marketingStatus.message} • Clarity: {clarityStatus.message}
      </p>

      <section className="card mb-4 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <SectionHead
            title="Microsoft Clarity"
            subtitle="Поведение на сайте за последние 1–3 дня: клики, фрустрация, лендинги"
          />
          {clarityDashboardUrl ? (
            <a
              href={clarityDashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              <ExternalLink size={16} />
              Открыть записи в Clarity
            </a>
          ) : null}
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Сессии Clarity" value={number(claritySummary?.totalSessions ?? 0)} hint="Последние 72 часа" />
          <MetricCard title="Rage clicks" value={number(claritySummary?.totalRageClicks ?? 0)} hint="Раздражённые клики" />
          <MetricCard title="Dead clicks" value={number(claritySummary?.totalDeadClicks ?? 0)} hint="Клики без ответа" />
          <MetricCard title="Mobile" value={pct(claritySummary?.mobileSessionShare ?? 0)} hint="Доля мобильных сессий" />
        </div>

        {clarityUrls.length ? (
          <div className="table-scroll mb-4">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Сессии</th>
                  <th>Rage</th>
                  <th>Dead</th>
                  <th>Quickback</th>
                </tr>
              </thead>
              <tbody>
                {clarityUrls.slice(0, 12).map((row) => (
                  <tr key={row.value}>
                    <td className="max-w-sm truncate" title={row.value}>{row.value}</td>
                    <td>{number(row.sessions)}</td>
                    <td>{number(row.rageClicks ?? 0)}</td>
                    <td>{number(row.deadClicks ?? 0)}</td>
                    <td>{number(row.quickbackClicks ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-4 text-sm text-slate-500">
            Подключите CLARITY_API_TOKEN в настройках сервера, чтобы видеть поведенческие метрики в BI.
          </p>
        )}

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none"
            placeholder="Например: почему на /es/new много кликов по кнопке, но мало лидов?"
            value={clarityQuestion}
            onChange={(event) => setClarityQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void askClarity();
            }}
          />
          <button
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            onClick={() => void askClarity()}
            disabled={clarityStatus.state === "loading" || !clarityQuestion.trim()}
          >
            Спросить про UX
          </button>
        </div>
        {clarityAnswer ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm leading-6 text-slate-800">{clarityAnswer.answer}</p>
            {clarityAnswer.highlights.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {clarityAnswer.highlights.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
            {clarityAnswer.caveats.length ? (
              <p className="mt-3 text-xs text-slate-500">Ограничения: {clarityAnswer.caveats.join(" ")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {utmAudit?.summary.issues.length ? (
        <section className="card mb-4 border-l-4 border-l-amber-500 p-4">
          <SectionHead title="Проблемы UTM" subtitle="Что мешает сквозной атрибуции" />
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {utmAudit.summary.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            На сайт <code className="rounded bg-slate-100 px-1">retro-pressa.com</code> добавьте перед закрывающим <code className="rounded bg-slate-100 px-1">&lt;/body&gt;</code>:
            {" "}<code className="rounded bg-slate-100 px-1">&lt;script src="https://rp-bi.site/retro-pressa-utm.js" defer&gt;&lt;/script&gt;</code>
          </p>
        </section>
      ) : null}

      <section className="card mb-4 p-4">
        <SectionHead title="Кампании и UTM" subtitle="GA4 сессии vs лиды Sheets/Bitrix по utm_campaign" />
        {(utmAudit?.campaigns.length || ga4Campaigns.length) ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Кампания</th>
                  <th>GA4 сессии</th>
                  <th>UTM OK</th>
                  <th>Sheets лиды</th>
                  <th>Bitrix лиды</th>
                  <th>Продажи</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {(utmAudit?.campaigns.length ? utmAudit.campaigns : ga4Campaigns.map((row) => ({
                  campaign: row.campaign,
                  ga4Sessions: row.sessions,
                  ga4Compliant: row.compliant,
                  sheetsLeads: 0,
                  bitrixLeads: 0,
                  bitrixWonDeals: 0,
                  status: row.compliant ? "ok" : "mismatch"
                }))).map((row) => (
                  <tr key={row.campaign}>
                    <td className="max-w-xs truncate" title={row.campaign}>{row.campaign}</td>
                    <td>{number(row.ga4Sessions)}</td>
                    <td>{row.ga4Compliant ? "✓" : "—"}</td>
                    <td>{number(row.sheetsLeads)}</td>
                    <td>{number(row.bitrixLeads)}</td>
                    <td>{number(row.bitrixWonDeals)}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Нажмите «Обновить данные» для загрузки кампаний.</p>
        )}
      </section>

      <section className="card mb-4 p-4">
        <SectionHead title="Лендинги" subtitle="Какие страницы получают трафик и лиды" />
        {(utmAudit?.landingPages.length || ga4Landing.length) ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Страница</th>
                  <th>GA4 сессии</th>
                  <th>Bitrix лиды</th>
                  <th>source / medium</th>
                </tr>
              </thead>
              <tbody>
                {(utmAudit?.landingPages.length ? utmAudit.landingPages : ga4Landing.map((row) => ({
                  landingPage: row.landingPage,
                  ga4Sessions: row.sessions,
                  bitrixLeads: 0,
                  source: row.source,
                  medium: row.medium
                }))).map((row) => (
                  <tr key={row.landingPage}>
                    <td>{row.landingPage}</td>
                    <td>{number(row.ga4Sessions)}</td>
                    <td>{number(row.bitrixLeads)}</td>
                    <td>{row.source} / {row.medium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Данные по лендингам появятся после синхронизации.</p>
        )}
      </section>

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
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void askGa4()}
            disabled={askStatus.state === "loading" || !ga4Question.trim()}
          >
            {askStatus.state === "loading" ? "Думаю..." : "Спросить"}
          </button>
        </div>
        {askStatus.message ? (
          <p className={`mt-3 text-sm font-semibold ${askStatus.state === "error" ? "text-red-700" : askStatus.state === "ok" ? "text-emerald-700" : "text-slate-600"}`}>
            {askStatus.message}
          </p>
        ) : null}
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
