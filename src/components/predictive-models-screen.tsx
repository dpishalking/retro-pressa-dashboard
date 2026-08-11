"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LineChart, Megaphone, RefreshCcw, Wallet } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { eur, number, pct } from "@/lib/format";
import type { PredictiveDomain, PredictiveDomainBlock, PredictiveOverview } from "@/lib/predictive/types";
import { PERIOD_KEYS, type PeriodKey } from "@/types/metrics";
import { currentPeriodKey } from "@/lib/conversation-periods";

type LoadStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

type OverviewResponse = PredictiveOverview & { ok: true };

const DOMAIN_TABS: Array<{
  id: PredictiveDomain;
  label: string;
  icon: typeof LineChart;
}> = [
  { id: "sales", label: "Продажи", icon: LineChart },
  { id: "marketing", label: "Маркетинг", icon: Megaphone },
  { id: "finance", label: "Финансы", icon: Wallet }
];

function formatValue(unit: string, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "eur") return eur(value);
  if (unit === "ratio") return pct(value);
  return number(value);
}

function statusClass(status: PredictiveDomainBlock["status"]): string {
  switch (status) {
    case "ok":
      return "status-green";
    case "partial":
      return "bg-amber-100 text-amber-800";
    case "blocked":
      return "bg-slate-100 text-slate-600";
    case "error":
      return "bg-red-100 text-red-700";
  }
}

function statusLabel(status: PredictiveDomainBlock["status"]): string {
  switch (status) {
    case "ok":
      return "Готово";
    case "partial":
      return "Частично";
    case "blocked":
      return "Заблокировано";
    case "error":
      return "Ошибка";
  }
}

function DomainPanel({ block }: { block: PredictiveDomainBlock }) {
  const [daysOpen, setDaysOpen] = useState(false);
  const days = block.days || [];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{block.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{block.subtitle}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusClass(block.status)}`}>
            {statusLabel(block.status)}
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-700">{block.message}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Метод: {block.method}</span>
          {block.asOf ? <span>As of: {block.asOf}</span> : null}
          {block.updatedAt ? <span>Обновлено: {block.updatedAt.slice(0, 19).replace("T", " ")}</span> : null}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Метрика</th>
                <th className="px-4 py-3 font-bold">План</th>
                <th className="px-4 py-3 font-bold">Факт</th>
                <th className="px-4 py-3 font-bold">Прогноз</th>
                <th className="px-4 py-3 font-bold">Gap</th>
                <th className="px-4 py-3 font-bold">Статус</th>
              </tr>
            </thead>
            <tbody>
              {block.metrics.length ? (
                block.metrics.map((metric) => (
                  <tr key={metric.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-semibold text-slate-900">{metric.label}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(metric.unit, metric.plan)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(metric.unit, metric.fact)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{formatValue(metric.unit, metric.forecast)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatValue(metric.unit, metric.gapToPlan)}</td>
                    <td className="px-4 py-3 text-xs font-bold uppercase text-slate-500">{metric.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Нет строк для отображения
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {days.length ? (
        <div className="card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
            onClick={() => setDaysOpen((v) => !v)}
            aria-expanded={daysOpen}
          >
            <span>{daysOpen ? "Свернуть дни месяца" : `Развернуть по дням (${days.length})`}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {daysOpen ? "скрыть" : "показать"}
            </span>
          </button>
          {daysOpen ? (
            <div className="table-scroll border-t border-[var(--line)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">День</th>
                    <th className="px-4 py-3 font-bold">Лиды</th>
                    <th className="px-4 py-3 font-bold">Сделки</th>
                    <th className="px-4 py-3 font-bold">Оплаты</th>
                    <th className="px-4 py-3 font-bold">Выручка</th>
                    <th className="px-4 py-3 font-bold">Чек</th>
                    <th className="px-4 py-3 font-bold">CR</th>
                    <th className="px-4 py-3 font-bold">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date} className="border-t border-[var(--line)]">
                      <td className="px-4 py-2 font-semibold text-slate-900">{day.date}</td>
                      <td className="px-4 py-2">{day.leads == null ? "—" : number(day.leads)}</td>
                      <td className="px-4 py-2">{day.deals == null ? "—" : number(day.deals)}</td>
                      <td className="px-4 py-2">{day.payments == null ? "—" : number(day.payments)}</td>
                      <td className="px-4 py-2">{day.paidRevenue == null ? "—" : eur(day.paidRevenue)}</td>
                      <td className="px-4 py-2">{day.averageCheck == null ? "—" : eur(day.averageCheck)}</td>
                      <td className="px-4 py-2">
                        {day.leadToPaymentCr == null ? "—" : pct(day.leadToPaymentCr)}
                      </td>
                      <td className="px-4 py-2 text-xs uppercase text-slate-500">{day.completeness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {block.notes.length ? (
        <ul className="space-y-1 text-xs text-slate-500">
          {block.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PredictiveModelsScreen() {
  const searchParams = useSearchParams();
  const requestedDomain = searchParams.get("domain");
  const [period, setPeriod] = useState<PeriodKey>(currentPeriodKey());
  const [tab, setTab] = useState<PredictiveDomain>(
    requestedDomain === "marketing" || requestedDomain === "finance" ? requestedDomain : "sales"
  );
  const [overview, setOverview] = useState<PredictiveOverview | null>(null);
  const [status, setStatus] = useState<LoadStatus>({ state: "idle", message: "" });

  const load = useCallback(async (nextPeriod: PeriodKey) => {
    setStatus({ state: "loading", message: "Загружаю предиктивные модели…" });
    try {
      const response = await fetch(`/api/predictive/overview?period=${encodeURIComponent(nextPeriod)}`, {
        cache: "no-store"
      });
      const payload = await readJsonResponse<OverviewResponse | { ok: false; error: string }>(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось загрузить обзор");
      }
      setOverview(payload);
      setStatus({ state: "ok", message: "Обновлено" });
    } catch (error) {
      setOverview(null);
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка загрузки"
      });
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [load, period]);

  const active = overview?.domains[tab] ?? null;

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <OfficeHubBackLink />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">Predictive Models</p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950">Предиктивные модели</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Единый кабинет прогнозов: продажи, маркетинг и финансы. Сейчас — план/факт/run-rate без сценариев.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodKey)}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {PERIOD_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={status.state === "loading"}
              onClick={() => void load(period)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={status.state === "loading" ? "animate-spin" : undefined} />
              {status.state === "loading" ? "Обновляю…" : "Обновить"}
            </button>
          </div>
        </div>
        {status.state === "error" ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{status.message}</p>
        ) : null}
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {DOMAIN_TABS.map((item) => {
          const Icon = item.icon;
          const domainStatus = overview?.domains[item.id]?.status;
          const activeTab = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                activeTab
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} />
              {item.label}
              {domainStatus ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    activeTab ? "bg-white/20 text-white" : statusClass(domainStatus)
                  }`}
                >
                  {statusLabel(domainStatus)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {status.state === "loading" && !active ? (
        <p className="text-sm text-slate-500">Загрузка…</p>
      ) : active ? (
        <DomainPanel block={active} />
      ) : (
        <p className="text-sm text-slate-500">Нет данных для выбранного раздела.</p>
      )}
    </main>
  );
}
