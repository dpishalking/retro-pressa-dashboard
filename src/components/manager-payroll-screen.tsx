"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Trash2 } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { currentAnalyticsPeriod } from "@/lib/analytics-os/period";
import { eur, number, pct } from "@/lib/format";
import { calculatePayrollBoard, deriveRevenueFromPayments } from "@/lib/payroll/calculator";
import { DEFAULT_PAYROLL_PARAMS, DEFAULT_WORKING_DAYS } from "@/lib/payroll/defaults";
import type { ManagerPayrollInput, PayrollManagerFact, PayrollParams } from "@/lib/payroll/types";

type Mode = "bitrix" | "manual";

type FactsResponse = {
  ok: true;
  period: string;
  availablePeriods: string[];
  managers: PayrollManagerFact[];
};

function emptyManager(index: number): ManagerPayrollInput {
  return {
    id: `manual-${index}`,
    name: `Менеджер №${index}`,
    revenueEur: null,
    leads: null,
    workingDays: DEFAULT_WORKING_DAYS,
    invoiceCrPct: 0.25,
    paymentCrPct: null,
    avgCheckEur: null,
    payments: null
  };
}

function factToInput(fact: PayrollManagerFact): ManagerPayrollInput {
  return {
    id: fact.id,
    name: fact.name,
    revenueEur: fact.revenueEur,
    leads: fact.leads,
    workingDays: DEFAULT_WORKING_DAYS,
    invoiceCrPct: null,
    paymentCrPct: fact.paymentCrPct,
    avgCheckEur: fact.avgCheckEur,
    payments: fact.paidOrders
  };
}

