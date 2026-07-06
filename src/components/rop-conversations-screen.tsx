"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { eur, number, pct } from "@/lib/format";
import { readJsonResponse } from "@/lib/api-response";
import { inferPeriodKeyFromLabel } from "@/lib/conversation-periods";
import type { ConversationDashboardMetrics, ConversationRopReport, GeminiConversationSummary, PeriodKey } from "@/types/metrics";

type ConversationHistoryItem = {
  importedDay: string;
  importedAt: string;
  source: "manual" | "gift-ai" | "bitrix";
  periodKey?: PeriodKey | null;
  label: string;
  dashboard: ConversationDashboardMetrics;
  dialogs: number;
  conversion: number;
  qualityScore: number;
  potentialLostRevenue: number;
};

type ConversationHistoryPayload = {
  latest?: ConversationHistoryItem | null;
  history?: ConversationHistoryItem[];
  error?: string;
};

type BitrixSyncPayload = {
  source: "bitrix";
  importedAt: string;
  dashboard: ConversationDashboardMetrics;
  summary: {
    dialogsScanned: number;
    dialogsImported: number;
    messagesLoaded: number;
    daysBack: number;
    lookbackSince: string;
    filesLoaded: number;
    dialogsLoaded: number;
    messagesAdded?: number;
    dialogsAdded?: number;
    totalDialogs?: number;
    totalMessages?: number;
    incremental?: boolean;
  };
  error?: string;
};

type LocalImportPayload = {
  dashboard: ConversationDashboardMetrics;
  diagnostics: Array<{ filename: string; messages: number; dialogs: number; status: string; note: string }>;
  summary: {
    filesLoaded: number;
    messagesLoaded: number;
    dialogsLoaded: number;
    filesParsed: number;
    filesFailed: number;
  };
  error?: string;
};

type RopReportPayload = {
  source?: string;
  report?: ConversationRopReport;
  error?: string;
};

const archivePeriodMap: Record<"may" | "june" | "july", PeriodKey> = {
  may: "may-2026",
  june: "june-2026",
  july: "july-2026"
};

const archiveLabelMap: Record<"may" | "june" | "july", string> = {
  may: "майский",
  june: "июньский",
  july: "июльский"
};
const periodOptions: Array<{ value: PeriodKey; label: string }> = [
  { value: "july-2026", label: "Июль 2026" },
  { value: "june-2026", label: "Июнь 2026" },
  { value: "may-2026", label: "Май 2026" }
];

type SyncStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

function itemPeriodKey(item: ConversationHistoryItem): PeriodKey | null {
  return item.periodKey ?? inferPeriodKeyFromLabel(item.label);
}

function pickDefaultSelected(items: ConversationHistoryItem[], period: PeriodKey) {
  return pickForPeriod(items, period);
}

