"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/api-response";
import type { FunnelSummary } from "@/lib/marketing/funnel-types";

export function MarketingFunnelTiles() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<FunnelSummary[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/marketing/funnels", { cache: "no-store" });
        const payload = await readJsonResponse<{ ok: true; funnels: FunnelSummary[] } | { ok: false; error: string }>(
          response
        );
        if (!response.ok || !("ok" in payload) || payload.ok !== true) {
          throw new Error("error" in payload ? payload.error : "Не удалось загрузить воронки");
        }
        if (!cancelled) setFunnels(payload.funnels);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createFunnel() {
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/marketing/funnels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: name, stage: "Воронка" })
      });
      const payload = await readJsonResponse<{ ok: true; funnel: FunnelSummary } | { ok: false; error: string }>(
        response
      );
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось создать воронку");
      }
      router.push(`/marketing/funnels/${payload.funnel.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Воронки</h2>
          <p className="mt-1 text-sm text-slate-600">Откройте доску и соберите шаги, стикеры и стрелки.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
          onClick={() => setCreating(true)}
        >
          Добавить воронку
        </button>
      </div>

      {creating ? (
        <form
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-white p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createFunnel();
          }}
        >
          <input
            autoFocus
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            placeholder="Название воронки"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Создаю…" : "Создать и открыть"}
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm font-semibold text-slate-600"
            onClick={() => {
              setCreating(false);
              setTitle("");
            }}
          >
            Отмена
          </button>
        </form>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {!funnels && !error ? <p className="text-sm text-slate-500">Загружаю воронки…</p> : null}

      {funnels?.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {funnels.map((funnel) => (
            <Link
              key={funnel.id}
              href={`/marketing/funnels/${funnel.id}`}
              className="block rounded-xl border border-[var(--line)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{funnel.stage}</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">{funnel.title}</h3>
              {funnel.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{funnel.description}</p> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
