"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { eur, number, pct } from "@/lib/format";
import type { ConversationDashboardMetrics } from "@/types/metrics";

type ConversationHistoryItem = {
  importedDay: string;
  importedAt: string;
  source: "manual" | "gift-ai" | "bitrix";
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
  const [history, setHistory] = useState<ConversationHistoryItem[]>([]);
  const [selectedImportedAt, setSelectedImportedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>({
    state: "idle",
    message: "Готово к загрузке последнего дневного среза Bitrix."
  });

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
        if (latest) setSelectedImportedAt(latest.importedAt);
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

  const selected = useMemo(
    () => history.find((item) => item.importedAt === selectedImportedAt) ?? history[0] ?? null,
    [history, selectedImportedAt]
  );
  const dashboard = selected?.dashboard ?? null;

  const refreshFromBitrix = async () => {
    setStatus({ state: "loading", message: "Забираю свежие переписки из Bitrix..." });
    try {
      const response = await fetch("/api/conversations/sync-bitrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ daysBack: 1, dialogLimit: 80 })
      });
      const data = await response.json() as BitrixSyncPayload;
      if (!response.ok) throw new Error(data.error || "Не удалось обновить переписки из Bitrix");
      setStatus({
        state: "ok",
        message: `Забрано ${number(data.summary.dialogsLoaded)} диалогов и ${number(data.summary.messagesLoaded)} сообщений.`
      });

      const historyResponse = await fetch("/api/conversations/history?limit=30");
      const historyData = await historyResponse.json() as ConversationHistoryPayload;
      if (historyResponse.ok) {
        const items = historyData.history ?? [];
        setHistory(items);
        const latest = historyData.latest ?? items[0] ?? null;
        if (latest) setSelectedImportedAt(latest.importedAt);
      }
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось обновить переписки из Bitrix"
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
        <button
          className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          onClick={refreshFromBitrix}
          disabled={status.state === "loading"}
        >
          <RefreshCcw size={16} />
          {status.state === "loading" ? "Обновляю..." : "Обновить из Bitrix"}
        </button>
      </header>

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
          <p className="text-sm font-bold text-slate-700">Дневные и месячные срезы</p>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          {history.length ? history.map((item) => {
            const active = item.importedAt === selected?.importedAt;
            return (
              <button
                key={item.importedAt}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                onClick={() => setSelectedImportedAt(item.importedAt)}
              >
                {item.importedDay} · {item.label}
              </button>
            );
          }) : <p className="text-sm text-slate-500">История появится после первого импорта.</p>}
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
                      <tr key={item.importedAt} className={item.importedAt === selected?.importedAt ? "bg-blue-50" : "border-t border-slate-100"}>
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
