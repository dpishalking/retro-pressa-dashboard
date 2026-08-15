"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CohortGrain, CohortRow, SalesCyclePayload } from "@/lib/analytics-os/sales-cycle/types";
import { SLICE_DIMENSIONS, sliceExplorerHref } from "@/lib/analytics-os/slices";
import { StatusBadge } from "@/components/analytics-os/format-metric";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { eur, number, pct } from "@/lib/format";

type CohortTab = "month" | "week";

const TABS: Array<{ id: CohortTab; label: string }> = [
  { id: "month", label: "Месяцы" },
  { id: "week", label: "Недели" }
];

const SLICE_LINKS = SLICE_DIMENSIONS.filter((item) => item.id !== "time" && item.id !== "cohort");

function cr(paid: number, leads: number): number | null {
  if (!leads) return null;
  return paid / leads;
}

function payloadGrain(data: SalesCyclePayload): CohortGrain {
  if (data.cohortGrain === "day" || data.cohortGrain === "week" || data.cohortGrain === "month") {
    return data.cohortGrain;
  }
  const key = data.cohorts.find((row) => row.cohortKey)?.cohortKey || "";
  if (/^\d{4}-W\d{2}$/.test(key)) return "week";
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return "day";
  return "month";
}

function matchesGrain(data: SalesCyclePayload, grain: CohortTab): boolean {
  return payloadGrain(data) === grain;
}

function focusCohort(rows: CohortRow[], period: string): CohortRow | undefined {
  const monthEnd = `${period}-31`;
  return [...rows]
    .reverse()
    .find(
      (row) =>
        row.cohortKey.startsWith(period) ||
        row.cohortStart.startsWith(period) ||
        (row.cohortStart <= monthEnd && row.cohortEnd >= `${period}-01`)
    );
}

function buildCohortDecision(data: SalesCyclePayload): string | null {
  if (!data.cohorts.length) {
    return "В снапшотах Bitrix нет лидов для когорт. Обновите синк Bitrix, затем нажмите «Посчитать».";
  }

  const current = focusCohort(data.cohorts, data.period);
  const mature = data.cohorts.filter(
    (row) => row.ageDays >= 30 && row.leads >= 20 && row.cohortKey !== current?.cohortKey
  );
  const matureCr =
    mature.length > 0
      ? mature.reduce((sum, row) => sum + (cr(row.paid, row.leads) || 0), 0) / mature.length
      : null;
  const currentCr = current ? cr(current.paid, current.leads) : null;
  const cash = data.cashVsCohort;
  const parts: string[] = [];
  if (current && currentCr != null && matureCr != null) {
    const delta = currentCr - matureCr;
    if (delta <= -0.015) {
      parts.push(
        `Когорта ${current.cohortKey} конвертит слабее зрелых: ${pct(currentCr)} против ${pct(matureCr)}. Смотрите оффер и скрипт этой волны, не кассу месяца.`
      );
    } else if (delta >= 0.015) {
      parts.push(
        `Когорта ${current.cohortKey} пока лучше зрелых: ${pct(currentCr)} против ${pct(matureCr)}. Масштабируйте тот же канал и скрипт.`
      );
    } else {
      parts.push(
        `Когорта ${current.cohortKey}: ${number(current.leads)} лидов → ${number(current.paid)} оплат (${pct(currentCr)}). Это рядом со зрелыми (${pct(matureCr)}).`
      );
    }
  } else if (current) {
    parts.push(
      `Когорта ${current.cohortKey}: ${number(current.leads)} лидов, ${number(current.paid)} оплат, ${eur(current.revenue)} выручки. Зрелых когорт для сравнения мало — смотрите D7/D30, когда пройдёт 30 дней.`
    );
  }
  if (payloadGrain(data) === "month" && cash.cashRevenue > 0 && current) {
    const sameMonthCash = cash.fromSelectedCohort;
    const cohortRev = current.revenue;
    parts.push(
      `Касса ${cash.cashPeriod} = ${eur(cash.cashRevenue)}. Из них ${eur(sameMonthCash)} — оплаты этого месяца от лидов ${current.cohortKey}. ` +
        `Выручка когорты ${eur(cohortRev)} — все первые оплаты этих лидов, в том числе если клиент заплатил позже. Это разные срезы, не одна цифра.`
    );
  } else if (payloadGrain(data) === "month" && cash.cashRevenue > 0) {
    parts.push(
      `Касса ${cash.cashPeriod} = ${eur(cash.cashRevenue)}, из них ${eur(cash.fromSelectedCohort)} от лидов этого месяца. Остальное — хвост прошлых когорт.`
    );
  }
  return parts.length ? parts.join(" ") : null;
}

