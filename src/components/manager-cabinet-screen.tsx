"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Banknote, BookOpen, Filter, Lightbulb, RefreshCcw, Sparkles, Target, Trophy, UserRound, Wallet } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { currentAnalyticsPeriod } from "@/lib/analytics-os/period";
import { eur, number } from "@/lib/format";
import { canPickCabinetManager } from "@/lib/manager-cabinet/access";
import { cabinetWindowLabel } from "@/lib/manager-cabinet/period";
import { firstCabinetManagerId } from "@/lib/manager-cabinet/resolve-target";
import type { CabinetWindow, ManagerCabinetPayload, ManagerCoachPayload } from "@/lib/manager-cabinet/types";
import { DEFAULT_PAYROLL_PARAMS } from "@/lib/payroll/defaults";
import { useAuth } from "@/components/auth-provider";

type LoadStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

function Kpi({
  label,
  value,
  hint,
  accent
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <article className={`card p-4 ${accent ? "border-amber-200 bg-amber-50/50" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-amber-800" : "text-slate-950"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </article>
  );
}

export function ManagerCabinetScreen() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const denied = searchParams.get("denied") === "1";
  const [period, setPeriod] = useState(currentAnalyticsPeriod());
  const [windowKey, setWindowKey] = useState<CabinetWindow>("month");
  const [managerId, setManagerId] = useState("");
  const [payload, setPayload] = useState<ManagerCabinetPayload | null>(null);
  const [coach, setCoach] = useState<ManagerCoachPayload | null>(null);
  const [status, setStatus] = useState<LoadStatus>({ state: "idle", message: "" });
  const [coachStatus, setCoachStatus] = useState<LoadStatus>({ state: "idle", message: "" });
  const loadSeq = useRef(0);
  const coachSeq = useRef(0);
  const canPick = canPickCabinetManager(payload?.viewer.accessLevel ?? user?.accessLevel);

  const load = useCallback(async () => {
    if (loading) return;
    const seq = ++loadSeq.current;
    setStatus({ state: "loading", message: "Считаю показатели из Bitrix…" });
    try {
      const params = new URLSearchParams({ period, window: windowKey });
      if (canPick && managerId) params.set("managerId", managerId);
      const response = await fetch(`/api/me/cabinet?${params.toString()}`, { cache: "no-store" });
      const data = await readJsonResponse<ManagerCabinetPayload | { error: string }>(response);
      if (seq !== loadSeq.current) return;
      if (!response.ok || !("ok" in data) || data.ok !== true) {
        throw new Error("error" in data ? data.error : "Не удалось загрузить кабинет");
      }
      setPayload(data);
      if (data.period) setPeriod(data.period);
      const picker = canPickCabinetManager(data.viewer.accessLevel);
      if (picker && !managerId) {
        const nextId = firstCabinetManagerId(data.roster, data.selected.bitrixUserId);
        if (nextId) setManagerId(nextId);
      }
      setStatus({ state: "ok", message: "" });
    } catch (error) {
      if (seq !== loadSeq.current) return;
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка загрузки"
      });
    }
  }, [period, windowKey, managerId, canPick, loading]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCoach = useCallback(async () => {
    if (loading) return;
    const seq = ++coachSeq.current;
    setCoachStatus({ state: "loading", message: "Смотрю вчерашние чаты…" });
    try {
      const params = new URLSearchParams();
      if (canPick && managerId) params.set("managerId", managerId);
      const query = params.toString();
      const response = await fetch(query ? `/api/me/coach?${query}` : "/api/me/coach", { cache: "no-store" });
      const data = await readJsonResponse<ManagerCoachPayload | { error: string }>(response);
      if (seq !== coachSeq.current) return;
      if (!response.ok || !("ok" in data) || data.ok !== true) {
        throw new Error("error" in data ? data.error : "Не удалось разобрать чаты");
      }
      setCoach(data);
      setCoachStatus({ state: "ok", message: "" });
    } catch (error) {
      if (seq !== coachSeq.current) return;
      setCoachStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка разбора"
      });
    }
  }, [canPick, managerId, loading]);

  useEffect(() => {
    void loadCoach();
  }, [loadCoach]);

  const facts = payload?.facts;
  const payroll = payload?.payroll;
  const periods = payload?.availablePeriods?.length ? payload.availablePeriods : [period];
  const selectedBitrixId = managerId || payload?.selected.bitrixUserId || "";
  const selectedLabel =
    payload?.roster.find((row) => row.bitrixId === selectedBitrixId)?.name ||
    (payload?.linked ? payload.selected.managerName : null);
  const hideStaleUnlinked =
    canPick && payload != null && !payload.linked && payload.roster.length > 0;
  const banner = hideStaleUnlinked ? null : payload?.message;

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <OfficeHubBackLink />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-amber-700">
              {canPick ? "Продажи" : "Твой кабинет"}
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950">
              {canPick ? "Кабинеты менеджеров" : `Привет, ${payload?.helloName || user?.name.split(/\s+/)[0] || "коллега"}`}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {canPick
                ? "Лиды, сделки и зарплата по факту Bitrix. Оклад пропорционален сменам, процент — с кассы, мягкий оклад считается за полный месяц."
                : "Здесь только твои заявки, оплаты и зарплата. Вчерашние чаты разбираем простыми словами: что вышло и что сказать точнее."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canPick ? (
              <select
                value={selectedBitrixId}
                onChange={(event) => setManagerId(event.target.value)}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {selectedBitrixId ? null : (
                  <option value="" disabled>
                    Менеджер
                  </option>
                )}
                {(payload?.roster || []).map((row) => (
                  <option key={row.bitrixId} value={row.bitrixId}>
                    {row.name}
                    {row.activeRoster ? "" : " · архив"}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {periods.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-xl border border-[var(--line)] bg-white p-1">
              {(["h1", "h2", "month"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWindowKey(key)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${
                    windowKey === key ? "bg-slate-900 text-white" : "text-slate-700"
                  }`}
                >
                  {cabinetWindowLabel(key)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={status.state === "loading"}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={status.state === "loading" ? "animate-spin" : undefined} />
              {status.state === "loading" ? "Считаю…" : "Обновить"}
            </button>
          </div>
        </div>
        {canPick && payload?.roster.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {payload.roster
              .filter((row) => row.activeRoster)
              .map((row) => (
                <button
                  key={row.bitrixId}
                  type="button"
                  onClick={() => setManagerId(row.bitrixId)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    selectedBitrixId === row.bitrixId
                      ? "bg-slate-900 text-white"
                      : "border border-[var(--line)] bg-white text-slate-700"
                  }`}
                >
                  {row.firstName || row.name}
                </button>
              ))}
          </div>
        ) : null}
        {selectedLabel ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserRound size={16} />
            {selectedLabel}
            {payload?.windowStart && payload.windowEnd
              ? ` · ${payload.windowStart} — ${payload.windowEnd}`
              : null}
          </p>
        ) : null}
        {denied ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            У твоего аккаунта нет доступа к тому разделу. Здесь — твои продажи.
          </p>
        ) : null}
        {status.state === "error" ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {status.message}
          </p>
        ) : null}
        {banner ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {banner}
          </p>
        ) : null}
      </header>

      <section className="card mb-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-700" />
            <h2 className="text-lg font-black text-slate-950">Вчерашние чаты</h2>
          </div>
          <Link href="/training/knowledge-base" className="inline-flex items-center gap-1 text-sm font-bold text-sky-700">
            <BookOpen size={14} />
            Шпаргалки
          </Link>
        </div>
        {coachStatus.state === "loading" ? (
          <p className="text-sm text-slate-600">Смотрю, что вчера можно было сказать точнее…</p>
        ) : null}
        {coachStatus.state === "error" ? (
          <p className="text-sm text-amber-800">{coachStatus.message}</p>
        ) : null}
        {coach?.review.emptyHint ? <p className="text-sm leading-6 text-slate-600">{coach.review.emptyHint}</p> : null}
        {coach?.review.headline ? <p className="text-sm font-semibold leading-6 text-slate-800">{coach.review.headline}</p> : null}
        {coach?.review.good.length ? (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Получилось</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
              {coach.review.good.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {coach?.review.better.length ? (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Можно было точнее</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
              {coach.review.better.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {coach?.review.tryToday ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800">
              <Lightbulb size={14} />
              На сегодня
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-800">{coach.review.tryToday}</p>
          </div>
        ) : null}
        {coach?.review.day && !coach.review.emptyHint ? (
          <p className="mt-3 text-xs text-slate-500">Разбор за {coach.review.day}. Чатов: {coach.review.dialogs}.</p>
        ) : null}
      </section>

      {facts ? (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Заявки" value={number(facts.leads, 0)} hint="без спама и отзывов" />
            <Kpi
              label="Дошли до сделки"
              value={number(facts.qualifiedLeads, 0)}
              hint={facts.qualifiedCrPct == null ? "из заявок" : `${Math.round(facts.qualifiedCrPct * 100)} из 100`}
            />
            <Kpi
              label="Купили"
              value={number(facts.payments, 0)}
              hint={facts.paymentCrPct == null ? "оплатили" : `${Math.round(facts.paymentCrPct * 100)} из 100 заявок`}
            />
            <Kpi
              label="Средний чек"
              value={facts.avgCheckEur == null ? "—" : eur(facts.avgCheckEur)}
              hint={`всего принесли ${eur(facts.revenueEur)}`}
              accent
            />
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Wallet size={18} className="text-amber-700" />
                <h2 className="text-lg font-black text-slate-950">Зарплата</h2>
              </div>
              {payroll ? (
                <div className="space-y-3 text-sm">
                  {(payload.payTips || []).map((tip) => (
                    <div key={tip.title}>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{tip.title}</p>
                      <p className="mt-1 leading-6 text-slate-700">{tip.text}</p>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-3 text-base">
                    <span className="font-bold text-slate-700">К выплате</span>
                    <strong className="text-amber-800">{eur(payroll.mopPayEur)}</strong>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Недостаточно данных для расчёта.</p>
              )}
            </div>

            <div className="space-y-3">
              <article className="card flex items-start gap-3 p-4">
                <Target size={18} className="mt-0.5 text-sky-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Касса</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{eur(facts.revenueEur)}</p>
                  <p className="mt-1 text-xs text-slate-500">оплатили {number(facts.payments, 0)}</p>
                </div>
              </article>
              <article className="card flex items-start gap-3 p-4">
                <Filter size={18} className="mt-0.5 text-sky-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Сколько покупают</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {facts.paymentCrPct == null ? "—" : `${Math.round(facts.paymentCrPct * 100)} из 100`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    бонус с {Math.round(DEFAULT_PAYROLL_PARAMS.conversionPlanPct * 100)} из 100
                  </p>
                </div>
              </article>
              <article className="card flex items-start gap-3 p-4">
                <Banknote size={18} className="mt-0.5 text-emerald-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Чек</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {facts.avgCheckEur == null ? "—" : eur(facts.avgCheckEur)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    бонус с {eur(DEFAULT_PAYROLL_PARAMS.checkPlanEur)}
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-4">
              <Trophy size={18} className="text-amber-700" />
              <h2 className="text-lg font-black text-slate-950">Кто уже купил</h2>
            </div>
            {facts.deals.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-600">За выбранный период оплаченных счетов нет.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Счёт</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facts.deals.map((deal) => (
                      <tr key={deal.id}>
                        <td>{deal.date || "—"}</td>
                        <td>{deal.title}</td>
                        <td>{eur(deal.amountEur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : status.state === "loading" || loading ? (
        <p className="text-sm text-slate-600">Загружаю кабинет…</p>
      ) : null}
    </main>
  );
}
