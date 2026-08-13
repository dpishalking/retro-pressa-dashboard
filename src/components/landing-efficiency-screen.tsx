"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { eur, number, pct } from "@/lib/format";
import type { LandingEfficiencyDay, LandingEfficiencyTotals } from "@/lib/landings/load-landing-efficiency";
import { alxLandingDisplayName } from "@/config/alx-landings";
import { sheetsUrlForLanding } from "@/lib/landings/contractor-books";
import { PERIOD_KEYS, type PeriodKey } from "@/types/metrics";

type LoadStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

type EfficiencyResponse = {
  ok: true;
  period: string;
  isoMonth: string;
  landing: {
    id: string;
    siteName: string;
    address: string;
    tag: string;
    sheetTitle: string;
    gid: number;
    spreadsheetId?: string;
    sourceLabel?: string;
  };
  sheetTotals: LandingEfficiencyTotals;
  monthTotals: LandingEfficiencyTotals;
  days: LandingEfficiencyDay[];
  notes: string[];
};

function formatRoas(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatEur(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return eur(value, digits);
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return pct(value);
}

function Kpi({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

export function LandingEfficiencyScreen({ landingId }: { landingId: string }) {
  const [period, setPeriod] = useState<PeriodKey>(currentPeriodKey());
  const [data, setData] = useState<EfficiencyResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>({ state: "idle", message: "" });

  const load = useCallback(
    async (nextPeriod: PeriodKey) => {
      setStatus({ state: "loading", message: "Загружаю эффективность лендинга…" });
      try {
        const qs = new URLSearchParams({ id: landingId, period: nextPeriod });
        const response = await fetch(`/api/landings/efficiency?${qs.toString()}`, { cache: "no-store" });
        const payload = await readJsonResponse<EfficiencyResponse | { ok: false; error: string }>(response);
        if (!response.ok || !("ok" in payload) || payload.ok !== true) {
          throw new Error("error" in payload ? payload.error : "Не удалось загрузить данные");
        }
        setData(payload);
        setStatus({ state: "ok", message: "Обновлено" });
      } catch (error) {
        setData(null);
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : "Ошибка загрузки"
        });
      }
    },
    [landingId]
  );

  useEffect(() => {
    void load(period);
  }, [load, period]);

  const m = data?.monthTotals;

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <OfficeHubBackLink />
          <Link href="/marketing" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            ← Маркетинг
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">Эффективность лендинга</p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950">
              {data?.landing ? alxLandingDisplayName(data.landing) : landingId}
            </h1>
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

      {status.state === "loading" && !data ? (
        <p className="text-sm text-slate-500">Загрузка…</p>
      ) : data && m ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Бюджет месяца" value={formatEur(m.spend)} hint="расход MTD с листа подрядчика" />
            <Kpi label="Выручка MTD" value={formatEur(m.revenue)} hint="заказы € с листа подрядчика" />
            <Kpi label="ROAS лендинга" value={formatRoas(m.roas)} hint="выручка / расход за месяц" />
            <Kpi
              label="ROAS D7"
              value={m.roasD7Mature ? formatRoas(m.roasD7) : "—"}
              hint={m.roasD7Mature ? "накопительный ROAS дней 1–7" : "окно D7 ещё не закрыто"}
            />
            <Kpi
              label="ROAS D30"
              value={m.roasD30Mature ? formatRoas(m.roasD30) : "—"}
              hint={m.roasD30Mature ? "накопительный ROAS дней 1–30" : "окно D30 ещё не закрыто"}
            />
            <Kpi label="CPL лендинга" value={formatEur(m.cpl, 1)} hint="расход / лиды CRM листа" />
            <Kpi label="CPQL" value={formatEur(m.cpql, 1)} hint="расход / квал. лиды" />
            <Kpi label="Лиды CRM" value={m.leads == null ? "—" : number(m.leads)} />
            <Kpi label="Квал. лиды" value={m.qualifiedLeads == null ? "—" : number(m.qualifiedLeads)} />
            <Kpi label="Заказы" value={m.orders == null ? "—" : number(m.orders)} hint={`CR в продажу: ${formatPct(m.saleCr)}`} />
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Дни месяца · {data.isoMonth}</h2>
            </div>
            <div className="table-scroll">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-bold">День</th>
                    <th className="px-3 py-3 font-bold">Расход</th>
                    <th className="px-3 py-3 font-bold">Выручка</th>
                    <th className="px-3 py-3 font-bold">ROAS</th>
                    <th className="px-3 py-3 font-bold">Лиды</th>
                    <th className="px-3 py-3 font-bold">Квал.</th>
                    <th className="px-3 py-3 font-bold">CPL</th>
                    <th className="px-3 py-3 font-bold">CPQL</th>
                    <th className="px-3 py-3 font-bold">Заказы</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.length ? (
                    data.days.map((day) => (
                      <tr key={day.date} className="border-t border-[var(--line)]">
                        <td className="px-3 py-2 font-semibold text-slate-900">{day.date}</td>
                        <td className="px-3 py-2">{formatEur(day.spend)}</td>
                        <td className="px-3 py-2">{formatEur(day.revenue)}</td>
                        <td className="px-3 py-2">{formatRoas(day.roas)}</td>
                        <td className="px-3 py-2">{day.leads == null ? "—" : number(day.leads)}</td>
                        <td className="px-3 py-2">{day.qualifiedLeads == null ? "—" : number(day.qualifiedLeads)}</td>
                        <td className="px-3 py-2">{formatEur(day.cpl, 1)}</td>
                        <td className="px-3 py-2">{formatEur(day.cpql, 1)}</td>
                        <td className="px-3 py-2">{day.orders == null ? "—" : number(day.orders)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Нет дневных строк за выбранный месяц
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/marketing" className="font-bold text-blue-600 hover:underline">
              ← Все лендинги
            </Link>
            <a
              href={sheetsUrlForLanding(data.landing)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-slate-600 hover:underline"
            >
              Открыть лист в Sheets →
            </a>
          </div>

          {data.notes.length ? (
            <ul className="space-y-1 text-xs text-slate-500">
              {data.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
