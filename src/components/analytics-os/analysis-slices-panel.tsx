"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import {
  SLICE_DIMENSIONS,
  SLICE_METRICS,
  getSliceDimension,
  parseSliceDimension,
  parseSliceMetric,
  type SliceDimensionId,
  type SliceMetricId,
  type SliceReport,
  type SliceRow
} from "@/lib/analytics-os/slices";
import { eur, number, pct } from "@/lib/format";

type Props = {
  period: string;
  country: string;
  managerId: string;
  productId: string;
  setPeriod: (value: string) => void;
  setCountry: (value: string) => void;
  setManagerId: (value: string) => void;
  setProductId: (value: string) => void;
};

const STATUS_LABEL: Record<SliceRow["status"], string> = {
  strong: "Сильный",
  attention: "Внимание",
  weak: "Слабый",
  low_data: "Мало данных"
};

function crumbLabel(key: string, value: string): string {
  if (key === "country") return value;
  if (key === "managerId") return `Менеджер ${value}`;
  if (key === "productId") return `Продукт ${value}`;
  if (key === "sourceId") return `Источник ${value}`;
  if (key === "channel") return `Канал ${value}`;
  if (key === "traffic") return value === "paid" ? "Платный" : value === "organic" ? "Органика" : value;
  if (key === "gift") return value;
  if (key === "customer") return value === "new" ? "Новый" : value === "returning" ? "Повтор" : value;
  if (key === "timeKey") return `Оплаты ${value}`;
  if (key === "cohortKey") return `Когорта ${value}`;
  return value;
}

