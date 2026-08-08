"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";
import { AnalyticsKpiRow } from "@/components/analytics-os/kpi-row";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import {
  contourStatusLabel,
  getContour,
  wheelContours,
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

function ContoursWheel() {
  const items = wheelContours();
  return (
    <section className="aos-wheel" aria-label="12 аналитических контуров">
      <div className="aos-wheel__ring">
        {items.map((item, index) => {
          const angle = (360 / items.length) * index - 90;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`aos-wheel__node aos-wheel__node--${item.status}`}
              style={{
                ["--a" as string]: `${angle}deg`
              }}
              title={item.subtitle}
            >
              <em>{item.number}</em>
              <span>{item.shortTitle}</span>
            </Link>
          );
        })}
        <div className="aos-wheel__core">
          <strong>12</strong>
          <span>аналитических контуров</span>
          <small>нажмите блок</small>
        </div>
      </div>
    </section>
  );
}

function OwnerScenarios({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const cards = snapshot.ownerIntelligence;
  return (
    <section className="aos-ai-band">
      <div className="aos-ai-band__head">
        <div>
          <h2>5 сценариев собственника</h2>
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

function DataSourcesFooter({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-sources-band">
      <div className="aos-sources-band__head">
        <h2>Единая модель данных — один источник правды</h2>
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

function HubPreviews({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const byId = Object.fromEntries(wheelContours().map((c) => [c.id, c])) as Record<string, ContourDef>;
  const topCountry = snapshot.countries[0];
  const topManager = snapshot.managers[0];
  const topProduct = snapshot.products[0];

  return (
    <div className="aos-hub-grid">
      <div className="aos-hub-col">
        <ModuleCard
          contour={byId.revenue}
          preview={
            <>
              <strong>{formatMetricDisplay(snapshot.metrics.revenue)}</strong>
              <span>
                План {formatMetricDisplay(snapshot.plan.planRevenue)} · прогресс{" "}
                {formatMetricDisplay(snapshot.plan.planCompletion)}
              </span>
            </>
          }
        />
        <ModuleCard
          contour={byId["unit-economics"]}
          preview={
            <>
              <strong>AOV {formatMetricDisplay(snapshot.metrics.aov)}</strong>
              <span>
                CPL {formatMetricDisplay(snapshot.metrics.cpl)} · ROAS{" "}
                {formatMetricDisplay(snapshot.metrics.roas)}
              </span>
            </>
          }
        />
        <ModuleCard
          contour={byId.products}
          preview={
            topProduct ? (
              <>
                <strong>{topProduct.productName}</strong>
                <span>
                  {eur(topProduct.revenue)} · {pct(topProduct.share)}
                </span>
              </>
            ) : (
              <span>Нет данных по SKU</span>
            )
          }
        />
        <ModuleCard contour={byId.cohorts} preview={<span>Когорты и LTV — контур зарезервирован</span>} />
      </div>

      <div className="aos-hub-col aos-hub-col--center">
        <ContoursWheel />
        <ModuleCard
          contour={byId.customers}
          preview={
            <>
              <strong>{formatMetricDisplay(snapshot.metrics.repeat_rate)} повтор</strong>
              <span>
                Клиенты {formatMetricDisplay(snapshot.customers.customers)} · новые{" "}
                {formatMetricDisplay(snapshot.customers.newCustomers)}
              </span>
            </>
          }
        />
      </div>

      <div className="aos-hub-col">
        <ModuleCard
          contour={byId.marketing}
          preview={
            <>
              <strong>{formatMetricDisplay(snapshot.metrics.ad_spend)}</strong>
              <span>{snapshot.marketing.note}</span>
            </>
          }
        />
        <ModuleCard
          contour={byId.creatives}
          preview={<span>Ads API / креативы ещё не подключены</span>}
        />
        <ModuleCard
          contour={byId.funnel}
          preview={
            <span>
              {snapshot.funnel
                .map((stage) => `${stage.label} ${stage.count == null ? "—" : number(stage.count)}`)
                .join(" → ")}
            </span>
          }
        />
        <ModuleCard
          contour={byId.managers}
          preview={
            topManager ? (
              <>
                <strong>{topManager.managerName}</strong>
                <span>
                  {eur(topManager.revenue)} · CR{" "}
                  {topManager.conversionRate == null ? "—" : pct(topManager.conversionRate)}
                </span>
              </>
            ) : (
              <span>Нет менеджеров в снимке</span>
            )
          }
        />
      </div>

      <div className="aos-hub-bottom">
        <ModuleCard
          contour={byId.conversations}
          preview={<span>Открывает раздел диалогов РОП</span>}
        />
        <ModuleCard
          contour={byId.geography}
          preview={
            topCountry ? (
              <>
                <strong>{topCountry.country}</strong>
                <span>
                  {eur(topCountry.revenue)} · {pct(topCountry.share)}
                </span>
              </>
            ) : (
              <span>Нет стран в снимке</span>
            )
          }
        />
        <ModuleCard
          contour={byId.production}
          preview={<span>{snapshot.production.message}</span>}
        />
        <ModuleCard
          contour={getContour("plan")!}
          preview={
            <>
              <strong>{formatMetricDisplay(snapshot.plan.planRevenue)}</strong>
              <span>
                Факт {formatMetricDisplay(snapshot.plan.factRevenue)} · прогноз{" "}
                {formatMetricDisplay(snapshot.plan.forecastRevenue)} · {snapshot.plan.indicatorCount}{" "}
                показателей
              </span>
            </>
          }
        />
      </div>
    </div>
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
          <HubPreviews snapshot={snapshot} />
          <OwnerScenarios snapshot={snapshot} />
          <DataSourcesFooter snapshot={snapshot} />
        </>
      )}
    </div>
  );
}