function cohortLoadError(err: unknown): string {
  if (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") {
    return "Расчёт когорт не успел. Нажмите «Посчитать» — прогреем кэш на воркере.";
  }
  const message = err instanceof Error ? err.message : "Ошибка загрузки";
  if (message === "Failed to fetch" || /networkerror/i.test(message)) {
    return "Не удалось связаться с сервером. Нажмите «Посчитать» ещё раз.";
  }
  return message;
}

export function CohortsPanel({
  period,
  managerId,
  country,
  productId
}: {
  period: string;
  managerId?: string;
  country?: string;
  productId?: string;
}) {
  const [tab, setTab] = useState<CohortTab>("month");
  const [data, setData] = useState<SalesCyclePayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const grain = tab === "week" ? "week" : "month";

  const load = useCallback(
    async (refresh = false) => {
      if (!period) {
        setState("loading");
        setError("");
        setData(null);
        return;
      }
      const seq = ++seqRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), refresh ? 120_000 : 90_000);
      setError("");
      if (refresh) setRefreshing(true);
      else setState("loading");
      const params = new URLSearchParams({ period, cohort_grain: grain });
      if (managerId) params.set("managerId", managerId);
      if (country) params.set("country", country);
      if (productId) params.set("productId", productId);
      if (refresh) params.set("refresh", "1");
      try {
        const res = await fetch(`/api/analytics/sales-cycle?${params}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const json = (await res.json()) as SalesCyclePayload & { error?: string };
        if (seq !== seqRef.current) return;
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        if (!matchesGrain(json, grain)) {
          throw new Error("Сервер вернул когорты другого зерна. Нажмите «Повторить».");
        }
        setData(json);
        setState("ready");
      } catch (err: unknown) {
        if (seq !== seqRef.current) return;
        setError(cohortLoadError(err));
        setState("error");
        if (!refresh) setData(null);
      } finally {
        window.clearTimeout(timeout);
        if (seq === seqRef.current) setRefreshing(false);
      }
    },
    [period, grain, managerId, country, productId]
  );

  useEffect(() => {
    void load(false);
    return () => {
      seqRef.current += 1;
      abortRef.current?.abort();
    };
  }, [load]);

  const view = data && matchesGrain(data, grain) ? data : null;
  const current = view ? focusCohort(view.cohorts, view.period) : undefined;
  const decision = view ? buildCohortDecision(view) : null;
  const mini = current
    ? {
        leadLabel: `Лиды когорты ${current.cohortKey}`,
        leads: current.leads,
        paid: current.paid,
        revenue: current.revenue
      }
    : null;

  return (
    <div className="aos-cohorts">
      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Когорты</h2>
            <p>Лид и его продажи в одной когорте · дата создания лида в Bitrix</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state === "loading" || refreshing ? (
              <span className="aos-badge aos-badge--calculated">СЧИТАЮ</span>
            ) : (
              <StatusBadge status={state === "error" ? "no_data" : "calculated"} />
            )}
            <button
              type="button"
              className="aos-link"
              disabled={refreshing || !period || state === "loading"}
              onClick={() => {
                void load(true);
              }}
            >
              {refreshing || state === "loading" ? "Считаю…" : "Посчитать"}
            </button>
          </div>
        </div>

        <div className="aos-unit-kinds" role="tablist" aria-label="Тип когорты">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`aos-unit-kind${tab === item.id ? " is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="aos-slice-jump">
          {SLICE_LINKS.map((item) => (
            <Link
              key={item.id}
              href={sliceExplorerHref({
                dim: item.id,
                period,
                country,
                managerId,
                productId
              })}
              className="aos-slice-detail"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {mini ? (
          <div className="aos-stat-grid">
            <div className="aos-stat">
              <span>{mini.leadLabel}</span>
              <strong>{number(mini.leads)}</strong>
            </div>
            <div className="aos-stat">
              <span>Оплаты</span>
              <strong>{number(mini.paid)}</strong>
            </div>
            <div className="aos-stat">
              <span>Конверсия</span>
              <strong>{cr(mini.paid, mini.leads) == null ? "—" : pct(cr(mini.paid, mini.leads)!)}</strong>
            </div>
            <div className="aos-stat">
              <span>Выручка когорты</span>
              <strong>{eur(mini.revenue)}</strong>
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <p className="aos-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        {!view && state !== "error" ? (
          <p className="aos-muted">{grain === "week" ? "Загрузка недельных когорт…" : "Загрузка когорт…"}</p>
        ) : view ? (
          <TimeCohortTable rows={view.cohorts} grain={payloadGrain(view)} focusPeriod={view.period} />
        ) : null}

        <DecisionBrief body={decision} />
      </section>

      {view && payloadGrain(view) === "month" ? (
        <section className="aos-card">
          <div className="aos-section-head">
            <div>
              <h2>Касса месяца vs когорта лидов</h2>
              <p>
                Касса — все оплаты, которые пришли в {view.cashVsCohort.cashPeriod} (включая повторные).
                «От лидов этого месяца» — только та часть кассы, где лид заведён в этом же месяце. Не
                равна выручке когорты выше: там первые оплаты лидов за любой месяц оплаты.
              </p>
            </div>
          </div>
          <div className="aos-stat-grid">
            <div className="aos-stat">
              <span>Касса месяца</span>
              <strong>{eur(view.cashVsCohort.cashRevenue)}</strong>
            </div>
            <div className="aos-stat">
              <span>От лидов этого месяца</span>
              <strong>{eur(view.cashVsCohort.fromSelectedCohort)}</strong>
            </div>
            <div className="aos-stat">
              <span>От лидов прошлого месяца</span>
              <strong>{eur(view.cashVsCohort.fromPreviousMonth)}</strong>
            </div>
            <div className="aos-stat">
              <span>От более старых лидов</span>
              <strong>{eur(view.cashVsCohort.fromOlder)}</strong>
            </div>
          </div>
        </section>
      ) : view ? (
        <p className="aos-note">Касса месяца — календарный срез. Она на вкладке «Месяцы», не по неделям.</p>
      ) : null}
    </div>
  );
}

function TimeCohortTable({
  rows,
  grain,
  focusPeriod
}: {
  rows: SalesCyclePayload["cohorts"];
  grain: CohortGrain;
  focusPeriod: string;
}) {
  const list = [...rows].reverse().slice(0, grain === "week" ? 24 : 12);
  if (!list.length) {
    return <p className="aos-muted">Нет когорт в снапшотах Bitrix за доступные периоды.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="aos-table">
        <thead>
          <tr>
            <th>{grain === "week" ? "Неделя лида" : "Месяц лида"}</th>
            <th>Лиды</th>
            <th>Оплаты</th>
            <th>Конверсия</th>
            <th>Выручка когорты</th>
            <th>€ / лид</th>
            <th>Доля оплат за 7 дн.</th>
            <th>Доля оплат за 30 дн.</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => {
            const d7 = row.conversion.find((point) => point.id === "D7");
            const d30 = row.conversion.find((point) => point.id === "D30");
            const isFocus = row.cohortKey.startsWith(focusPeriod) || row.cohortStart.startsWith(focusPeriod);
            return (
              <tr key={row.cohortKey}>
                <td>
                  {row.cohortKey}
                  {isFocus ? " · текущая" : ""}
                  {row.ageDays < 30 ? " · открытая" : ""}
                </td>
                <td>{number(row.leads)}</td>
                <td>{number(row.paid)}</td>
                <td>{cr(row.paid, row.leads) == null ? "—" : pct(cr(row.paid, row.leads)!)}</td>
                <td>{eur(row.revenue)}</td>
                <td>{row.revenuePerLead == null ? "—" : eur(row.revenuePerLead)}</td>
                <td>{d7?.matured && d7.value != null ? `${d7.value}%` : "—"}</td>
                <td>{d30?.matured && d30.value != null ? `${d30.value}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
