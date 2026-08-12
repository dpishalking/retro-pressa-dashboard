"use client";

import { useEffect, useState } from "react";
import type { SalesCyclePayload } from "@/lib/analytics-os/sales-cycle";
import { StatusBadge } from "@/components/analytics-os/format-metric";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";

function eur(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function fmt(value: number | null | undefined, suffix = "") {
  if (value == null) return "—";
  return `${value}${suffix}`;
}

function MaturityCells({ points }: { points: Array<{ id: string; value: number | null; matured: boolean }> }) {
  return (
    <>
      {points.map((point) => (
        <td key={point.id}>{point.matured && point.value != null ? `${point.value}%` : "—"}</td>
      ))}
    </>
  );
}

export function SalesCyclePanel({
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
  const [grain, setGrain] = useState<"day" | "week" | "month">("day");
  const [data, setData] = useState<SalesCyclePayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
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

  if (!data) {
    return (
      <section className="aos-card">
        <p className="aos-muted">Загрузка цикла сделки…</p>
      </section>
    );
  }

  const s = data.summary;
  const cash = data.cashVsCohort;

  return (
    <div className="aos-sales-cycle">
      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Цикл сделки и зрелость когорты</h2>
            <p>
              Lead → WON (elapsed hours) · timezone {data.timezone} · {s.statusNote}
            </p>
          </div>
          <div className="aos-sales-cycle__grain">
            <StatusBadge status="partial" />
            <label>
              Зерно когорты
              <select value={grain} onChange={(e) => setGrain(e.target.value as typeof grain)}>
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
              </select>
            </label>
          </div>
        </div>

        <div className="aos-kpi-grid">
          <div className="aos-kpi">
            <span>Median Lead → WON</span>
            <strong>{fmt(s.medianLeadToWonDays, " дн.")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Average</span>
            <strong>{fmt(s.averageLeadToWonDays, " дн.")}</strong>
          </div>
          <div className="aos-kpi">
            <span>P75</span>
            <strong>{fmt(s.p75LeadToWonDays, " дн.")}</strong>
          </div>
          <div className="aos-kpi">
            <span>P90</span>
            <strong>{fmt(s.p90LeadToWonDays, " дн.")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Median Deal → WON</span>
            <strong>{fmt(s.medianDealToWonDays, " дн.")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Direct Lead Join</span>
            <strong>{fmt(s.directJoinCoverage, "%")}</strong>
          </div>
        </div>
        <DecisionBrief
          body={
            s.medianLeadToWonDays != null
              ? `Медиана Lead→оплата ≈ ${s.medianLeadToWonDays} дн. Ускоряйте ответ и дожим на ранних стадиях — каждый лишний день раздувает хвост кассы.`
              : null
          }
        />
      </section>

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Касса vs когорта — {cash.cashPeriod}</h2>
            <p>Cash = оплаты в месяце · Cohort = оплаты от лидов месяца</p>
          </div>
        </div>
        <div className="aos-kpi-grid">
          <div className="aos-kpi">
            <span>Касса месяца</span>
            <strong>{eur(cash.cashRevenue)}</strong>
          </div>
          <div className="aos-kpi">
            <span>От когорты месяца</span>
            <strong>{eur(cash.fromSelectedCohort)}</strong>
          </div>
          <div className="aos-kpi">
            <span>От прошлого месяца</span>
            <strong>{eur(cash.fromPreviousMonth)}</strong>
          </div>
          <div className="aos-kpi">
            <span>От более старых / unmatched</span>
            <strong>{eur(cash.fromOlder)}</strong>
          </div>
          <div className="aos-kpi">
            <span>Lead CR D7</span>
            <strong>{fmt(s.createdLeadCrD7, "%")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Lead CR D30</span>
            <strong>{fmt(s.createdLeadCrD30, "%")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Unique Lead CR</span>
            <strong>{fmt(s.uniqueLeadCr, "%")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Уник. лиды месяца</span>
            <strong>
              {s.uniqueLeadsInPeriod}/{s.cohortLeadsInPeriod}
            </strong>
          </div>
        </div>
        <p className="aos-note">{s.statusNote}</p>
      </section>

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Paid Customer Maturity</h2>
            <p>Из оплативших с Lead→WON: какая доля закрылась к возрасту (не CR по лидам)</p>
          </div>
        </div>
        <div className="aos-maturity-row">
          {s.paidCustomerMaturity.map((point) => (
            <div key={point.id} className="aos-maturity-chip">
              <span>{point.id}</span>
              <strong>{point.value != null ? `${point.value}%` : "—"}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Распределение Lead → WON</h2>
            <p>Buckets по elapsed hours</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Сделки</th>
                <th>Доля</th>
                <th>Выручка</th>
                <th>Доля €</th>
              </tr>
            </thead>
            <tbody>
              {data.cycleDistribution.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.count}</td>
                  <td>{fmt(row.sharePct, "%")}</td>
                  <td>{eur(row.revenue)}</td>
                  <td>{fmt(row.revenueSharePct, "%")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Текущая когорта vs бенчмарк</h2>
            <p>Created Lead CR · сравнение со зрелыми когортами</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Checkpoint</th>
                <th>Текущая</th>
                <th>История</th>
                <th>Δ pp</th>
              </tr>
            </thead>
            <tbody>
              {data.currentVsBenchmark.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.matured ? fmt(row.current, "%") : "—"}</td>
                  <td>{fmt(row.historical, "%")}</td>
                  <td>{row.deltaPp == null ? "—" : `${row.deltaPp > 0 ? "+" : ""}${row.deltaPp}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="aos-muted" style={{ marginTop: "0.75rem" }}>
          Forecast: {data.forecast.message}
          {data.forecast.estimatedD30Revenue != null ? ` → ~${eur(data.forecast.estimatedD30Revenue)} к D30` : ""}
        </p>
      </section>

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Когортная таблица (Conversion Maturity)</h2>
            <p>Несозревшие ячейки = «—», не ноль</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cohort</th>
                <th>Leads</th>
                <th>Paid</th>
                <th>Revenue</th>
                <th>€/Lead</th>
                <th>D0</th>
                <th>D1</th>
                <th>D3</th>
                <th>D7</th>
                <th>D14</th>
                <th>D30</th>
              </tr>
            </thead>
            <tbody>
              {[...data.cohorts].reverse().slice(0, 31).map((row) => {
                const pts = ["D0", "D1", "D3", "D7", "D14", "D30"].map(
                  (id) => row.conversion.find((p) => p.id === id) || { id, value: null, matured: false }
                );
                return (
                  <tr key={row.cohortKey}>
                    <td>{row.cohortKey}</td>
                    <td>{row.leads}</td>
                    <td>{row.paid}</td>
                    <td>{eur(row.revenue)}</td>
                    <td>{fmt(row.revenuePerLead)}</td>
                    <MaturityCells points={pts} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Матрица: когорта лида × месяц оплаты</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lead cohort</th>
                <th>Payment month</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueCohortMatrix.map((cell) => (
                <tr key={`${cell.leadCohortMonth}-${cell.paymentMonth}`}>
                  <td>{cell.leadCohortMonth}</td>
                  <td>{cell.paymentMonth}</td>
                  <td>{cell.orders}</td>
                  <td>{eur(cell.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(
        [
          ["Менеджеры", data.breakdowns.managers],
          ["Продукты", data.breakdowns.products],
          ["Страны", data.breakdowns.countries],
          ["Источники", data.breakdowns.sources]
        ] as const
      ).map(([title, rows]) => (
        <section className="aos-card" key={title}>
          <div className="aos-section-head">
            <div>
              <h2>{title}</h2>
              <p>Median cycle · CR · Revenue/Lead</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{title}</th>
                  <th>Leads</th>
                  <th>Paid</th>
                  <th>Median L→W</th>
                  <th>D7 CR</th>
                  <th>D14 CR</th>
                  <th>€/Lead</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.leads}</td>
                    <td>{row.paid}</td>
                    <td>{fmt(row.medianLeadToWonDays, " дн.")}</td>
                    <td>{fmt(row.d7Cr, "%")}</td>
                    <td>{fmt(row.d14Cr, "%")}</td>
                    <td>{fmt(row.revenuePerLead)}</td>
                    <td>{eur(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Качество join</h2>
          </div>
        </div>
        <div className="aos-kpi-grid">
          <div className="aos-kpi">
            <span>High (lead_id)</span>
            <strong>{fmt(data.dataQuality.highConfidencePct, "%")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Medium (contact)</span>
            <strong>{fmt(data.dataQuality.mediumConfidencePct, "%")}</strong>
          </div>
          <div className="aos-kpi">
            <span>Unmatched</span>
            <strong>{fmt(data.dataQuality.unmatchedPct, "%")}</strong>
          </div>
          <div className="aos-kpi">
            <span>WON matched</span>
            <strong>
              {data.dataQuality.matchedWon}/{data.dataQuality.totalWon}
            </strong>
          </div>
        </div>
        <ul className="aos-muted" style={{ marginTop: "0.75rem" }}>
          {data.dataQuality.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type CeoCycleCard = {
  medianLeadToWonDays: number | null;
  paidCustomerMaturity: Array<{ id: string; value: number | null }>;
  createdLeadCrD7: number | null;
  createdLeadCrD30: number | null;
  cashVsCohort: {
    cashRevenue: number;
    fromSelectedCohort: number;
    fromPreviousMonth: number;
    fromOlder: number;
  };
  coverage: number | null;
  asOf: string;
};

export function SalesCycleCeoCard({ period }: { period: string }) {
  const [card, setCard] = useState<CeoCycleCard | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/sales-cycle?period=${encodeURIComponent(period)}&cohort_grain=month`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || json.error) return;
        setCard({
          medianLeadToWonDays: json.summary?.medianLeadToWonDays ?? null,
          paidCustomerMaturity: json.summary?.paidCustomerMaturity ?? [],
          createdLeadCrD7: json.summary?.createdLeadCrD7 ?? null,
          createdLeadCrD30: json.summary?.createdLeadCrD30 ?? null,
          cashVsCohort: {
            cashRevenue: json.cashVsCohort?.cashRevenue ?? 0,
            fromSelectedCohort: json.cashVsCohort?.fromSelectedCohort ?? 0,
            fromPreviousMonth: json.cashVsCohort?.fromPreviousMonth ?? 0,
            fromOlder: json.cashVsCohort?.fromOlder ?? 0
          },
          coverage: json.summary?.directJoinCoverage ?? null,
          asOf: json.asOf
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (!card) return null;

  return (
    <section className="aos-card">
      <div className="aos-section-head">
        <div>
          <h2>Цикл сделки</h2>
          <p>Median Lead → WON · касса vs когорта</p>
        </div>
        <a className="aos-link" href="/os/sales-cycle">
          Открыть цикл сделки →
        </a>
      </div>
      <div className="aos-kpi-grid">
        <div className="aos-kpi">
          <span>Median Lead → WON</span>
          <strong>{fmt(card.medianLeadToWonDays, " дн.")}</strong>
        </div>
        <div className="aos-kpi">
          <span>Касса</span>
          <strong>{eur(card.cashVsCohort.cashRevenue)}</strong>
        </div>
        <div className="aos-kpi">
          <span>Когорта месяца</span>
          <strong>{eur(card.cashVsCohort.fromSelectedCohort)}</strong>
        </div>
        <div className="aos-kpi">
          <span>Хвост (прошлый+)</span>
          <strong>{eur(card.cashVsCohort.fromPreviousMonth + card.cashVsCohort.fromOlder)}</strong>
        </div>
      </div>
      <div className="aos-maturity-row" style={{ marginTop: "0.75rem" }}>
        {card.paidCustomerMaturity.map((point) => (
          <div key={point.id} className="aos-maturity-chip">
            <span>{point.id}</span>
            <strong title="Paid Customer Maturity — доля оплативших к этому возрасту">
              {point.value != null ? `${point.value}%` : "—"}
            </strong>
          </div>
        ))}
      </div>
      <DecisionBrief
        body={
          card.medianLeadToWonDays != null
            ? `Медиана до оплаты ≈ ${card.medianLeadToWonDays} дн. Если хвост кассы большой — часть плана этого месяца уже «заработана» прошлыми лидами; давите скорость Lead→WON, а не только новые лиды.`
            : null
        }
      />
    </section>
  );
}
