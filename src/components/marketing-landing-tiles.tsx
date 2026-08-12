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

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">Эффективность лендингов</h2>
      </div>
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
                <h2 className="text-xl font-black text-slate-950">{landing.siteName}</h2>
                <p className="mt-1 text-sm text-slate-500">{landing.address}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Бюджет</dt>
                    <dd className="mt-1 text-lg font-black text-slate-950">{formatEur(landing.monthlyBudget)}</dd>
                  </div>
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
              </article>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
