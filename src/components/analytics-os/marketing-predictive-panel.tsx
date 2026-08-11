"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { StatusBadge } from "@/components/analytics-os/format-metric";
import { readJsonResponse } from "@/lib/api-response";
import { eur, number, pct } from "@/lib/format";
import type { PredictiveDayRow, PredictiveDomainBlock, PredictiveMetricRow } from "@/lib/predictive/types";

function formatValue(unit: string, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "eur") return eur(value);
  if (unit === "ratio") return pct(value);
  return number(value);
}

function dayStatusLabel(c: PredictiveDayRow["completeness"]): string {
  switch (c) {
    case "complete":
      return "закрыт";
    case "partial":
      return "сегодня";
    case "future":
      return "будущее";
    case "missing_data":
      return "нет факта";
  }
}

export function MarketingPredictiveMonthDays({
  block,
  title = "Предиктивная модель маркетинга"
}: {
  block: PredictiveDomainBlock;
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const days = block.days || [];
  const hasDays = days.length > 0;

  return (
    <section className="aos-card" id="aos-marketing-predictive">
      <div className="aos-section-head">
        <div>
          <h2>{title}</h2>
          <p>{block.subtitle}</p>
        </div>
        <StatusBadge
          status={
            block.status === "ok"
              ? "live"
              : block.status === "partial"
                ? "partial"
                : block.status === "error"
                  ? "no_data"
                  : "no_data"
          }
        />
      </div>

      <p className="aos-note" style={{ marginTop: 0 }}>
        {block.message}
        {block.asOf ? ` · as of ${block.asOf}` : ""}
      </p>

      <div className="table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Метрика</th>
              <th>План</th>
              <th>Факт</th>
              <th>Прогноз</th>
              <th>Gap</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {block.metrics.length === 0 ? (
              <tr>
                <td colSpan={6}>Нет метрик за период</td>
              </tr>
            ) : (
              block.metrics.map((metric: PredictiveMetricRow) => (
                <tr key={metric.id}>
                  <td>{metric.label}</td>
                  <td>{formatValue(metric.unit, metric.plan)}</td>
                  <td>{formatValue(metric.unit, metric.fact)}</td>
                  <td>{formatValue(metric.unit, metric.forecast)}</td>
                  <td>{formatValue(metric.unit, metric.gapToPlan)}</td>
                  <td>{metric.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasDays ? (
        <div style={{ marginTop: "0.85rem" }}>
          <button
            type="button"
            className="aos-unit-kind"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span style={{ marginLeft: 6 }}>
              {expanded ? "Свернуть дни" : `Развернуть по дням (${days.length})`}
            </span>
          </button>

          {expanded ? (
            <div className="table-scroll" style={{ marginTop: "0.75rem" }}>
              <table className="aos-table">
                <thead>
                  <tr>
                    <th>День</th>
                    <th>Лиды</th>
                    <th>Сделки</th>
                    <th>Счета</th>
                    <th>Оплаты</th>
                    <th>Выручка</th>
                    <th>Чек</th>
                    <th>CR л→опл</th>
                    <th>Статус дня</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date.slice(8)}</td>
                      <td>{day.leads == null ? "—" : number(day.leads)}</td>
                      <td>{day.deals == null ? "—" : number(day.deals)}</td>
                      <td>{day.invoiceEvents == null ? "—" : number(day.invoiceEvents)}</td>
                      <td>{day.payments == null ? "—" : number(day.payments)}</td>
                      <td>{day.paidRevenue == null ? "—" : eur(day.paidRevenue)}</td>
                      <td>{day.averageCheck == null ? "—" : eur(day.averageCheck)}</td>
                      <td>{day.leadToPaymentCr == null ? "—" : pct(day.leadToPaymentCr)}</td>
                      <td>{dayStatusLabel(day.completeness)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {block.notes.length ? (
        <ul className="aos-note" style={{ marginTop: "0.75rem" }}>
          {block.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <DecisionBrief
        body={
          block.metrics.find((m) => m.id === "paid_revenue" && m.gapToPlan != null)
            ? `Прогноз выручки ${formatValue("eur", block.metrics.find((m) => m.id === "paid_revenue")!.forecast)} при плане ${formatValue("eur", block.metrics.find((m) => m.id === "paid_revenue")!.plan)}. Смотрите дни с оплатами и лидами — где просел темп, туда и внимание.`
            : block.metrics.length
              ? "Сверьте план и факт по строкам выше. Разверните дни, чтобы увидеть, в какие даты ломается темп."
              : null
        }
      />
    </section>
  );
}

/** Loads marketing predictive block for Analytics OS /os/marketing. */
export function MarketingPredictivePanel({ period }: { period: string }) {
  const [block, setBlock] = useState<PredictiveDomainBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/predictive/overview?period=${encodeURIComponent(period)}`, {
        cache: "no-store"
      });
      const payload = await readJsonResponse<
        | { ok: true; domains: { marketing: PredictiveDomainBlock } }
        | { ok: false; error: string }
      >(response);
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        throw new Error("error" in payload ? payload.error : "Не удалось загрузить маркетинг");
      }
      setBlock(payload.domains.marketing);
    } catch (err) {
      setBlock(null);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !block) {
    return (
      <section className="aos-card">
        <p className="aos-muted">Загружаю предиктивную модель маркетинга…</p>
      </section>
    );
  }

  if (error && !block) {
    return (
      <section className="aos-card aos-card--warn">
        <p className="aos-error">{error}</p>
      </section>
    );
  }

  if (!block) return null;
  return <MarketingPredictiveMonthDays block={block} />;
}
