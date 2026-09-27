"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import type { ArchitectureDepthReport } from "@/lib/architecture-depth/load";
import type { ArchitectureHypothesis, HypothesisStatus } from "@/lib/architecture-depth/hypotheses";
import { number, pct } from "@/lib/format";

type HypothesesPayload = {
  generatedAt: string | null;
  hypotheses: ArchitectureHypothesis[];
};

type LoadResponse = {
  ok: true;
  report: ArchitectureDepthReport;
  hypotheses: HypothesesPayload;
};

const statusOptions: Array<{ id: HypothesisStatus; label: string }> = [
  { id: "new", label: "Новая" },
  { id: "testing", label: "В тесте" },
  { id: "won", label: "Сработала" },
  { id: "miss", label: "Мимо" }
];

function shareLabel(value: number | null) {
  if (value == null) return "—";
  return pct(value);
}

export function ArchitectureDepthScreen({ landingId = "architecture" }: { landingId?: string }) {
  const apiPath = `/api/marketing/landing-depth/${landingId}`;
  const [report, setReport] = useState<ArchitectureDepthReport | null>(null);
  const [hypotheses, setHypotheses] = useState<HypothesesPayload>({ generatedAt: null, hypotheses: [] });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generateStatus, setGenerateStatus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(apiPath, { cache: "no-store" });
      const payload = await readJsonResponse<LoadResponse | { error: string }>(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось загрузить глубину");
      }
      setReport(payload.report);
      setHypotheses(payload.hypotheses);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Не удалось загрузить глубину");
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setGenerateStatus("");
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate" })
      });
      const payload = await readJsonResponse<LoadResponse | { error: string }>(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось собрать гипотезы");
      }
      setReport(payload.report);
      setHypotheses(payload.hypotheses);
      setGenerateStatus("Гипотезы обновлены по последним 7 дням.");
    } catch (error) {
      setGenerateStatus(error instanceof Error ? error.message : "Не удалось собрать гипотезы");
    } finally {
      setGenerating(false);
    }
  }

  async function changeStatus(id: string, status: HypothesisStatus) {
    setStatusBusyId(id);
    setGenerateStatus("");
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "status", id, status })
      });
      const payload = await readJsonResponse<{ ok: true; hypotheses: HypothesesPayload } | { error: string }>(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось сохранить статус");
      }
      setHypotheses(payload.hypotheses);
    } catch (error) {
      setGenerateStatus(error instanceof Error ? error.message : "Не удалось сохранить статус");
    } finally {
      setStatusBusyId(null);
    }
  }

  const week = report?.week;
  const yesterdayById = new Map(report?.yesterday.sections.map((row) => [row.id, row.users]) ?? []);

  return (
    <main className="mx-auto w-[min(1100px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <OfficeHubBackLink />
          <Link href="/marketing" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            ← Маркетинг
          </Link>
        </div>
        <p className="mt-4 text-sm font-extrabold uppercase tracking-normal text-blue-600">{report?.kicker ?? "Лендинг"}</p>
        <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950">Докуда дочитывают</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Воронка блоков {report?.pageUrl ?? "страницы"} за вчера и за 7 дней. Гипотезы собираются по кнопке. На страницу они сами не попадают: изменение выкатываем отдельно и отмечаем статус здесь.
        </p>
      </header>

      {loading ? <p className="text-sm text-slate-600">Загружаю GA4 и Clarity…</p> : null}
      {loadError ? <p className="text-sm text-red-700">{loadError}</p> : null}

      {report && week ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="card p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-950">Блоки страницы</h2>
            <p className="mt-1 text-sm text-slate-600">Человек считается, когда блок появился на экране. Доля — от первого экрана за 7 дней.</p>
            {report.breakdownError ? <p className="mt-3 text-sm text-red-700">{report.breakdownError}</p> : null}
            {report.realtimeSectionViews != null && report.realtimeSectionViews > 0 && (week.sections[0]?.users ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-slate-700">
                В реальном времени уже {number(report.realtimeSectionViews)} просмотров блоков. Пока отчёт GA4 их не разложил по секциям, полоски будут нулевыми.
              </p>
            ) : null}
            <ol className="mt-5 grid gap-3">
              {week.sections.map((row) => {
                const width = Math.max(0, Math.min(100, Math.round((row.shareOfHero ?? 0) * 100)));
                return (
                  <li key={row.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-900">{row.index}. {row.title}</span>
                      <span className="shrink-0 tabular-nums text-slate-700">
                        {number(row.users)} <span className="text-slate-400">/ вчера {number(yesterdayById.get(row.id) ?? 0)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {shareLabel(row.shareOfHero)} от первого экрана
                      {row.dropFromPrevious != null && row.dropFromPrevious > 0.05
                        ? ` · обрыв ${pct(row.dropFromPrevious)}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Кнопка скидки</dt>
                <dd className="font-bold text-slate-950">{number(week.ctaClicks)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Старт формы</dt>
                <dd className="font-bold text-slate-950">{number(week.formStarts)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Заявки</dt>
                <dd className="font-bold text-slate-950">{number(week.formSubmits)}</dd>
              </div>
              {week.productViews > 0 ? (
                <div>
                  <dt className="text-slate-500">Листания подарков</dt>
                  <dd className="font-bold text-slate-950">{number(week.productViews)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-5 border-t border-[var(--line)] pt-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Clarity, 3 дня</p>
              {report.clarity.available ? (
                <p className="mt-1">
                  {number(report.clarity.sessions)} сессий
                  {report.clarity.scrollDepth != null ? ` · глубина ${pct(report.clarity.scrollDepth > 1 ? report.clarity.scrollDepth / 100 : report.clarity.scrollDepth)}` : ""}
                  {` · мёртвые клики ${number(report.clarity.deadClicks)} · быстрые возвраты ${number(report.clarity.quickbackClicks)}`}
                </p>
              ) : (
                <p className="mt-1">{report.clarity.message}</p>
              )}
            </div>
          </section>

          <section className="card p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-950">Гипотезы</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{report.hypothesisNote}</p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              disabled={!report.canHypothesize || generating}
              onClick={() => void generate()}
            >
              {generating ? "Собираю…" : "Собрать гипотезы по 7 дням"}
            </button>
            {generateStatus ? <p className="mt-3 text-sm text-slate-700">{generateStatus}</p> : null}
            {hypotheses.generatedAt ? (
              <p className="mt-3 text-xs text-slate-500">
                Собраны {new Date(hypotheses.generatedAt).toLocaleString("ru-RU")}
              </p>
            ) : null}
            <ol className="mt-4 grid gap-4">
              {hypotheses.hypotheses.map((item, index) => (
                <li key={item.id} className="rounded-2xl border border-[var(--line)] p-3">
                  <p className="text-xs font-bold uppercase tracking-normal text-blue-600">{index + 1}. {item.where}</p>
                  <p className="mt-2 text-sm text-slate-800">{item.fact}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{item.change}</p>
                  <p className="mt-1 text-sm text-slate-600">Смотреть: {item.signal}</p>
                  <label className="mt-3 block text-xs text-slate-500">
                    Статус
                    <select
                      className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                      value={item.status}
                      disabled={statusBusyId === item.id}
                      onChange={(event) => void changeStatus(item.id, event.target.value as HypothesisStatus)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
    </main>
  );
}