function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".").replace("%", "").replace("€", "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function ParamField({
  label,
  value,
  onChange,
  suffix,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-900"
        />
        {suffix ? <span className="text-xs font-bold text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function ManagerPayrollScreen() {
  const [mode, setMode] = useState<Mode>("manual");
  const [period, setPeriod] = useState(currentAnalyticsPeriod());
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([currentAnalyticsPeriod()]);
  const [params, setParams] = useState<PayrollParams>(DEFAULT_PAYROLL_PARAMS);
  const [managers, setManagers] = useState<ManagerPayrollInput[]>([
    emptyManager(1),
    emptyManager(2),
    emptyManager(3),
    emptyManager(4)
  ]);
  const [status, setStatus] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>({
    state: "idle",
    message: ""
  });

  const loadBitrix = useCallback(async (nextPeriod: string) => {
    setStatus({ state: "loading", message: "Загружаю факты из Bitrix…" });
    try {
      const response = await fetch(`/api/payroll/managers?period=${encodeURIComponent(nextPeriod)}`, {
        cache: "no-store"
      });
      const payload = await readJsonResponse<FactsResponse | { error: string }>(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось загрузить менеджеров");
      }
      const periods = payload.availablePeriods?.length
        ? payload.availablePeriods
        : [payload.period || currentAnalyticsPeriod()];
      setAvailablePeriods(periods);
      if (payload.period) setPeriod(payload.period);
      setManagers(
        payload.managers.length
          ? payload.managers.map(factToInput)
          : [emptyManager(1), emptyManager(2)]
      );
      setStatus({
        state: "ok",
        message: payload.managers.length
          ? `Загружено менеджеров: ${payload.managers.length}`
          : "В снимке нет менеджеров — можно ввести вручную"
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка загрузки"
      });
    }
  }, []);

  useEffect(() => {
    if (mode === "bitrix") {
      void loadBitrix(period);
    }
  }, [mode, period, loadBitrix]);

  const normalizedManagers = useMemo(
    () =>
      managers.map((manager) => {
        const derived = deriveRevenueFromPayments(
          manager.payments ??
            (manager.leads != null && manager.paymentCrPct != null
              ? manager.leads * manager.paymentCrPct
              : null),
          manager.avgCheckEur
        );
        return {
          ...manager,
          revenueEur: manager.revenueEur ?? derived
        };
      }),
    [managers]
  );

  const board = useMemo(
    () => calculatePayrollBoard(params, normalizedManagers),
    [params, normalizedManagers]
  );

  function updateManager(id: string, patch: Partial<ManagerPayrollInput>) {
    setManagers((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateParam<K extends keyof PayrollParams>(key: K, raw: string, asPct = false) {
    if (key === "salesPlanEur") {
      const value = parseNumberInput(raw);
      setParams((prev) => ({ ...prev, salesPlanEur: value }));
      return;
    }
    const value = parseNumberInput(raw);
    if (value == null) return;
    setParams((prev) => ({ ...prev, [key]: asPct ? value / 100 : value }));
  }

  const editable = mode === "manual";

  return (
    <main className="mx-auto w-[min(1400px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <OfficeHubBackLink />
          <Link href="/sales" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            ← К продажам
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">Продажи</p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950">Зарплаты менеджеров</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Слева — условия мотивации. Справа — просчёт по менеджерам: факт Bitrix или ручной сценарий.
              План продаж по умолчанию пустой.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-[var(--line)] bg-white p-1">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${
                  mode === "manual" ? "bg-slate-900 text-white" : "text-slate-700"
                }`}
              >
                Ручной
              </button>
              <button
                type="button"
                onClick={() => setMode("bitrix")}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${
                  mode === "bitrix" ? "bg-slate-900 text-white" : "text-slate-700"
                }`}
              >
                Bitrix
              </button>
            </div>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {availablePeriods.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            {mode === "bitrix" ? (
              <button
                type="button"
                onClick={() => void loadBitrix(period)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <RefreshCcw size={16} className={status.state === "loading" ? "animate-spin" : undefined} />
                Обновить
              </button>
            ) : null}
          </div>
        </div>
        {status.state === "error" ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {status.message}
          </p>
        ) : null}
        {status.state === "ok" && mode === "bitrix" ? (
          <p className="mt-4 text-sm text-slate-600">{status.message}</p>
        ) : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-black text-slate-950">Мотивация</h2>
          <ParamField
            label="Оклад"
            value={String(params.salaryEur)}
            onChange={(raw) => updateParam("salaryEur", raw)}
            suffix="€"
          />
          <ParamField
            label="Бонус с продаж"
            value={String(Math.round(params.salesBonusPct * 1000) / 10)}
            onChange={(raw) => updateParam("salesBonusPct", raw, true)}
            suffix="%"
          />
          <ParamField
            label="Выполнение плана"
            value={String(Math.round(params.planBonusPct * 1000) / 10)}
            onChange={(raw) => updateParam("planBonusPct", raw, true)}
            suffix="%"
          />
          <ParamField
            label="Бонус за конверсию"
            value={String(params.conversionBonusEur)}
            onChange={(raw) => updateParam("conversionBonusEur", raw)}
            suffix="€"
          />
          <ParamField
            label="Бонус за средний чек"
            value={String(params.checkBonusEur)}
            onChange={(raw) => updateParam("checkBonusEur", raw)}
            suffix="€"
          />
          <ParamField
            label="План продаж"
            value={params.salesPlanEur == null ? "" : String(params.salesPlanEur)}
            onChange={(raw) => updateParam("salesPlanEur", raw)}
            suffix="€"
            placeholder="пусто = без плана"
          />
          <ParamField
            label="План конверсии"
            value={String(Math.round(params.conversionPlanPct * 1000) / 10)}
            onChange={(raw) => updateParam("conversionPlanPct", raw, true)}
            suffix="%"
          />
          <ParamField
            label="План чека"
            value={String(params.checkPlanEur)}
            onChange={(raw) => updateParam("checkPlanEur", raw)}
            suffix="€"
          />
          <ParamField
            label="РОП %"
            value={String(Math.round(params.ropPct * 1000) / 10)}
            onChange={(raw) => updateParam("ropPct", raw, true)}
            suffix="%"
          />
          <ParamField
            label="РОП оклад"
            value={String(params.ropSalaryEur)}
            onChange={(raw) => updateParam("ropSalaryEur", raw)}
            suffix="€"
          />

          <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Доход</span>
              <strong>{eur(board.totals.incomeEur)}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Расход</span>
              <strong>{eur(board.totals.expenseEur)}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">ИТОГО ФОТ ОП</span>
              <strong>{board.totals.fotShare == null ? "—" : pct(board.totals.fotShare)}</strong>
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Если выручка выше плана продаж — вместо бонуса с продаж берётся ставка выполнения плана (не
            суммируются). Пустой план = всегда ставка «бонус с продаж».
          </p>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">Просчёт по менеджерам</h2>
            {editable ? (
              <button
                type="button"
                onClick={() =>
                  setManagers((prev) => [...prev, emptyManager(prev.length + 1)])
                }
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <Plus size={16} />
                Добавить
              </button>
            ) : null}
          </div>

          <div className="table-scroll rounded-xl border border-[var(--line)] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-bold">Показатель</th>
                  {board.managers.map((row) => (
                    <th key={row.id} className="px-3 py-3 font-bold">
                      <div className="flex items-center gap-2">
                        {editable ? (
                          <input
                            value={managers.find((item) => item.id === row.id)?.name ?? row.name}
                            onChange={(event) => updateManager(row.id, { name: event.target.value })}
                            className="w-36 rounded-lg border border-[var(--line)] px-2 py-1 text-sm font-bold text-slate-900"
                          />
                        ) : (
                          <span className="font-bold text-slate-900 normal-case">{row.name}</span>
                        )}
                        {editable && managers.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Удалить"
                            onClick={() => setManagers((prev) => prev.filter((item) => item.id !== row.id))}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Выручка €", "revenueEur", "eur"],
                    ["Лидов", "leads", "count"],
                    ["Лидов/день", "leadsPerDay", "calc"],
                    ["CV счёт", "invoiceCrPct", "pct"],
                    ["Счетов", "invoices", "calc"],
                    ["CV оплата", "paymentCrPct", "pct"],
                    ["Оплат", "payments", "count"],
                    ["Чек €", "avgCheckEur", "eur"],
                    ["Оплата", "mopPayEur", "calc-eur"],
                    ["% от выручки моп", "mopShareOfRevenue", "calc-pct"],
                    ["РОП", "ropEur", "calc-eur"],
                    ["ИТОГО", "totalEur", "calc-eur"],
                    ["% от выручки итого", "totalShareOfRevenue", "calc-pct"]
                  ] as const
                ).map(([label, key, kind]) => (
                  <tr key={label} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 font-semibold text-slate-700">{label}</td>
                    {board.managers.map((row) => {
                      const source = managers.find((item) => item.id === row.id);
                      if (kind === "calc" || kind === "calc-eur" || kind === "calc-pct") {
                        const value = row[key as keyof typeof row] as number | null;
                        const display =
                          kind === "calc-eur"
                            ? eur(value ?? 0)
                            : kind === "calc-pct"
                              ? value == null
                                ? "—"
                                : pct(value)
                              : value == null
                                ? "—"
                                : number(value, key === "leadsPerDay" ? 1 : 0);
                        return (
                          <td key={row.id} className="px-3 py-2 font-semibold text-slate-950">
                            {display}
                            {key === "mopPayEur" && row.usedPlanRate ? (
                              <span className="ml-2 text-[10px] font-bold uppercase text-amber-700">план</span>
                            ) : null}
                          </td>
                        );
                      }

                      const raw =
                        key === "revenueEur"
                          ? source?.revenueEur
                          : key === "leads"
                            ? source?.leads
                            : key === "invoiceCrPct"
                              ? source?.invoiceCrPct
                              : key === "paymentCrPct"
                                ? source?.paymentCrPct
                                : key === "payments"
                                  ? source?.payments
                                  : source?.avgCheckEur;

                      if (!editable) {
                        const display =
                          kind === "pct"
                            ? raw == null
                              ? "—"
                              : pct(raw)
                            : kind === "eur"
                              ? raw == null
                                ? "—"
                                : eur(raw)
                              : raw == null
                                ? "—"
                                : number(raw, 0);
                        return (
                          <td key={row.id} className="px-3 py-2 text-slate-800">
                            {display}
                          </td>
                        );
                      }

                      return (
                        <td key={row.id} className="px-3 py-2">
                          <input
                            value={
                              raw == null
                                ? ""
                                : kind === "pct"
                                  ? String(Math.round(raw * 1000) / 10)
                                  : String(raw)
                            }
                            onChange={(event) => {
                              const parsed = parseNumberInput(event.target.value);
                              if (key === "revenueEur") updateManager(row.id, { revenueEur: parsed });
                              if (key === "leads") updateManager(row.id, { leads: parsed });
                              if (key === "invoiceCrPct")
                                updateManager(row.id, {
                                  invoiceCrPct: parsed == null ? null : parsed / 100
                                });
                              if (key === "paymentCrPct")
                                updateManager(row.id, {
                                  paymentCrPct: parsed == null ? null : parsed / 100
                                });
                              if (key === "payments") updateManager(row.id, { payments: parsed });
                              if (key === "avgCheckEur") updateManager(row.id, { avgCheckEur: parsed });
                            }}
                            className="w-28 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-semibold text-slate-900"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