export function AnalysisSlicesPanel({
  period,
  country,
  managerId,
  productId,
  setPeriod,
  setCountry,
  setManagerId,
  setProductId
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dim = parseSliceDimension(searchParams.get("dim"));
  const metric = parseSliceMetric(searchParams.get("metric"));
  const grain = searchParams.get("grain") === "day" || searchParams.get("grain") === "week" ? searchParams.get("grain")! : "month";
  const selected = searchParams.get("selected") || "";
  const extra = useMemo(
    () => ({
      sourceId: searchParams.get("sourceId") || searchParams.get("source") || "",
      channel: searchParams.get("channel") || "",
      traffic: searchParams.get("traffic") || "",
      gift: searchParams.get("gift") || "",
      customer: searchParams.get("customer") || "",
      timeKey: searchParams.get("timeKey") || "",
      cohortKey: searchParams.get("cohortKey") || ""
    }),
    [searchParams]
  );

  const [report, setReport] = useState<SliceReport | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SliceMetricId | "revenueShare">(metric);

  useEffect(() => {
    const fromUrl = searchParams.get("period");
    if (fromUrl && fromUrl !== period) setPeriod(fromUrl);
  }, [searchParams, period, setPeriod]);

  useEffect(() => {
    setSortKey(metric);
  }, [metric]);

  function patchUrl(update: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(update)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (period) params.set("period", period);
    if (country) params.set("country", country);
    else params.delete("country");
    if (managerId) params.set("managerId", managerId);
    else params.delete("managerId");
    if (productId) params.set("productId", productId);
    else params.delete("productId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!period) return;
    const controller = new AbortController();
    setState("loading");
    setError("");
    const params = new URLSearchParams({ period, dim, metric, grain });
    if (country) params.set("country", country);
    if (managerId) params.set("managerId", managerId);
    if (productId) params.set("productId", productId);
    if (extra.sourceId) params.set("sourceId", extra.sourceId);
    if (extra.channel) params.set("channel", extra.channel);
    if (extra.traffic) params.set("traffic", extra.traffic);
    if (extra.gift) params.set("gift", extra.gift);
    if (extra.customer) params.set("customer", extra.customer);
    if (extra.timeKey) params.set("timeKey", extra.timeKey);
    if (extra.cohortKey) params.set("cohortKey", extra.cohortKey);
    if (selected) params.set("selected", selected);
    fetch(`/api/analytics/slices?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Ошибка загрузки");
        setReport(json);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
        setState("error");
      });
    return () => controller.abort();
  }, [period, dim, metric, grain, country, managerId, productId, extra, selected]);

  const crumbs = [
    country ? { key: "country", value: country } : null,
    managerId ? { key: "managerId", value: managerId } : null,
    productId ? { key: "productId", value: productId } : null,
    extra.sourceId ? { key: "sourceId", value: extra.sourceId } : null,
    extra.channel ? { key: "channel", value: extra.channel } : null,
    extra.traffic ? { key: "traffic", value: extra.traffic } : null,
    extra.gift ? { key: "gift", value: extra.gift } : null,
    extra.customer ? { key: "customer", value: extra.customer } : null,
    extra.timeKey ? { key: "timeKey", value: extra.timeKey } : null,
    extra.cohortKey ? { key: "cohortKey", value: extra.cohortKey } : null
  ].filter((item): item is { key: string; value: string } => Boolean(item));

  function clearCrumb(key: string) {
    if (key === "country") setCountry("");
    if (key === "managerId") setManagerId("");
    if (key === "productId") setProductId("");
    patchUrl({ [key]: null, selected: null });
  }

  function clearAll() {
    setCountry("");
    setManagerId("");
    setProductId("");
    patchUrl({
      sourceId: null,
      source: null,
      channel: null,
      traffic: null,
      gift: null,
      customer: null,
      timeKey: null,
      cohortKey: null,
      selected: null
    });
  }

  function drill(row: SliceRow, nextDim?: SliceDimensionId) {
    const def = getSliceDimension(dim);
    const filterKey = def?.filterKey;
    if (filterKey === "country") setCountry(row.key === "—" ? "" : row.key);
    if (filterKey === "managerId") setManagerId(row.key === "unknown" ? "" : row.key);
    if (filterKey === "productId") setProductId(row.key === "—" ? "" : row.key);
    const next: Record<string, string | null> = { selected: row.key };
    if (filterKey && filterKey !== "country" && filterKey !== "managerId" && filterKey !== "productId") {
      next[filterKey] = row.key;
    }
    if (nextDim) next.dim = nextDim;
    patchUrl(next);
  }

  const dimension = getSliceDimension(dim);
  const sorted = [...(report?.rows || [])].sort((a, b) => {
    if (sortKey === "revenueShare") return (b.revenueShare ?? 0) - (a.revenueShare ?? 0);
    if (sortKey === "cr") return (b.cr ?? -1) - (a.cr ?? -1);
    if (sortKey === "aov") return (b.aov ?? -1) - (a.aov ?? -1);
    if (sortKey === "sales") return b.sales - a.sales;
    if (sortKey === "leads") return b.leads - a.leads;
    return b.revenue - a.revenue;
  });

  return (
    <>
      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Срезы</h2>
            <p>
              Exploration поверх тех же фактов, что когорты и цикл сделки: лиды Bitrix месяца создания и их оплаты.
              Не путать с KPI сводки (лиды СВОД). Spend / CAC здесь нет — расход не размечен по срезу.
            </p>
          </div>
        </div>
        <div className="aos-slice-controls">
          <label>
            Анализировать по
            <select value={dim} onChange={(event) => patchUrl({ dim: event.target.value, selected: null })}>
              {SLICE_DIMENSIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Основной показатель
            <select value={metric} onChange={(event) => patchUrl({ metric: event.target.value })}>
              {SLICE_METRICS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {(dim === "time" || dim === "cohort") && (
            <label>
              Зерно времени
              <select value={grain} onChange={(event) => patchUrl({ grain: event.target.value, selected: null })}>
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
              </select>
            </label>
          )}
        </div>
        <nav className="aos-slice-crumbs" aria-label="Цепочка среза">
          <button type="button" onClick={clearAll} className={!crumbs.length ? "is-active" : ""}>
            Все данные
          </button>
          {crumbs.map((item) => (
            <button key={`${item.key}-${item.value}`} type="button" onClick={() => clearCrumb(item.key)}>
              {crumbLabel(item.key, item.value)} ×
            </button>
          ))}
        </nav>
      </section>

      {state === "error" ? (
        <section className="aos-card aos-card--warn">
          <p>{error}</p>
        </section>
      ) : !report && state === "loading" ? (
        <section className="aos-card">
          <p>Считаю срез по фактам цикла сделки…</p>
        </section>
      ) : report ? (
        <>
          <section className="aos-card">
            <div className="aos-plan__grid">
              <div>
                <span>ЛИДЫ</span>
                <strong>{number(report.kpis.leads)}</strong>
              </div>
              <div>
                <span>ОПЛАТЫ</span>
                <strong>{number(report.kpis.sales)}</strong>
              </div>
              <div>
                <span>CR</span>
                <strong>{report.kpis.cr == null ? "—" : pct(report.kpis.cr)}</strong>
              </div>
              <div>
                <span>ВЫРУЧКА</span>
                <strong>{eur(report.kpis.revenue)}</strong>
              </div>
              <div>
                <span>AOV</span>
                <strong>{report.kpis.aov == null ? "—" : eur(report.kpis.aov)}</strong>
              </div>
              <div>
                <span>МЕДИАНА ЦИКЛА</span>
                <strong>{report.kpis.medianCycleDays == null ? "—" : `${number(report.kpis.medianCycleDays, 1)} дн.`}</strong>
              </div>
              <div>
                <span>D7 CR</span>
                <strong>{report.kpis.d7Cr == null ? "—" : pct(report.kpis.d7Cr)}</strong>
              </div>
              <div>
                <span>D30 CR</span>
                <strong>{report.kpis.d30Cr == null ? "—" : pct(report.kpis.d30Cr)}</strong>
              </div>
            </div>
            {report.unknownShareLeads != null && report.unknownShareLeads > 0 ? (
              <p className="aos-muted" style={{ marginTop: "0.75rem" }}>
                Не указан — {pct(report.unknownShareLeads)} лидов
                {report.unknownShareRevenue != null ? ` · ${pct(report.unknownShareRevenue)} выручки` : ""}.
              </p>
            ) : null}
            {report.coverageNote ? <p className="aos-muted">{report.coverageNote}</p> : null}
            <DecisionBrief title="Ограничение" body={report.unavailable.join(" ")} />
          </section>

          <section className="aos-card">
            <div className="aos-slice-rank">
              <div>
                <h3>Лидеры</h3>
                {report.leaders.length ? (
                  <ol>
                    {report.leaders.map((row) => (
                      <li key={row.key}>
                        <button type="button" onClick={() => drill(row)}>
                          {row.label}
                        </button>
                        <span>{eur(row.revenue)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="aos-muted">Недостаточно данных для рейтинга.</p>
                )}
              </div>
              <div>
                <h3>Зоны внимания</h3>
                {report.attention.length ? (
                  <ol>
                    {report.attention.map((row) => (
                      <li key={row.key}>
                        <button type="button" onClick={() => drill(row)}>
                          {row.label}
                        </button>
                        <span>{row.cr == null ? "—" : pct(row.cr)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="aos-muted">Нет строк с достаточной выборкой и CR ниже среднего.</p>
                )}
              </div>
            </div>
          </section>

          <section className="aos-card">
            <div className="aos-section-head">
              <div>
                <h2>{dimension?.label || "Срез"}</h2>
                <p>
                  {sorted.length
                    ? "Клик по строке добавляет её в цепочку. Дальше выберите следующее измерение."
                    : "Нет данных по этому срезу за выбранный период."}
                </p>
              </div>
              {dimension?.detailRoute ? (
                <Link href={dimension.detailRoute} className="aos-slice-detail">
                  {dimension.detailLabel} →
                </Link>
              ) : null}
            </div>
            {sorted.length ? (
              <div className="table-scroll">
                <table className="aos-slice-table">
                  <thead>
                    <tr>
                      <th>{dimension?.label}</th>
                      <th>
                        <button type="button" onClick={() => setSortKey("leads")}>
                          Лиды
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => setSortKey("sales")}>
                          Оплаты
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => setSortKey("cr")}>
                          CR
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => setSortKey("revenue")}>
                          Выручка
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => setSortKey("aov")}>
                          AOV
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => setSortKey("revenueShare")}>
                          Доля
                        </button>
                      </th>
                      <th>Цикл</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr
                        key={row.key}
                        className={row.key === selected ? "is-selected" : ""}
                        onClick={() => drill(row)}
                      >
                        <td>
                          {row.label}
                          {row.unknown ? <em> unknown</em> : null}
                        </td>
                        <td>{number(row.leads)}</td>
                        <td>{number(row.sales)}</td>
                        <td>{row.cr == null ? "—" : pct(row.cr)}</td>
                        <td>{eur(row.revenue)}</td>
                        <td>{row.aov == null ? "—" : eur(row.aov)}</td>
                        <td>
                          {row.revenueShare == null ? "—" : pct(row.revenueShare)}
                          {row.revenueShare != null ? (
                            <span className="aos-slice-bar" style={{ width: `${Math.max(4, row.revenueShare * 100)}%` }} />
                          ) : null}
                        </td>
                        <td>{row.medianCycleDays == null ? "—" : `${number(row.medianCycleDays, 1)} дн.`}</td>
                        <td>
                          <span className={`aos-scenario-pill aos-scenario-pill--${row.status === "strong" ? "healthy" : row.status === "weak" ? "problem" : row.status === "low_data" ? "no_data" : "attention"}`}>
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="aos-muted">Нет данных по источнику за выбранный период.</p>
            )}
            {state === "loading" ? <p className="aos-muted">Обновляю срез…</p> : null}
          </section>

          {report.selectedKey ? (
            <section className="aos-card">
              <div className="aos-section-head">
                <div>
                  <h2>Выбрано: {sorted.find((row) => row.key === report.selectedKey)?.label || report.selectedKey}</h2>
                  <p>Динамика по времени и следующий шаг цепочки.</p>
                </div>
              </div>
              {dimension?.nextHints.length ? (
                <div className="aos-slice-next">
                  {dimension.nextHints.map((id) => {
                    const next = getSliceDimension(id);
                    if (!next) return null;
                    return (
                      <button key={id} type="button" onClick={() => patchUrl({ dim: id })}>
                        Дальше: {next.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {report.trend.length ? (
                <ol className="aos-slice-trend">
                  {report.trend.map((point) => (
                    <li key={point.key}>
                      <strong>{point.label}</strong>
                      <span>
                        {number(point.leads)} лидов · {number(point.sales)} оплат · {eur(point.revenue)}
                        {point.cr == null ? "" : ` · CR ${pct(point.cr)}`}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="aos-muted">Недостаточно точек для динамики.</p>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
