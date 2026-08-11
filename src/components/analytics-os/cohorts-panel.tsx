"use client";

import { useEffect, useState } from "react";
import type { BreakdownRow, SalesCyclePayload } from "@/lib/analytics-os/sales-cycle/types";
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    setState("loading");
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
        if (!cancelled) {
          const message =
            err instanceof DOMException && err.name === "AbortError"
              ? "Таймаут загрузки когорт (90с). Нужен прогрев: POST /api/sync/sales-cycle"
              : err instanceof Error
                ? err.message
                : "Ошибка";
          setError(message);
          setState("error");
        }
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

  if (state === "error") {
    return (
      <section className="aos-card aos-card--warn">
        <p className="aos-error">{error}</p>
      </section>
    );
  }

  const breakdownRows = data ? breakdownForTab(data, tab) : null;

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
        ) : breakdownRows ? (
          <BreakdownTable
            rows={breakdownRows}
            nameHeader={tabMeta.label}
            leadHeader={tab === "product" || tab === "gift" ? "Первые оплаты" : "Лиды"}
          />
        ) : (
          <TimeCohortTable rows={data.cohorts} grain={tab === "week" ? "week" : "month"} />
        )}
        <DecisionBrief
          body={
            data
              ? "Когорта отвечает: «лиды этой волны сколько уже принесли?» Не путайте с кассой месяца. Если когорта слабая — чините скрипт и оффер той недели/канала, а не общий план."
              : null
          }
        />
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
          <DecisionBrief
            body={
              data.cashVsCohort.cashRevenue > 0
                ? `Касса месяца ≠ когорта лидов: из ${eur(data.cashVsCohort.cashRevenue)} только ${eur(data.cashVsCohort.fromSelectedCohort)} от лидов этого месяца. Остальное — хвост прошлых лидов. Не смешивайте эти цифры в одном плане.`
                : null
            }
          />
        </section>
      ) : null}
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
