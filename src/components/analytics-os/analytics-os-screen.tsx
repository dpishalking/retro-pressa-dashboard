"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";
import { AnalyticsKpiRow } from "@/components/analytics-os/kpi-row";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import {
  businessContourGroups,
  contourStatusLabel,
  type ContourDef
} from "@/lib/analytics-os/contours";
import { eur, number, pct } from "@/lib/format";

function ContourLink({
  contour,
  children,
  className
}: {
  contour: ContourDef;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={contour.href} className={className}>
      {children}
    </Link>
  );
}

function ModuleCard({
  contour,
  children,
  preview
}: {
  contour: ContourDef;
  children?: ReactNode;
  preview?: ReactNode;
}) {
  return (
    <ContourLink contour={contour} className={`aos-module aos-module--${contour.accent}`}>
      <div className="aos-module__head">
        <span className="aos-module__num">{contour.number || "·"}</span>
        <div>
          <h3>{contour.title}</h3>
          <p>{contour.subtitle}</p>
        </div>
        <span className={`aos-contour-pill aos-contour-pill--${contour.status}`}>
          {contourStatusLabel(contour.status)}
        </span>
      </div>
      {preview ? <div className="aos-module__preview">{preview}</div> : null}
      {children}
      <span className="aos-module__cta">Открыть →</span>
    </ContourLink>
  );
}

function tilePreview(contour: ContourDef, snapshot: CeoControlCenterSnapshot): ReactNode {
  const topCountry = snapshot.countries[0];
  const topManager = snapshot.managers[0];
  const topProduct = snapshot.products[0];

  switch (contour.id) {
    case "revenue":
      return (
        <>
          <strong>{formatMetricDisplay(snapshot.metrics.revenue)}</strong>
          <span>
            План {formatMetricDisplay(snapshot.plan.planRevenue)} · прогресс{" "}
            {formatMetricDisplay(snapshot.plan.planCompletion)}
          </span>
        </>
      );
    case "unit-economics":
      return (
        <>
          <strong>Маржа {formatMetricDisplay(snapshot.productMargin.marginRate)}</strong>
          <span>
            Валовая {formatMetricDisplay(snapshot.productMargin.grossProfit)} · себестоимость{" "}
            {formatMetricDisplay(snapshot.productMargin.cogs)} · средний чек{" "}
            {formatMetricDisplay(snapshot.metrics.aov)}
          </span>
        </>
      );
    case "products":
      return topProduct ? (
        <>
          <strong>{topProduct.productName}</strong>
          <span>
            {eur(topProduct.revenue)}
            {topProduct.marginRate == null ? "" : ` · маржа ${pct(topProduct.marginRate)}`} ·{" "}
            {pct(topProduct.share)}
          </span>
        </>
      ) : (
        <span>Нет данных по SKU</span>
      );
    case "cohorts":
      return <span>Месяц / неделя лида · страны · лиды и оплаты в одной когорте</span>;
    case "sales-cycle":
      return <span>От лида до оплаты · зрелость когорты · менеджеры и источники</span>;
    case "customers":
      return (
        <>
          <strong>{formatMetricDisplay(snapshot.metrics.repeat_rate)} повтор</strong>
          <span>
            Клиенты {formatMetricDisplay(snapshot.customers.customers)} · новые{" "}
            {formatMetricDisplay(snapshot.customers.newCustomers)}
          </span>
        </>
      );
    case "marketing":
      return (
        <>
          <strong>{formatMetricDisplay(snapshot.metrics.ad_spend)}</strong>
          <span>{snapshot.marketing.note}</span>
        </>
      );
    case "creatives":
      return <span>Ads API / креативы ещё не подключены</span>;
    case "funnel":
      return (
        <span>
          {snapshot.funnel
            .map((stage) => `${stage.label} ${stage.count == null ? "—" : number(stage.count)}`)
            .join(" → ")}
        </span>
      );
    case "managers":
      return topManager ? (
        <>
          <strong>{topManager.managerName}</strong>
          <span>
            {eur(topManager.revenue)} · CR{" "}
            {topManager.conversionRate == null ? "—" : pct(topManager.conversionRate)}
          </span>
        </>
      ) : (
        <span>Нет менеджеров в снимке</span>
      );
    case "conversations":
      return <span>Открывает раздел диалогов РОП</span>;
    case "geography":
      return topCountry ? (
        <>
          <strong>{topCountry.country}</strong>
          <span>
            {eur(topCountry.revenue)} · {pct(topCountry.share)}
          </span>
        </>
      ) : (
        <span>Нет стран в снимке</span>
      );
    case "production":
      return <span>{snapshot.production.message}</span>;
    case "plan":
      return (
        <>
          <strong>{formatMetricDisplay(snapshot.plan.planRevenue)}</strong>
          <span>
            Факт {formatMetricDisplay(snapshot.plan.factRevenue)} · прогноз{" "}
            {formatMetricDisplay(snapshot.plan.forecastRevenue)} · {snapshot.plan.indicatorCount}{" "}
            показателей
          </span>
        </>
      );
    default:
      return <span>{contour.subtitle}</span>;
  }
}

function ContourTiles({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const groups = businessContourGroups();
  return (
    <section className="aos-tiles-band" aria-label="Модули аналитики">
      <div className="aos-tiles-band__head">
        <div>
          <h2>Пять контуров BI</h2>
          <p>Выберите бизнес-направление, затем нужный модуль.</p>
        </div>
      </div>
      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`business-contour-${group.id}`}>
            <div className="mb-4">
              <h3 id={`business-contour-${group.id}`} className="text-xl font-black text-slate-950">
                {group.title}
              </h3>
              <p className="aos-muted">{group.subtitle}</p>
            </div>
            <div className="aos-tiles-grid">
              {group.contours.map((contour) => (
                <ModuleCard key={contour.id} contour={contour} preview={tilePreview(contour, snapshot)} />
              ))}
            </div>
          </section>
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
          <h2>Мастерская сценариев</h2>
          <p>AI-аналитик · честные статусы, без выдуманных цифр</p>
        </div>
        <Link href="/os/revenue" className="aos-ai-band__link">
          К плану / факту →
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
          <h2>Источники правды</h2>
          <p className="aos-sources-band__lead">Единая модель данных — что подключено и что ещё нет</p>
        </div>
        <Link href="/os/sources">Качество и источники →</Link>
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
          <h1>Аналитическая операционная система</h1>
          <p className="aos-hero__lead">Полная картина бизнеса для роста к компании на миллиард</p>
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
            <span>Синк</span>
            <strong>{snapshot?.asOf ? new Date(snapshot.asOf).toLocaleString("ru-RU") : "—"}</strong>
          </div>
          <div className="aos-topbar__stat">
            <span>Данные</span>
            <strong>{health}</strong>
          </div>
          <a className="aos-topbar__hub" href="/hub">
            Кабинет
          </a>
          <a className="aos-topbar__hub" href="/analytics/legacy">
            Legacy
          </a>
        </div>
      </header>

      <section className="aos-ceo-band">
        <div className="aos-ceo-band__title">
          <strong>CEO Control Center</strong>
          <span>Приборная панель собственника</span>
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
          <p>{state === "error" ? error : "Загрузка центра управления…"}</p>
        </section>
      ) : (
        <>
          <ContourTiles snapshot={snapshot} />
          <ScenarioWorkshop snapshot={snapshot} />
          <DataSourcesBand snapshot={snapshot} />
        </>
      )}
    </div>
  );
}
