"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Gift,
  Globe2,
  Layers,
  Megaphone,
  Package,
  Radio,
  UserRound,
  Users,
  type LucideIcon
} from "lucide-react";
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

const DIM_ICONS: Record<SliceDimensionId, LucideIcon> = {
  country: Globe2,
  product: Package,
  manager: UserRound,
  source: Radio,
  channel: Layers,
  gift: Gift,
  traffic: Megaphone,
  customer: Users,
  time: Clock,
  cohort: CalendarDays
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

function formatRowMetric(row: SliceRow, metric: SliceMetricId): string {
  if (metric === "leads") return number(row.leads);
  if (metric === "sales") return number(row.sales);
  if (metric === "cr") return row.cr == null ? "—" : pct(row.cr);
  if (metric === "aov") return row.aov == null ? "—" : eur(row.aov);
  return eur(row.revenue);
}

function pillTone(status: SliceRow["status"]): string {
  if (status === "strong") return "healthy";
  if (status === "weak") return "problem";
  if (status === "low_data") return "no_data";
  return "attention";
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
  const selectedRow = sorted.find((row) => row.key === (report?.selectedKey || selected));
  const kpis = report?.kpis;

  return (
    <div className="aos-slices">
      <section className="aos-slice-hero">
        <p className="aos-slice-hero__eyebrow">Исследование</p>
        <h2>Где живёт результат</h2>
        <p>
          Выберите разрез, кликните строку и идите дальше. Те же факты, что когорты: лиды Bitrix и их оплаты.
        </p>
        <div className="aos-slice-chips" role="tablist" aria-label="Измерение">
          {SLICE_DIMENSIONS.map((item) => {
            const Icon = DIM_ICONS[item.id];
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={dim === item.id}
                className={`aos-slice-chip${dim === item.id ? " is-active" : ""}`}
                onClick={() => patchUrl({ dim: item.id, selected: null })}
              >
                <Icon size={16} strokeWidth={2.2} />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="aos-slice-metrics" role="tablist" aria-label="Показатель">
          {SLICE_METRICS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={metric === item.id}
              className={`aos-slice-metric${metric === item.id ? " is-active" : ""}`}
              onClick={() => patchUrl({ metric: item.id })}
            >
              {item.label}
            </button>
          ))}
          {(dim === "time" || dim === "cohort") &&
            (["day", "week", "month"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`aos-slice-metric${grain === item ? " is-active" : ""}`}
                onClick={() => patchUrl({ grain: item, selected: null })}
              >
                {item === "day" ? "День" : item === "week" ? "Неделя" : "Месяц"}
              </button>
            ))}
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
        <section className="aos-slice-loading">Считаю срез по фактам цикла сделки…</section>
      ) : report && kpis ? (
        <>
          <section className="aos-slice-kpis" aria-label="Итог среза">
            {(
              [
                ["leads", "Лиды", number(kpis.leads)],
                ["sales", "Оплаты", number(kpis.sales)],
                ["cr", "CR", kpis.cr == null ? "—" : pct(kpis.cr)],
                ["revenue", "Выручка", eur(kpis.revenue)],
                ["aov", "AOV", kpis.aov == null ? "—" : eur(kpis.aov)],
                ["cycle", "Медиана цикла", kpis.medianCycleDays == null ? "—" : `${number(kpis.medianCycleDays, 1)} дн.`],
                ["d7", "D7 CR", kpis.d7Cr == null ? "—" : pct(kpis.d7Cr)],
                ["d30", "D30 CR", kpis.d30Cr == null ? "—" : pct(kpis.d30Cr)]
              ] as const
            ).map(([id, label, value]) => (
              <div
                key={id}
                className={`aos-slice-kpi aos-slice-kpi--${id}${metric === id ? " is-focus" : ""}`}
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          {report.unknownShareLeads != null && report.unknownShareLeads > 0 ? (
            <p className="aos-slice-note">
              Не указан — {pct(report.unknownShareLeads)} лидов
              {report.unknownShareRevenue != null ? ` · ${pct(report.unknownShareRevenue)} выручки` : ""}.
            </p>
          ) : null}
          {report.coverageNote ? <p className="aos-slice-note">{report.coverageNote}</p> : null}

          <section className="aos-slice-spots">
            <div className="aos-slice-spot aos-slice-spot--leaders">
              <h3>Лидеры</h3>
              <p>Сильные строки по выбранному показателю. Клик — в цепочку.</p>
              {report.leaders.length ? (
                <ol>
                  {report.leaders.map((row, index) => (
                    <li key={row.key}>
                      <button type="button" onClick={() => drill(row)}>
                        <em>{index + 1}</em>
                        <span>
                          <strong>{row.label}</strong>
                          <small>{number(row.leads)} лидов · {number(row.sales)} оплат</small>
                        </span>
                        <b>{formatRowMetric(row, metric)}</b>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="aos-muted">Недостаточно данных для рейтинга.</p>
              )}
            </div>
            <div className="aos-slice-spot aos-slice-spot--attention">
              <h3>Зоны внимания</h3>
              <p>Есть объём, но CR слабее среднего. Сюда стоит зайти.</p>
              {report.attention.length ? (
                <ol>
                  {report.attention.map((row, index) => (
                    <li key={row.key}>
                      <button type="button" onClick={() => drill(row)}>
                        <em>{index + 1}</em>
                        <span>
                          <strong>{row.label}</strong>
                          <small>{row.cr == null ? "CR нет" : `CR ${pct(row.cr)}`}</small>
                        </span>
                        <b>{formatRowMetric(row, metric)}</b>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="aos-muted">Нет строк с достаточной выборкой и CR ниже среднего.</p>
              )}
            </div>
          </section>

          <section className="aos-slice-board">
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
                        className={`${row.key === selected ? "is-selected" : ""} aos-slice-row--${row.status}`}
                        onClick={() => drill(row)}
                      >
                        <td>
                          {row.label}
                          {row.unknown ? <em> не указан</em> : null}
                        </td>
                        <td>{number(row.leads)}</td>
                        <td>{number(row.sales)}</td>
                        <td>{row.cr == null ? "—" : pct(row.cr)}</td>
                        <td>{eur(row.revenue)}</td>
                        <td>{row.aov == null ? "—" : eur(row.aov)}</td>
                        <td>
                          {row.revenueShare == null ? "—" : pct(row.revenueShare)}
                          {row.revenueShare != null ? (
                            <span className="aos-slice-bar" style={{ width: `${Math.max(8, row.revenueShare * 100)}%` }} />
                          ) : null}
                        </td>
                        <td>{row.medianCycleDays == null ? "—" : `${number(row.medianCycleDays, 1)} дн.`}</td>
                        <td>
                          <span className={`aos-scenario-pill aos-scenario-pill--${pillTone(row.status)}`}>
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
            <section className="aos-slice-next-card">
              <div className="aos-section-head">
                <div>
                  <h2>Дальше: {selectedRow?.label || report.selectedKey}</h2>
                  <p>Смените измерение — фильтр уже записан. Смотрите, что внутри этой строки.</p>
                </div>
              </div>
              {dimension?.nextHints.length ? (
                <div className="aos-slice-next">
                  {dimension.nextHints.map((id) => {
                    const next = getSliceDimension(id);
                    if (!next) return null;
                    const Icon = DIM_ICONS[id];
                    return (
                      <button key={id} type="button" onClick={() => patchUrl({ dim: id })}>
                        <Icon size={18} strokeWidth={2.1} />
                        {next.label}
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

          <DecisionBrief title="Что здесь нет" body={report.unavailable.join(" ")} />
        </>
      ) : null}
    </div>
  );
}