function pickForPeriod(items: ConversationHistoryItem[], period: PeriodKey) {
  const matched = items.filter((item) => itemPeriodKey(item) === period);
  const cumulative = matched.find((item) => item.label.includes("накопительно"));
  return cumulative?.importedAt ?? matched[0]?.importedAt ?? null;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">{label}</p>
      <strong className="mt-2 block text-3xl font-black text-slate-950">{value}</strong>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

function ropMetricValue(metric: ConversationRopReport["metrics"][number]) {
  if (metric.unit === "percent") return pct(metric.value);
  if (metric.unit === "minutes") return `${number(Math.round(metric.value))} мин`;
  if (metric.unit === "money") return eur(metric.value);
  return number(metric.value);
}

export function RopConversationsScreen() {
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<"may" | "june" | "july" | null>(null);
  const [geminiSummary, setGeminiSummary] = useState<GeminiConversationSummary | null>(null);
  const [history, setHistory] = useState<ConversationHistoryItem[]>([]);
  const [ropReport, setRopReport] = useState<ConversationRopReport | null>(null);
  const [ropReportError, setRopReportError] = useState<string>("");
  const [selectedImportedAt, setSelectedImportedAt] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("july-2026");
  const [status, setStatus] = useState<SyncStatus>({ state: "idle", message: "" });

  useEffect(() => {
    let cancelled = false;

    async function bootstrapArchives() {
      try {
        await fetch("/api/conversations/seed-archives", { method: "POST" });
      } catch {
        // Archives may already exist; history reload still runs below.
      }
    }

    async function loadHistory() {
      try {
        const response = await fetch("/api/conversations/history?limit=30");
        const data = await readJsonResponse<ConversationHistoryPayload>(response);
        if (cancelled) return;
        if (!response.ok) {
          setStatus({ state: "error", message: data.error || "Не удалось загрузить историю переписок." });
          return;
        }
        const items = data.history ?? [];
        setHistory(items);
        const latest = data.latest ?? items[0] ?? null;
        if (latest) {
          const nextSelection = pickForPeriod(items, selectedPeriod);
          setSelectedImportedAt(nextSelection ?? latest.importedAt);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            state: "error",
            message: error instanceof Error ? error.message : "Не удалось загрузить историю переписок."
          });
        }
      }
    }

    void bootstrapArchives().then(loadHistory);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextSelection = pickForPeriod(history, selectedPeriod);
    if (nextSelection) setSelectedImportedAt(nextSelection);
  }, [selectedPeriod, history]);

  useEffect(() => {
    let cancelled = false;

    async function loadRopReport() {
      setRopReportError("");
      try {
        const response = await fetch(`/api/conversations/rop-report?period=${selectedPeriod}`);
        const data = await readJsonResponse<RopReportPayload>(response);
        if (cancelled) return;
        if (!response.ok) {
          setRopReport(null);
          setRopReportError(data.error || "Не удалось построить управленческий отчёт по перепискам.");
          return;
        }
        setRopReport(data.report ?? null);
      } catch (error) {
        if (!cancelled) {
          setRopReport(null);
          setRopReportError(error instanceof Error ? error.message : "Не удалось построить управленческий отчёт по перепискам.");
        }
      }
    }

    void loadRopReport();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod, history.length, selectedImportedAt]);

  const visibleHistory = useMemo(
    () => history.filter((item) => itemPeriodKey(item) === selectedPeriod),
    [history, selectedPeriod]
  );
  const selectedImportedKey = useMemo(
    () => visibleHistory.find((item) => item.importedAt === selectedImportedAt)?.importedAt ?? pickForPeriod(visibleHistory, selectedPeriod),
    [selectedImportedAt, selectedPeriod, visibleHistory]
  );
  const selectedSnapshot = visibleHistory.find((item) => item.importedAt === selectedImportedKey) ?? visibleHistory[0] ?? null;
  const dashboard = selectedSnapshot?.dashboard ?? null;
  const selectedPeriodLabel = periodOptions.find((item) => item.value === selectedPeriod)?.label ?? selectedPeriod;

  const refreshFromBitrix = async (attempt = 0) => {
    if (selectedPeriod !== "july-2026") {
      setStatus({ state: "error", message: "Bitrix-синк доступен только для текущего месяца (июль)." });
      return;
    }
    setStatus({ state: "loading", message: "Забираю переписки за июль 2026 из Bitrix..." });
    try {
      const response = await fetch("/api/conversations/sync-bitrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period: "july-2026", dialogLimit: 25, daysBack: 1, incremental: true })
      });
      const data = await readJsonResponse<BitrixSyncPayload>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось обновить переписки из Bitrix");
      setStatus({
        state: "ok",
        message: data.summary.incremental
          ? `Июль обновлён быстрым срезом: +${number(data.summary.dialogsAdded ?? data.summary.dialogsLoaded)} диалогов сегодня, всего ${number(data.summary.totalDialogs ?? data.summary.dialogsLoaded)}. Большой импорт идёт автоматически утром.`
          : `Июль обновлён из Bitrix: ${number(data.summary.dialogsLoaded)} диалогов и ${number(data.summary.messagesLoaded)} сообщений.`
      });

      const historyResponse = await fetch("/api/conversations/history?limit=30");
      const historyData = await readJsonResponse<ConversationHistoryPayload>(historyResponse);
      if (historyResponse.ok) {
        const items = historyData.history ?? [];
        setHistory(items);
        const nextSelected = pickForPeriod(items, selectedPeriod);
        if (nextSelected) setSelectedImportedAt(nextSelected);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось обновить переписки из Bitrix";
      const shouldRetry = attempt < 1 && /HTML|таймаут|timeout|502|503|504/i.test(message);
      if (shouldRetry) {
        setStatus({ state: "loading", message: "Сервер ещё прогревается, повторяю запрос..." });
        await new Promise((resolve) => setTimeout(resolve, 2500));
        return refreshFromBitrix(attempt + 1);
      }
      setStatus({ state: "error", message });
    }
  };

  const importLocalExports = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length || !archiveTarget) return;

    const periodKey = archivePeriodMap[archiveTarget];
    const targetLabel = archiveLabelMap[archiveTarget];
    setStatus({ state: "loading", message: `Загружаю ${targetLabel} архив (${selectedFiles.map((file) => file.name).join(", ")})...` });
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      formData.append("source", "gift-ai");
      formData.append("periodKey", periodKey);
      formData.append("channel", "gift-ai");

      const response = await fetch("/api/conversations/import", {
        method: "POST",
        body: formData
      });
      const data = await readJsonResponse<LocalImportPayload>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить локальный экспорт");
      const summary = data.summary;
      setStatus({
        state: "ok",
        message: `${targetLabel.charAt(0).toUpperCase()}${targetLabel.slice(1)} архив сохранён: ${number(summary.dialogsLoaded)} диалогов и ${number(summary.messagesLoaded)} сообщений.`
      });
      setSelectedPeriod(periodKey);

      const historyResponse = await fetch("/api/conversations/history?limit=30");
      const historyData = await readJsonResponse<ConversationHistoryPayload>(historyResponse);
      if (historyResponse.ok) {
        const items = historyData.history ?? [];
        setHistory(items);
        const nextSelection = pickForPeriod(items, periodKey);
        if (nextSelection) setSelectedImportedAt(nextSelection);
      }
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить локальный экспорт"
      });
    }
  };

  const runGeminiAnalysis = async () => {
    const geminiKey = selectedPeriod === "may-2026" ? "may" : selectedPeriod === "june-2026" ? "june" : null;
    if (!geminiKey) {
      setStatus({ state: "error", message: "Глубокий AI-анализ доступен для архивов мая и июня. Июль обновляется из Bitrix." });
      return;
    }

    setStatus({ state: "loading", message: "Запускаю глубокий AI-анализ переписок через Gemini..." });
    try {
      const response = await fetch("/api/conversations/gemini", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: geminiKey, limit: 200, batchSize: 20 })
      });
      const data = await readJsonResponse<{ summary?: GeminiConversationSummary; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить AI-анализ");
      setGeminiSummary(data.summary ?? null);
      setStatus({
        state: "ok",
        message: `AI-анализ готов: ${number(data.summary?.analyzedDialogs ?? 0)} диалогов, ${number(data.summary?.topMissedOpportunities?.length ?? 0)} упущенных возможностей.`
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось выполнить AI-анализ"
      });
    }
  };

  return (
    <main className="mx-auto w-[min(1400px,calc(100%-32px))] py-8">
      <Link href="/rop" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600">
        <ArrowLeft size={16} />
        К плитке РОП
      </Link>

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">Инструменты РОП</p>
          <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">Анализ переписок</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
            Здесь живёт один рабочий слой: дневные и месячные срезы переписок, откуда мы видим конверсию, возражения, потери и лучшие сценарии.
          </p>
        </div>
        <div className="flex flex-col gap-2 self-start">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-normal text-slate-500">
            Период
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950"
              value={selectedPeriod}
              onChange={(event) => {
                const next = event.target.value as PeriodKey;
                setSelectedPeriod(next);
                setStatus({ state: "idle", message: "" });
                const nextHistory = history.filter((item) => itemPeriodKey(item) === next);
                const nextSelection = pickForPeriod(nextHistory.length ? nextHistory : history, next);
                setSelectedImportedAt(nextSelection);
              }}
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={status.state === "loading"}
              onClick={() => {
                setArchiveTarget("may");
                archiveInputRef.current?.click();
              }}
            >
              Загрузить май
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={status.state === "loading"}
              onClick={() => {
                setArchiveTarget("june");
                archiveInputRef.current?.click();
              }}
            >
              Загрузить июнь
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={status.state === "loading"}
              onClick={() => {
                setArchiveTarget("july");
                archiveInputRef.current?.click();
              }}
            >
              Загрузить июль
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              onClick={() => void refreshFromBitrix()}
              disabled={status.state === "loading" || selectedPeriod !== "july-2026"}
            >
              <RefreshCcw size={16} />
              {status.state === "loading" ? "Обновляю..." : "Обновить июль из Bitrix"}
            </button>
            {(selectedPeriod === "may-2026" || selectedPeriod === "june-2026") ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                onClick={runGeminiAnalysis}
                disabled={status.state === "loading"}
              >
                <Sparkles size={16} />
                AI-анализ
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <input
        ref={archiveInputRef}
        type="file"
        accept=".csv,.json,.txt,.xlsx,.docx,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          void importLocalExports(event.target.files ?? []);
          setArchiveTarget(null);
          event.currentTarget.value = "";
        }}
      />

      {status.state !== "idle" ? (
        <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${status.state === "error" ? "border-red-200 bg-red-50 text-red-700" : status.state === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
          {status.message}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric
          label="Диалоги"
          value={dashboard ? number(dashboard.totalDialogs) : "0"}
          hint="Сколько чатов попало в выбранный срез"
        />
        <Metric
          label="CR в заказ"
          value={dashboard ? pct(dashboard.orderConversion) : "0%"}
          hint="Заказы к общему числу диалогов"
        />
        <Metric
          label="Quality Score"
          value={dashboard ? `${number(dashboard.qualityScore)}/100` : "0/100"}
          hint="Насколько переписка продающая"
        />
        <Metric
          label="Потерянная выручка"
          value={dashboard ? eur(dashboard.potentialLostRevenue) : eur(0)}
          hint="Оценка денег, теряемых на слабых сценариях"
        />
      </section>

      {ropReport ? (
        <section className="mb-6 grid gap-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">Вывод РОПа</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Что происходит в переписках</h2>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                {ropReport.executiveSummary.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                {ropReport.caveat}
              </p>
            </div>
            <article className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-xs font-bold uppercase tracking-normal text-rose-700">Главная проблема</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-rose-950">{ropReport.mainProblem}</p>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-lg font-bold text-slate-950">Типичный слабый сценарий</h3>
              <ol className="mt-3 grid gap-2 text-sm text-slate-600">
                {ropReport.typicalWeakScenario.map((item, index) => (
                  <li key={item} className="flex gap-2">
                    <span className="font-bold text-slate-400">{index + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </article>

            <article className="rounded-2xl border border-slate-200 p-4 lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-950">Ключевые метрики качества</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ropReport.metrics.slice(0, 8).map((metric) => (
                  <div key={metric.name} className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">{metric.name}</p>
                      <b className="whitespace-nowrap text-slate-950">{ropMetricValue(metric)}</b>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{metric.note}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-lg font-bold text-slate-950">Сильные закономерности</h3>
              <div className="mt-3 grid gap-3">
                {ropReport.correlations.map((item) => (
                  <div key={item.factor} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-slate-800">{item.factor}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.liftPp >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {item.liftPp >= 0 ? "+" : ""}{pct(item.liftPp)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      С фактором: {pct(item.withFactorConversion)} · без фактора: {pct(item.withoutFactorConversion)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-lg font-bold text-slate-950">Гипотезы роста</h3>
              <div className="mt-3 grid gap-3">
                {ropReport.hypotheses.slice(0, 6).map((item) => (
                  <div key={item.title} className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Сейчас: {item.current}</p>
                    <p className="text-xs text-slate-500">Цель: {item.target}</p>
                    <p className="mt-1 text-xs font-semibold text-blue-700">{item.expectedImpact}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : ropReportError ? (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Управленческий отчёт пока не построен: {ropReportError}
        </section>
      ) : null}

      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-bold text-slate-700">Дневные и месячные срезы: {selectedPeriodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          {visibleHistory.length ? visibleHistory.map((item) => {
            const active = item.importedAt === selectedSnapshot?.importedAt;
            return (
              <button
                key={item.importedAt}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                onClick={() => setSelectedImportedAt(item.importedAt)}
              >
                {item.importedDay} · {item.label}
              </button>
            );
          }) : <p className="text-sm text-slate-500">Для {selectedPeriodLabel.toLowerCase()} ещё нет архива. {selectedPeriod === "july-2026" ? "Нажми «Загрузить июль» и выбери уже скачанный JSON/CSV — или «Обновить июль из Bitrix»." : `Нажми «Загрузить ${selectedPeriod === "may-2026" ? "май" : "июнь"}» и выбери файл.`}</p>}
        </div>
      </section>

      {geminiSummary ? (
        <section className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-violet-950">AI-анализ (Gemini)</h2>
            <span className="text-sm text-violet-700">{number(geminiSummary.analyzedDialogs)} диалогов · quality {number(geminiSummary.averageQualityScore)}/100</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article>
              <h3 className="text-sm font-bold uppercase tracking-normal text-violet-700">Упущенные возможности</h3>
              <div className="mt-3 grid gap-2">
                {geminiSummary.topMissedOpportunities.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                    <b>{number(item.count)}</b>
                  </div>
                ))}
              </div>
            </article>
            <article>
              <h3 className="text-sm font-bold uppercase tracking-normal text-violet-700">Причины потерь (AI)</h3>
              <div className="mt-3 grid gap-2">
                {geminiSummary.topLossReasons.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                    <b>{number(item.count)}</b>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {dashboard ? (
        <div className="grid gap-6">
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold">Конверсия по каналам</h2>
              <div className="mt-4 grid gap-3">
                {dashboard.conversionByChannel.map((item) => (
                  <div key={item.channel} className="grid gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">{item.channel}</span>
                      <span className="text-slate-500">{pct(item.conversion)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(4, Math.min(100, item.conversion * 100))}%` }} />
                    </div>
                    <p className="text-xs text-slate-500">{number(item.dialogs)} диалогов · {number(item.orders)} заказов</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold">Лучшие сценарии</h2>
              <div className="mt-4 grid gap-3">
                {dashboard.bestSalesScenarios.map((item) => (
                  <div key={item.name} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-slate-900">{item.name}</strong>
                      <span className="text-sm font-bold text-emerald-700">{pct(item.conversion)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{number(item.dialogs)} диалогов · средний заказ {eur(item.averageOrder)}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold">Топ возражений</h2>
              <div className="mt-4 grid gap-3">
                {dashboard.topObjections.length ? dashboard.topObjections.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                    <b>{number(item.count)}</b>
                  </div>
                )) : <p className="text-sm text-slate-500">Пока нет данных для анализа.</p>}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold">Худшие точки</h2>
              <div className="mt-4 grid gap-3">
                {dashboard.worstDialoguePoints.length ? dashboard.worstDialoguePoints.map((item) => (
                  <div key={item.name} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-slate-900">{item.name}</strong>
                      <span className="text-sm font-bold text-rose-700">{eur(item.lostRevenue)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{number(item.count)} диалогов затронуто</p>
                  </div>
                )) : <p className="text-sm text-slate-500">Пока нет данных для анализа.</p>}
              </div>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold">Топ причин потери</h2>
              <div className="mt-4 grid gap-3">
                {dashboard.topLossReasons.length ? dashboard.topLossReasons.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                    <b>{number(item.count)}</b>
                  </div>
                )) : <p className="text-sm text-slate-500">Пока нет данных для анализа.</p>}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold">Последние срезы</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Когда</th>
                      <th className="px-4 py-3">Диалоги</th>
                      <th className="px-4 py-3">CR</th>
                      <th className="px-4 py-3">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 7).map((item) => (
                      <tr key={item.importedAt} className={item.importedAt === selectedSnapshot?.importedAt ? "bg-blue-50" : "border-t border-slate-100"}>
                        <td className="px-4 py-3 font-semibold text-slate-700">{item.importedDay}</td>
                        <td className="px-4 py-3">{number(item.dialogs)}</td>
                        <td className="px-4 py-3">{pct(item.conversion)}</td>
                        <td className="px-4 py-3">{number(item.qualityScore)}/100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-500">
          Пока нет сохранённого среза переписок. Загрузите уже скачанный архив кнопкой «Загрузить {selectedPeriod === "july-2026" ? "июль" : selectedPeriod === "may-2026" ? "май" : "июнь"}» — или обновите июль из Bitrix.
        </section>
      )}
    </main>
  );
}
