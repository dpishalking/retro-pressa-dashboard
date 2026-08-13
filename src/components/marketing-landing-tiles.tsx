"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readJsonResponse } from "@/lib/api-response";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { eur, pct } from "@/lib/format";
import { metricLabel } from "@/lib/analytics-os/metric-glossary";
import type { LandingEfficiencySummary } from "@/lib/landings/types";
import type { ContractorBook } from "@/lib/landings/contractor-books";

type SummaryResponse = {
  ok: true;
  period: string;
  isoMonth: string;
  landings: LandingEfficiencySummary[];
};

type BooksResponse = {
  ok: true;
  books: ContractorBook[];
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
  const [books, setBooks] = useState<ContractorBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);

  const loadLandings = useCallback(async () => {
    const response = await fetch(`/api/landings/efficiency?period=${encodeURIComponent(period)}`, {
      cache: "no-store"
    });
    const payload = await readJsonResponse<SummaryResponse | { ok: false; error: string }>(response);
    if (!response.ok || !("ok" in payload) || payload.ok !== true) {
      throw new Error("error" in payload ? payload.error : "Не удалось загрузить лендинги");
    }
    setLandings(payload.landings);
  }, [period]);

  const loadBooks = useCallback(async () => {
    const response = await fetch("/api/landings/sources", { cache: "no-store" });
    const payload = await readJsonResponse<BooksResponse | { ok: false; error: string }>(response);
    if (!response.ok || !("ok" in payload) || payload.ok !== true) {
      throw new Error("error" in payload ? payload.error : "Не удалось загрузить таблицы");
    }
    setBooks(payload.books);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadLandings(), loadBooks()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLandings, loadBooks]);

  async function connectSheet() {
    const url = sheetUrl.trim();
    if (!url || addBusy) return;
    setAddBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/landings/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url })
      });
      const payload = await readJsonResponse<
        { ok: true; landingCount: number; alreadyConnected?: boolean } | { ok: false; error: string }
      >(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось подключить таблицу");
      }
      setSheetUrl("");
      setAdding(false);
      await Promise.all([loadBooks(), loadLandings()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка подключения");
    } finally {
      setAddBusy(false);
    }
  }

  async function disconnectBook(id: string) {
    if (removeBusyId) return;
    setRemoveBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/landings/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await readJsonResponse<{ ok: true } | { ok: false; error: string }>(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось отключить таблицу");
      }
      await Promise.all([loadBooks(), loadLandings()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setRemoveBusyId(null);
    }
  }

  const board = useMemo(() => {
    if (!landings?.length) return null;
    const d7 = landings.map((row) => row.roasD7).filter((v): v is number => v != null && Number.isFinite(v));
    const d30 = landings.map((row) => row.roasD30).filter((v): v is number => v != null && Number.isFinite(v));
    return {
      medianRoasD7: median(d7),
      medianRoasD30: median(d30),
      matureD7: landings.some((row) => row.roasD7Mature),
      matureD30: landings.some((row) => row.roasD30Mature)
    };
  }, [landings]);

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Эффективность лендингов</h2>
          <p className="mt-1 text-sm text-slate-600">
            CPL и ROAS с листов подрядчиков того же формата, что ALX. {metricLabel("roas_d7")} /{" "}
            {metricLabel("roas_d30")} — накопительный ROAS месяца к 7-му и 30-му дню, не cohort payback.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
          onClick={() => setAdding(true)}
        >
          Добавить таблицу
        </button>
      </div>

      {adding ? (
        <form
          className="mb-4 rounded-xl border border-[var(--line)] bg-white p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void connectSheet();
          }}
        >
          <p className="mb-2 text-sm text-slate-600">
            Вставьте ссылку на Google Таблицу подрядчика. Вкладки должны быть URL лендингов — как в ALX.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              className="min-w-[260px] flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
            />
            <button
              type="submit"
              disabled={addBusy || !sheetUrl.trim()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {addBusy ? "Подключаю…" : "Подключить"}
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm font-semibold text-slate-600"
              onClick={() => {
                setAdding(false);
                setSheetUrl("");
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}

      {books.length ? (
        <ul className="mb-4 flex flex-wrap gap-2">
          {books.map((book) => (
            <li
              key={book.id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            >
              <a href={book.url} target="_blank" rel="noreferrer" className="hover:underline">
                {book.title}
              </a>
              {book.seeded ? null : (
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-700"
                  disabled={removeBusyId === book.id}
                  onClick={() => void disconnectBook(book.id)}
                >
                  {removeBusyId === book.id ? "…" : "×"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {board ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
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
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {landing.sourceLabel || "ALX"}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{landing.title}</h2>
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
