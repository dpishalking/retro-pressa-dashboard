"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";
import { AnalyticsKpiRow } from "@/components/analytics-os/kpi-row";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import {
  BUSINESS_CONTOUR_PATHS,
  type BusinessContourId
} from "@/lib/analytics-os/contours";
import { metricLabel } from "@/lib/analytics-os/metric-glossary";
import { eur, pct } from "@/lib/format";

const BUSINESS_LINKS: Array<{
  id: BusinessContourId;
  title: string;
  subtitle: string;
  preview: (snapshot: CeoControlCenterSnapshot) => ReactNode;
}> = [
  {
    id: "sales",
    title: "Продажи",
    subtitle: "Воронка, команда и прогноз оплат",
    preview: (snapshot) => (
      <>
        <strong>
          {formatMetricDisplay(snapshot.metrics.revenue)} · {metricLabel("leads")}{" "}
          {formatMetricDisplay(snapshot.metrics.leads)}
        </strong>
        <span>
          {metricLabel("conversion_rate")} {formatMetricDisplay(snapshot.metrics.conversion_rate)}
        </span>
      </>
    )
  },
  {
    id: "marketing",
    title: "Маркетинг и трафик",
    subtitle: "Лендинги, бюджет и привлечение",
    preview: (snapshot) => (
      <>
        <strong>{formatMetricDisplay(snapshot.marketing.adSpend)}</strong>
        <span>
          {metricLabel("cpl")} {formatMetricDisplay(snapshot.marketing.cpl)} ·{" "}
          {metricLabel("leads")} {formatMetricDisplay(snapshot.metrics.leads)}
        </span>
      </>
    )
  },
  {
    id: "product",
    title: "Продукт",
    subtitle: "SKU, спрос и клиенты",
    preview: (snapshot) => {
      const top = snapshot.products[0];
      return top ? (
        <>
          <strong>{top.productName}</strong>
          <span>
            {eur(top.revenue)}
            {top.marginRate == null ? "" : ` · маржа ${pct(top.marginRate)}`}
          </span>
        </>
      ) : (
        <span>Нет данных по продуктам</span>
      );
    }
  },
  {
    id: "finance",
    title: "Финансы",
    subtitle: "План, факт и экономика",
    preview: (snapshot) => (
      <>
        <strong>{formatMetricDisplay(snapshot.plan.planRevenue)}</strong>
        <span>
          Факт {formatMetricDisplay(snapshot.plan.factRevenue)} · прогноз{" "}
          {formatMetricDisplay(snapshot.plan.forecastRevenue)}
        </span>
      </>
    )
  }
];

function BusinessDirectionBand({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-tiles-band" aria-label="Направления бизнеса">
      <div className="aos-tiles-band__head">
        <div>
          <h2>Направления</h2>
          <p>Сводка здесь. Детали и действия — в выбранном направлении.</p>
        </div>
      </div>
      <div className="aos-tiles-grid">
        {BUSINESS_LINKS.map((item) => (
          <Link
            key={item.id}
            href={BUSINESS_CONTOUR_PATHS[item.id]}
            className="aos-module aos-module--blue"
          >
            <div className="aos-module__head">
              <span className="aos-module__num">→</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
              </div>
            </div>
            <div className="aos-module__preview">{item.preview(snapshot)}</div>
            <span className="aos-module__cta">Открыть →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ScenarioWorkshop({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const cards = snapshot.ownerIntelligence;
  return (
    <section className="aos-ai-band">
      <div className="aos-ai-band__head">
        <div>
          <h2>Что делать дальше</h2>
          <p>Короткие выводы по текущим данным — без выдуманных цифр</p>
        </div>
        <Link href="/finance" className="aos-ai-band__link">
          К финансам →
        </Link>
      </div>
      <div className="aos-ai-band__grid">
        {cards.map((card) => (
          <article key={card.id} className="aos-ai-card">
            <div className="aos-ai-card__head">
              <h3>{card.title}</h3>
              <StatusBadge status={card.status} />
            </div>
            <p>{card.body}</p>
            {card.href ? (
              <Link href={card.href} className="aos-ai-card__cta">
                Открыть →
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function DataSourcesBand({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-sources-band">
      <div className="aos-sources-band__head">
        <div>
          <h2>Источники данных</h2>
          <p className="aos-sources-band__lead">Что подключено и чему можно верить</p>
        </div>
        <Link href="/os/sources">Качество данных →</Link>
      </div>
      <div className="aos-sources-band__grid">
        {snapshot.sources.map((source) => (
          <div key={source.id} className={`aos-source-chip aos-source-chip--${source.connection}`}>
            <strong>{source.name}</strong>
            <span>
              {source.connection === "connected"
                ? "подключён"
                : source.connection === "partial"
                  ? "частично"
                  : "нет"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

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
          <BusinessDirectionBand snapshot={snapshot} />
          <ScenarioWorkshop snapshot={snapshot} />
          <DataSourcesBand snapshot={snapshot} />
        </>
      )}
    </div>
  );
}
