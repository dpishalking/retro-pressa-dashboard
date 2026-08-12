"use client";

import { useCallback, useEffect, useState } from "react";
import type { BreakdownRow, CohortRow, SalesCyclePayload } from "@/lib/analytics-os/sales-cycle/types";
import { StatusBadge } from "@/components/analytics-os/format-metric";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { eur, number, pct } from "@/lib/format";

type CohortTab =
  | "month"
  | "week"
  | "country"
  | "manager"
  | "channel"
  | "product"
  | "gift"
  | "customer"
  | "traffic";

const TABS: Array<{ id: CohortTab; label: string; hint: string }> = [
  {
    id: "month",
    label: "Месяцы",
    hint: "Когорта = месяц, когда лид завели в Bitrix. Продажи этого лида остаются в той же когорте."
  },
  {
    id: "week",
    label: "Недели",
    hint: "Когорта = неделя создания лида. Оплаты этого лида считаются в той же недельной когорте."
  },
  {
    id: "country",
    label: "Страны",
    hint: "По каждой стране: сколько лидов завели и сколько из них дошли до оплаты."
  },
  {
    id: "manager",
    label: "Менеджер",
    hint: "Чьи лиды быстрее и чаще доходят до оплаты — вход в когорту по ответственному на лиде."
  },
  {
    id: "channel",
    label: "Источник / канал",
    hint: "Форма, WhatsApp, реклама, органика и другие каналы входа лида."
  },
  {
    id: "product",
    label: "Продукт первой оплаты",
    hint: "Что реально купили при первой оплате из когорты (среди оплативших)."
  },
  {
    id: "gift",
    label: "Тип подарка",
    hint: "Оригинал, репродукция, поздравительная и другие типы по первой оплате."
  },
  {
    id: "customer",
    label: "Новый / повторный",
    hint: "Новый клиент — первая оплата контакта. Повторный — уже был платёж раньше."
  },
  {
    id: "traffic",
    label: "Платный / органика",
    hint: "Платный vs органический лид по UTM и источнику Bitrix — для оценки окупаемости когорты."
  }
];

function cr(paid: number, leads: number): number | null {
  if (!leads) return null;
  return paid / leads;
}

function breakdownForTab(data: SalesCyclePayload, tab: CohortTab): BreakdownRow[] | null {
  switch (tab) {
    case "country":
      return data.breakdowns.countries;
    case "manager":
      return data.breakdowns.managers;
    case "channel":
      return data.breakdowns.channels;
    case "product":
      return data.breakdowns.products;
    case "gift":
      return data.breakdowns.gifts;
    case "customer":
      return data.breakdowns.customers;
    case "traffic":
      return data.breakdowns.traffic;
    default:
      return null;
  }
}

function focusCohort(rows: CohortRow[], period: string): CohortRow | undefined {
  return [...rows].reverse().find((row) => row.cohortKey.startsWith(period) || row.cohortStart.startsWith(period));
}

