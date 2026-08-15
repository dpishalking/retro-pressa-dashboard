"use client";

import Link from "next/link";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";
import { AnalyticsKpiRow } from "@/components/analytics-os/kpi-row";
import { StatusBadge } from "@/components/analytics-os/format-metric";
import { DirectionDoors, ScenariosModule, SourcesModule } from "@/components/analytics-os/direction-doors";

export function AnalyticsOsScreen() {
  const {
    period,
    setPeriod,
    country,
    setCountry,
    managerId,
    setManagerId,
    productId,
    setProductId,
    snapshot,
    state,
    error
  } = useCeoSnapshot();

  const health =
    snapshot == null
      ? "—"
      : snapshot.asOf
        ? "ОК"
        : snapshot.metrics.revenue.status === "no_data"
          ? "НЕТ ДАННЫХ"
          : "ЧАСТИЧНО";

  return (
    <div className="aos-root aos-root--hub">
      <header className="aos-hero">
        <div>
          <p className="aos-hero__eyebrow">RETRO PRESSA</p>
          <h1>Аналитика</h1>
          <p className="aos-hero__lead">Ключевые показатели, отклонения и решения</p>
        </div>
        <div className="aos-topbar__meta">
          <label>
            Период
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              {(snapshot?.availablePeriods || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              {period && !(snapshot?.availablePeriods || []).includes(period) ? (
                <option value={period}>{period}</option>
              ) : null}
            </select>
          </label>
          <div className="aos-topbar__stat">
            <span>Обновлено</span>
            <strong>{snapshot?.asOf ? new Date(snapshot.asOf).toLocaleString("ru-RU") : "—"}</strong>
          </div>
          <div className="aos-topbar__stat">
            <span>Данные</span>
            <strong>{health}</strong>
          </div>
          <Link className="aos-topbar__hub" href="/os/sources">
            Источники
          </Link>
          <a className="aos-topbar__hub" href="/hub">
            Кабинет
          </a>
        </div>
      </header>

      <section className="aos-ceo-band">
        <div className="aos-ceo-band__title">
          <strong>Сводка собственника</strong>
          <span>План, факт и сигналы по бизнесу</span>
        </div>
        <div className="aos-filters aos-filters--inline">
          <label>
            Страна
            <select value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="">Все</option>
              {(snapshot?.filterOptions.countries || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Менеджер
            <select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
              <option value="">Все</option>
              {(snapshot?.filterOptions.managers || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Продукт
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Все</option>
              {(snapshot?.filterOptions.products || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {(country || managerId || productId) && (
            <button
              type="button"
              className="aos-filter-clear"
              onClick={() => {
                setCountry("");
                setManagerId("");
                setProductId("");
              }}
            >
              Сброс
            </button>
          )}
          {state === "loading" ? <StatusBadge status="calculated" /> : null}
          {state === "error" ? <span className="aos-error">{error}</span> : null}
        </div>
        {snapshot ? <AnalyticsKpiRow snapshot={snapshot} /> : <p className="aos-muted">Загрузка KPI…</p>}
      </section>

      {!snapshot ? (
        <section className="aos-card" style={{ margin: "1rem" }}>
          <p>{state === "error" ? error : "Загрузка сводки…"}</p>
        </section>
      ) : (
        <>
          <DirectionDoors snapshot={snapshot} />
          <ScenariosModule snapshot={snapshot} />
          <SourcesModule snapshot={snapshot} />
        </>
      )}
    </div>
  );
}
