"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readJsonResponse } from "@/lib/api-response";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { eur, pct } from "@/lib/format";
import type { LandingEfficiencySummary } from "@/lib/landings/types";

type SummaryResponse = {
  ok: true;
  period: string;
  isoMonth: string;
  landings: LandingEfficiencySummary[];
};

function formatEur(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return eur(value);
}

function formatRoas(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return pct(value);
}

export function MarketingLandingTiles() {
  const period = currentPeriodKey();
  const [landings, setLandings] = useState<LandingEfficiencySummary[] | null>(null);
  const [isoMonth, setIsoMonth] = useState<string>("");
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
        if (!cancelled) {
          setLandings(payload.landings);
          setIsoMonth(payload.isoMonth);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">Эффективность лендингов</h2>
        <p className="mt-1 text-sm text-slate-600">
          Зелёная точка — есть данные за {isoMonth || "текущий период"}, красная — нет данных.
          CPL, окупаемость (ROAS) и конверсия лендинга.
        </p>
      </div>
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {!landings && !error ? <p className="text-sm text-slate-500">Загружаю метрики лендингов…</p> : null}
      {landings ? (
        <div className="grid gap-4 md:grid-cols-2">
          {landings.map((landing) => (
            <Link key={landing.id} href={landing.href} className="block h-full">
              <article className="card flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">{landing.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{landing.url}</p>
                  </div>
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold text-slate-600"
                    title={landing.hasData ? `В работе · ${landing.daysWithData} дн. с данными` : "Нет данных за период"}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${landing.hasData ? "bg-emerald-500" : "bg-red-500"}`}
                      aria-hidden
                    />
                    {landing.hasData ? "в работе" : "нет данных"}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">CPL</dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatEur(landing.cpl)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Окупаемость</dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatRoas(landing.roas)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Конверсия</dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatPct(landing.landingCr)}</dd>
                  </div>
                </dl>
                <p className="mt-5 text-sm font-bold text-blue-600">Открыть →</p>
              </article>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