function buildCohortDecision(data: SalesCyclePayload, tab: CohortTab): string | null {
  if (!data.cohorts.length && (tab === "month" || tab === "week")) {
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

  if (tab === "month" || tab === "week") {
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
    if (cash.cashRevenue > 0) {
      parts.push(
        `Касса ${cash.cashPeriod} = ${eur(cash.cashRevenue)}, из них ${eur(cash.fromSelectedCohort)} от лидов этого месяца. Остальное — хвост прошлых когорт. Не смешивайте эти цифры в одном плане.`
      );
    }
    return parts.length ? parts.join(" ") : null;
  }

  const rows = breakdownForTab(data, tab) || [];
  const ranked = rows.filter((row) => row.leads >= 15 && cr(row.paid, row.leads) != null);
  if (ranked.length < 2) {
    return current
      ? `Разрез «${TABS.find((item) => item.id === tab)?.label}»: мало строк с объёмом. Смотрите таблицу и сравнивайте с месячной когортой ${current.cohortKey}.`
      : null;
  }
  const byCr = [...ranked].sort((a, b) => (cr(b.paid, b.leads) || 0) - (cr(a.paid, a.leads) || 0));
  const best = byCr[0];
  const worst = byCr[byCr.length - 1];
  return `Лучше: ${best.label} — ${pct(cr(best.paid, best.leads)!)} с ${number(best.leads)} лидов. Слабее: ${worst.label} — ${pct(cr(worst.paid, worst.leads)!)}. Тяните скрипт и трафик к сильному сегменту, слабый разберите отдельно.`;
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

  const grain = tab === "week" ? "week" : "month";
  const tabMeta = TABS.find((item) => item.id === tab)!;

  const load = useCallback(
    async (refresh = false) => {
      if (!period) return;
      const controller = new AbortController();
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
        const res = await fetch(`/api/analytics/sales-cycle?${params}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        setData(json);
        setState("ready");
      } catch (err: unknown) {
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "Таймаут загрузки когорт. Нажмите «Посчитать» — прогреем кэш на воркере."
            : err instanceof Error
              ? err.message
              : "Ошибка";
        setError(message);
        setState((current) => (current === "ready" ? "ready" : "error"));
      } finally {
        window.clearTimeout(timeout);
        setRefreshing(false);
      }
    },
    [period, grain, managerId, country, productId]
  );

  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    setState("loading");
    setError("");
    const params = new URLSearchParams({ period, cohort_grain: grain });
    if (managerId) params.set("managerId", managerId);
    if (country) params.set("country", country);
    if (productId) params.set("productId", productId);
    fetch(`/api/analytics/sales-cycle?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        if (!cancelled) {
          setData(json);
          setState("ready");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "Таймаут загрузки когорт. Нажмите «Посчитать» — прогреем кэш на воркере."
            : err instanceof Error
              ? err.message
              : "Ошибка";
        setError(message);
        setState("error");
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [period, grain, managerId, country, productId]);

  const breakdownRows = data ? breakdownForTab(data, tab) : null;
  const current = data ? focusCohort(data.cohorts, data.period) : undefined;
  const decision = data ? buildCohortDecision(data, tab) : null;

  return (
    <div className="aos-cohorts">
      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Когорты</h2>
            <p>Лид и его продажи в одной когорте · дата создания лида в Bitrix</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={state === "ready" ? "calculated" : state === "error" ? "no_data" : "partial"} />
            <button
              type="button"
              className="aos-link"
              disabled={refreshing || !period}
              onClick={() => void load(true)}
            >
              {refreshing ? "Считаю…" : "Посчитать"}
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

        <p className="aos-note" style={{ marginTop: 0 }}>
          {tabMeta.hint}
        </p>

        {data && current ? (
          <div className="aos-stat-grid">
            <div className="aos-stat">
              <span>Лиды когорты {current.cohortKey}</span>
              <strong>{number(current.leads)}</strong>
            </div>
            <div className="aos-stat">
              <span>Оплаты</span>
              <strong>{number(current.paid)}</strong>
            </div>
            <div className="aos-stat">
              <span>Конверсия</span>
              <strong>{cr(current.paid, current.leads) == null ? "—" : pct(cr(current.paid, current.leads)!)}</strong>
            </div>
            <div className="aos-stat">
              <span>Выручка когорты</span>
              <strong>{eur(current.revenue)}</strong>
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <p className="aos-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        {!data && state !== "error" ? (
          <p className="aos-muted">Загрузка когорт…</p>
        ) : data && breakdownRows ? (
          <BreakdownTable
            rows={breakdownRows}
            nameHeader={tabMeta.label}
            leadHeader={tab === "product" || tab === "gift" ? "Первые оплаты" : "Лиды"}
          />
        ) : data ? (
          <TimeCohortTable
            rows={data.cohorts}
            grain={tab === "week" ? "week" : "month"}
            focusPeriod={data.period}
          />
        ) : null}

        <DecisionBrief body={decision} />
      </section>

      {data && (tab === "month" || tab === "week") ? (
        <section className="aos-card">
          <div className="aos-section-head">
            <div>
              <h2>Касса месяца vs когорта лидов</h2>
              <p>
                Касса — оплаты, которые пришли в {data.cashVsCohort.cashPeriod}. Когорта — оплаты от
                лидов, заведённых в этом месяце (даже если оплата позже).
              </p>
            </div>
          </div>
          <div className="aos-stat-grid">
            <div className="aos-stat">
              <span>Касса месяца</span>
              <strong>{eur(data.cashVsCohort.cashRevenue)}</strong>
            </div>
            <div className="aos-stat">
              <span>От лидов этого месяца</span>
              <strong>{eur(data.cashVsCohort.fromSelectedCohort)}</strong>
            </div>
            <div className="aos-stat">
              <span>От лидов прошлого месяца</span>
              <strong>{eur(data.cashVsCohort.fromPreviousMonth)}</strong>
            </div>
            <div className="aos-stat">
              <span>От более старых лидов</span>
              <strong>{eur(data.cashVsCohort.fromOlder)}</strong>
            </div>
          </div>
        </section>
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
  grain: "month" | "week";
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

function BreakdownTable({
  rows,
  nameHeader,
  leadHeader
}: {
  rows: BreakdownRow[];
  nameHeader: string;
  leadHeader: string;
}) {
  return (
    <div className="table-scroll">
      <table className="aos-table">
        <thead>
          <tr>
            <th>{nameHeader}</th>
            <th>{leadHeader}</th>
            <th>Оплаты</th>
            <th>Конверсия</th>
            <th>Выручка</th>
            <th>€ / лид</th>
            <th>Медиана до оплаты</th>
            <th>CR 7д</th>
            <th>CR 30д</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label === "—" ? "Не указан" : row.label}</td>
                <td>{number(row.leads)}</td>
                <td>{number(row.paid)}</td>
                <td>{cr(row.paid, row.leads) == null ? "—" : pct(cr(row.paid, row.leads)!)}</td>
                <td>{eur(row.revenue)}</td>
                <td>{row.revenuePerLead == null ? "—" : eur(row.revenuePerLead)}</td>
                <td>{row.medianLeadToWonDays == null ? "—" : `${row.medianLeadToWonDays} дн.`}</td>
                <td>{row.d7Cr == null ? "—" : `${row.d7Cr}%`}</td>
                <td>{row.d30Cr == null ? "—" : `${row.d30Cr}%`}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="aos-muted">
                Нет строк для этой когорты
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
