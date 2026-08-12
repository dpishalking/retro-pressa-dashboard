"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readJsonResponse } from "@/lib/api-response";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { eur, pct } from "@/lib/format";
import { metricLabel } from "@/lib/analytics-os/metric-glossary";
import type { LandingEfficiencySummary } from "@/lib/landings/types";

type SummaryResponse = {
  ok: true;
  period: string;
  isoMonth: string;
  landings: LandingEfficiencySummary[];
};

function formatEur(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return eur(value, digits);
}

function formatRoas(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return pct(value);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function MarketingLandingTiles() {
  const period = currentPeriodKey();
  const [landings, setLandings] = useState<LandingEfficiencySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/landings/efficiency?period=${encodeURIComponent(period)}`, {
          cache: "no-store"
        });
        const payload = await readJsonResponse<SummaryResponse | { ok: false; error: string }>(response);
        if (!response.ok || !("ok" in payload) || payload.ok !== true) {
          throw new Error("error" in payload ? payload.error : "Не удалось загрузить лендинги");
        }
        if (!cancelled) setLandings(payload.landings);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const board = useMemo(() => {
    if (!landings?.length) return null;
    const d7 = landings.map((row) => row.roasD7).filter((v): v is number => v != null && Number.isFinite(v));
    const d30 = landings.map((row) => row.roasD30).filter((v): v is number => v != null && Number.isFinite(v));
    const cpl = landings.map((row) => row.cpl).filter((v): v is number => v != null && Number.isFinite(v));
    return {
      medianRoasD7: median(d7),
      medianRoasD30: median(d30),
      medianCpl: median(cpl),
      matureD7: landings.some((row) => row.roasD7Mature),
      matureD30: landings.some((row) => row.roasD30Mature)
    };
  }, [landings]);

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">Эффективность лендингов</h2>
        <p className="mt-1 text-sm text-slate-600">
          CPL и ROAS с листов ALX. {metricLabel("roas_d7")} / {metricLabel("roas_d30")} — накопительный ROAS
          месяца к 7-му и 30-му дню, не cohort payback.
        </p>
      </div>

      {board ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Медиана {metricLabel("landing_cpl")}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">{formatEur(board.medianCpl, 1)}</p>
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Медиана {metricLabel("roas_d7")}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {board.matureD7 ? formatRoas(board.medianRoasD7) : "—"}
            </p>
            {!board.matureD7 ? (
              <p className="mt-1 text-xs text-slate-500">Окно D7 ещё не закрыто</p>
            ) : null}
          </article>
          <article className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Медиана {metricLabel("roas_d30")}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {board.matureD30 ? formatRoas(board.medianRoasD30) : "—"}
            </p>
            {!board.matureD30 ? (
              <p className="mt-1 text-xs text-slate-500">Окно D30 ещё не закрыто</p>
            ) : null}
          </article>
        </div>
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {!landings && !error ? <p className="text-sm text-slate-500">Загружаю метрики лендингов…</p> : null}
      {landings?.length === 0 ? (
        <p className="text-sm text-slate-500">Нет лендингов с данными за текущий период.</p>
      ) : null}
      {landings?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {landings.map((landing) => (
            <Link key={landing.id} href={landing.href} className="block h-full">
              <article className="card flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <h2 className="text-xl font-black text-slate-950">{landing.title}</h2>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Бюджет</dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatEur(landing.monthlyBudget)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {metricLabel("landing_cpl")}
                    </dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatEur(landing.cpl, 1)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {metricLabel("landing_roas")}
                    </dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatRoas(landing.roas)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {metricLabel("roas_d7")}
                    </dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">
                      {landing.roasD7Mature ? formatRoas(landing.roasD7) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {metricLabel("roas_d30")}
                    </dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">
                      {landing.roasD30Mature ? formatRoas(landing.roasD30) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">CR лендинга</dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatPct(landing.landingCr)}</dd>
                  </div>
                </dl>
              </article>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
