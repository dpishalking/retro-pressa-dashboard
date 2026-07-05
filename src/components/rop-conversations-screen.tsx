"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { importAndAnalyzeConversationsWithDiagnostics } from "@/lib/conversation-intelligence";
import { eur, number, pct } from "@/lib/format";
import type { ConversationDashboardMetrics, PeriodKey } from "@/types/metrics";

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

const periodOptions: Array<{ value: PeriodKey; label: string }> = [
  { value: "july-2026", label: "Июль 2026" },
  { value: "june-2026", label: "Июнь 2026" },
  { value: "may-2026", label: "Май 2026" }
];

type SyncStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">{label}</p>
      <strong className="mt-2 block text-3xl font-black text-slate-950">{value}</strong>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

export function RopConversationsScreen() {
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<"may" | "june" | null>(null);
  const [history, setHistory] = useState<ConversationHistoryItem[]>([]);
  const [selectedImportedAt, setSelectedImportedAt] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("july-2026");
  const [status, setStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Готово к загрузке архива или живого Bitrix-среза."
  });

  const pickDefaultSelected = (items: ConversationHistoryItem[], period: PeriodKey) => {
    const matched = items.find((item) => item.periodKey === period);
    return matched?.importedAt ?? items[0]?.importedAt ?? null;
  };

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const response = await fetch("/api/conversations/history?limit=30");
        const data = await response.json() as ConversationHistoryPayload;
        if (!response.ok || cancelled) return;
        const items = data.history ?? [];
        setHistory(items);
        const latest = data.latest ?? items[0] ?? null;
        if (latest) {
          const nextSelection = pickDefaultSelected(items, selectedPeriod);
          setSelectedImportedAt(nextSelection ?? latest.importedAt);
        }
      } catch {
        if (!cancelled) {
          setStatus({ state: "error", message: "Не удалось загрузить историю переписок." });
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleHistory = useMemo(() => {
    const matched = history.filter((item) => item.periodKey === selectedPeriod);
    if (matched.length) return matched;
    return history.filter((item) => !item.periodKey);
  }, [history, selectedPeriod]);
  const selectedImportedKey = useMemo(
    () => visibleHistory.find((item) => item.importedAt === selectedImportedAt)?.importedAt ?? pickDefaultSelected(visibleHistory, selectedPeriod),
    [selectedImportedAt, selectedPeriod, visibleHistory]
  );
  const selectedSnapshot = visibleHistory.find((item) => item.importedAt === selectedImportedKey) ?? visibleHistory[0] ?? null;
  const dashboard = selectedSnapshot?.dashboard ?? null;
  const selectedPeriodLabel = periodOptions.find((item) => item.value === selectedPeriod)?.label ?? selectedPeriod;

  const refreshFromBitrix = async () => {
    setStatus({ state: "loading", message: `Забираю переписки за ${selectedPeriodLabel.toLowerCase()}...` });
    try {
      const response = await fetch("/api/conversations/sync-bitrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period: selectedPeriod, dialogLimit: 500 })
      });
      const data = await response.json() as BitrixSyncPayload;
      if (!response.ok) throw new Error(data.error || "Не удалось обновить переписки из Bitrix");
      setStatus({
        state: "ok",
        message: `Загружен ${selectedPeriodLabel.toLowerCase()}: ${number(data.summary.dialogsLoaded)} диалогов и ${number(data.summary.messagesLoaded)} сообщений.`
      });

      const historyResponse = await fetch("/api/conversations/history?limit=30");
      const historyData = await historyResponse.json() as ConversationHistoryPayload;
      if (historyResponse.ok) {
        const items = historyData.history ?? [];
        setHistory(items);
        const nextSelected = pickDefaultSelected(items, selectedPeriod);
        if (nextSelected) setSelectedImportedAt(nextSelected);
      }
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось обновить переписки из Bitrix"
      });
    }
  };

  const importLocalExports = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length) return;

    const targetLabel = archiveTarget === "may" ? "майский" : archiveTarget === "june" ? "июньский" : "локальный";
    setStatus({ state: "loading", message: `Разбираю ${targetLabel} архив локально в браузере...` });
    try {
      const inputs = await Promise.all(selectedFiles.map(async (file) => ({
        filename: file.name,
        content: await file.text(),
        defaultChannel: "gift-ai"
      })));
      const result = importAndAnalyzeConversationsWithDiagnostics(inputs);
      if (!result.messages.length) {
        throw new Error(result.diagnostics.find((item) => item.status === "error")?.note ?? "Не удалось извлечь сообщения из файла.");
      }
      const summary = {
        filesLoaded: selectedFiles.length,
        messagesLoaded: result.messages.length,
        dialogsLoaded: result.dialogs.length,
        filesParsed: result.diagnostics.filter((item) => item.status === "ok").length,
        filesFailed: result.diagnostics.filter((item) => item.status === "error").length
      };

      const response = await fetch("/api/conversations/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "gift-ai",
          label: `gift-ai: ${selectedFiles.map((file) => file.name).join(", ")}`,
          dashboard: result.dashboard,
          diagnostics: result.diagnostics,
          summary
        })
      });
      const data = await response.json() as LocalImportPayload;
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить локальный экспорт");
      setStatus({
        state: "ok",
        message: `Архив загружен: ${number(summary.dialogsLoaded)} диалогов и ${number(summary.messagesLoaded)} сообщений.`
      });

      const historyResponse = await fetch("/api/conversations/history?limit=30");
      const historyData = await historyResponse.json() as ConversationHistoryPayload;
      if (historyResponse.ok) {
        const items = historyData.history ?? [];
        setHistory(items);
        const nextSelection = pickDefaultSelected(items, selectedPeriod);
        if (nextSelection) setSelectedImportedAt(nextSelection);
      }
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить локальный экспорт"
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
                const nextHistory = history.filter((item) => item.periodKey === next);
                const nextSelection = pickDefaultSelected(nextHistory.length ? nextHistory : history.filter((item) => !item.periodKey), next);
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              onClick={refreshFromBitrix}
              disabled={status.state === "loading"}
            >
              <RefreshCcw size={16} />
              {status.state === "loading" ? "Обновляю..." : `Обновить ${selectedPeriodLabel.toLowerCase()}`}
            </button>
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

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-normal text-slate-500">Источники данных</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Архивы май и июнь загружаются отдельно. Живой Bitrix — только свежий срез.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Основные действия уже вынесены наверх, чтобы их было видно сразу в первом экране.
          </p>
        </div>
      </section>

      <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${status.state === "error" ? "border-red-200 bg-red-50 text-red-700" : status.state === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
        {status.message}
      </div>

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
          }) : <p className="text-sm text-slate-500">Для этого периода ещё нет сохранённых срезов. Нажми обновление справа.</p>}
        </div>
      </section>

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
          Пока нет сохранённого среза переписок. Нажми `Обновить из Bitrix`, и этот экран сразу наполнится фактами.
        </section>
      )}
    </main>
  );
}
