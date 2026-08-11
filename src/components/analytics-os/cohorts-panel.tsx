"use client";

import { useEffect, useState } from "react";
import type { SalesCyclePayload } from "@/lib/analytics-os/sales-cycle";
import { StatusBadge } from "@/components/analytics-os/format-metric";
import { eur, number, pct } from "@/lib/format";

type CohortTab = "month" | "week" | "country";

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
  }
];

const NEXT_IDEAS = [
  "Менеджер — чьи лиды быстрее и чаще доходят до оплаты",
  "Источник / канал — форма, WhatsApp, реклама, органика",
  "Продукт первой оплаты — что реально покупают из когорты",
  "Тип подарка — оригинал, репродукция, поздравительная",
  "Новый vs повторный клиент — повторные продажи по когорте входа",
  "Платный vs органический лид — окупаемость рекламы по когорте"
];

function cr(paid: number, leads: number): number | null {
  if (!leads) return null;
  return paid / leads;
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

  const grain = tab === "week" ? "week" : "month";
  const tabMeta = TABS.find((item) => item.id === tab)!;

  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    setState("loading");
    const params = new URLSearchParams({ period, cohort_grain: grain });
    if (managerId) params.set("managerId", managerId);
    if (country) params.set("country", country);
    if (productId) params.set("productId", productId);
    fetch(`/api/analytics/sales-cycle?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        if (!cancelled) {
          setData(json);
          setState("ready");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка");
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period, grain, managerId, country, productId]);

  if (state === "error") {
    return (
      <section className="aos-card aos-card--warn">
        <p className="aos-error">{error}</p>
      </section>
    );
  }

  return (
    <div className="aos-cohorts">
      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Когорты</h2>
            <p>Лид и его продажи в одной когорте · дата создания лида в Bitrix</p>
          </div>
          <StatusBadge status={state === "ready" ? "calculated" : "manual"} />
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

        {!data || state === "loading" ? (
          <p className="aos-muted">Загрузка когорт…</p>
        ) : tab === "country" ? (
          <CountryTable rows={data.breakdowns.countries} />
        ) : (
          <TimeCohortTable rows={data.cohorts} grain={tab} />
        )}
      </section>

      {data && tab !== "country" ? (
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

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Ещё варианты когорт</h2>
            <p>Можно добавить следующим шагом — логика та же: вход в когорту + продажи по ней</p>
          </div>
        </div>
        <ul className="aos-cohort-ideas">
          {NEXT_IDEAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TimeCohortTable({
  rows,
  grain
}: {
  rows: SalesCyclePayload["cohorts"];
  grain: "month" | "week";
}) {
  const list = [...rows].reverse().slice(0, grain === "week" ? 24 : 12);
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
            const d7 = row.conversion.find((p) => p.id === "D7");
            const d30 = row.conversion.find((p) => p.id === "D30");
            return (
              <tr key={row.cohortKey}>
                <td>{row.cohortKey}</td>
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

function CountryTable({ rows }: { rows: SalesCyclePayload["breakdowns"]["countries"] }) {
  return (
    <div className="table-scroll">
      <table className="aos-table">
        <thead>
          <tr>
            <th>Страна</th>
            <th>Лиды</th>
            <th>Оплаты</th>
            <th>Конверсия</th>
            <th>Выручка</th>
            <th>€ / лид</th>
            <th>Медиана до оплаты</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label === "—" ? "Не указана" : row.label}</td>
              <td>{number(row.leads)}</td>
              <td>{number(row.paid)}</td>
              <td>{cr(row.paid, row.leads) == null ? "—" : pct(cr(row.paid, row.leads)!)}</td>
              <td>{eur(row.revenue)}</td>
              <td>{row.revenuePerLead == null ? "—" : eur(row.revenuePerLead)}</td>
              <td>{row.medianLeadToWonDays == null ? "—" : `${row.medianLeadToWonDays} дн.`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
