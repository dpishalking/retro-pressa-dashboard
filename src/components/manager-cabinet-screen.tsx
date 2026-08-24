"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Banknote, Filter, RefreshCcw, Target, Trophy, UserRound, Wallet } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { currentAnalyticsPeriod } from "@/lib/analytics-os/period";
import { eur, number, pct } from "@/lib/format";
import { canPickCabinetManager } from "@/lib/manager-cabinet/access";
import { cabinetWindowLabel } from "@/lib/manager-cabinet/period";
import type { CabinetWindow, ManagerCabinetPayload } from "@/lib/manager-cabinet/types";
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
  const { user } = useAuth();
  const canPick = canPickCabinetManager(user?.accessLevel);
  const [period, setPeriod] = useState(currentAnalyticsPeriod());
  const [windowKey, setWindowKey] = useState<CabinetWindow>("month");
  const [managerId, setManagerId] = useState("");
  const [payload, setPayload] = useState<ManagerCabinetPayload | null>(null);
  const [status, setStatus] = useState<LoadStatus>({ state: "idle", message: "" });
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
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
      if (canPick && !managerId && data.selected.bitrixUserId) {
        setManagerId(data.selected.bitrixUserId);
      }
      setStatus({ state: "ok", message: "" });
    } catch (error) {
      if (seq !== loadSeq.current) return;
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка загрузки"
      });
    }
  }, [period, windowKey, managerId, canPick]);

  useEffect(() => {
    void load();
  }, [load]);

  const facts = payload?.facts;
  const payroll = payload?.payroll;
  const periods = payload?.availablePeriods?.length ? payload.availablePeriods : [period];

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <OfficeHubBackLink />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-amber-700">Продажи</p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950">
              {canPick ? "Кабинеты менеджеров" : "Мои продажи"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Лиды, сделки и зарплата по факту Bitrix. Оклад пропорционален сменам, процент — с кассы,
              мягкий оклад (чек и сквозная конверсия) считается за полный месяц.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canPick ? (
              <select
                value={managerId || payload?.selected.bitrixUserId || ""}
                onChange={(event) => setManagerId(event.target.value)}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {(payload?.roster || []).map((row) => (
                  <option key={row.bitrixId} value={row.bitrixId}>
                    {row.name}
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
        {payload?.selected.managerName ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserRound size={16} />
            {payload.selected.managerName}
            {payload.windowStart && payload.windowEnd
              ? ` · ${payload.windowStart} — ${payload.windowEnd}`
              : null}
          </p>
        ) : null}
        {status.state === "error" ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {status.message}
          </p>
        ) : null}
        {payload?.message ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {payload.message}
          </p>
        ) : null}
      </header>

      {facts ? (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Взятые лиды" value={number(facts.leads, 0)} hint="без спама, отзывов и junk" />
            <Kpi
              label="В квалификацию"
              value={number(facts.qualifiedLeads, 0)}
              hint={facts.qualifiedCrPct == null ? "лид → сделка" : `CV ${pct(facts.qualifiedCrPct)}`}
            />
            <Kpi
              label="Оплаты"
              value={number(facts.payments, 0)}
              hint={facts.paymentCrPct == null ? "сквозная лид → оплата" : `CV ${pct(facts.paymentCrPct)}`}
            />
            <Kpi
              label="Средний чек"
              value={facts.avgCheckEur == null ? "—" : eur(facts.avgCheckEur)}
              hint={`выручка ${eur(facts.revenueEur)}`}
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
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Оклад за смены</span>
                    <strong>{eur(payload.salaryProratedEur ?? 0)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                      Комиссия {pct(payroll.commissionPct)}
                      {payroll.usedPlanRate ? " (план)" : ""}
                    </span>
                    <strong>{eur(facts.revenueEur * payroll.commissionPct)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Бонус за конверсию</span>
                    <strong>
                      {payload.softBonusesOnFullMonth
                        ? payroll.conversionBonusApplied
                          ? eur(DEFAULT_PAYROLL_PARAMS.conversionBonusEur)
                          : "нет"
                        : "на полном месяце"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Бонус за чек</span>
                    <strong>
                      {payload.softBonusesOnFullMonth
                        ? payroll.checkBonusApplied
                          ? eur(DEFAULT_PAYROLL_PARAMS.checkBonusEur)
                          : "нет"
                        : "на полном месяце"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-3 text-base">
                    <span className="font-bold text-slate-700">К выплате</span>
                    <strong className="text-amber-800">{eur(payroll.mopPayEur)}</strong>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    План {payload.planEur == null ? "не задан" : eur(payload.planEur)}
                    {payload.planProratedEur != null ? ` → на смены ${eur(payload.planProratedEur)}` : ""}.
                    Смены: {payload.shifts.worked ?? "—"} из {payload.shifts.norm}
                    {payload.shifts.matchedName ? ` (${payload.shifts.matchedName})` : ""}.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Недостаточно данных для расчёта.</p>
              )}
            </div>

            <div className="space-y-3">
              <article className="card flex items-start gap-3 p-4">
                <Target size={18} className="mt-0.5 text-sky-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Выручка</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{eur(facts.revenueEur)}</p>
                  <p className="mt-1 text-xs text-slate-500">счета выставлено: {number(facts.invoices, 0)}</p>
                </div>
              </article>
              <article className="card flex items-start gap-3 p-4">
                <Filter size={18} className="mt-0.5 text-sky-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Сквозная CV</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {facts.paymentCrPct == null ? "—" : pct(facts.paymentCrPct)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    порог мягкого оклада {pct(DEFAULT_PAYROLL_PARAMS.conversionPlanPct)}
                  </p>
                </div>
              </article>
              <article className="card flex items-start gap-3 p-4">
                <Banknote size={18} className="mt-0.5 text-emerald-700" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Чек vs план</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {facts.avgCheckEur == null ? "—" : eur(facts.avgCheckEur)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    порог мягкого оклада {eur(DEFAULT_PAYROLL_PARAMS.checkPlanEur)}
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-4">
              <Trophy size={18} className="text-amber-700" />
              <h2 className="text-lg font-black text-slate-950">Проведённые сделки</h2>
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
      ) : status.state === "loading" ? (
        <p className="text-sm text-slate-600">Загружаю кабинет…</p>
      ) : null}
    </main>
  );
}
