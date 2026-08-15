"use client";

import Link from "next/link";
import { Suspense } from "react";
import type { ContourDef } from "@/lib/analytics-os/contours";
import {
  BUSINESS_CONTOUR_PATHS,
  businessContourForOsId,
  contourStatusLabel,
  siblingContours
} from "@/lib/analytics-os/contours";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";
import { AnalyticsKpiRow } from "@/components/analytics-os/kpi-row";
import { StatusBadge } from "@/components/analytics-os/format-metric";
import {
  CountriesPanel,
  CustomersPanel,
  DataFoundationPanel,
  DataQualityPanel,
  FunnelPanel,
  ManagersPanel,
  MarketingPanel,
  OpportunitiesPanel,
  OwnerIntelligencePanel,
  PipelinePanel,
  PlanFactForecast,
  PlanIndicatorsPanel,
  ProductionPanel,
  ProductsPanel,
  ReconciliationPanel,
  RevenueTreePanel,
  UnitEconomicsPanel
} from "@/components/analytics-os/analytics-os-panels";
import { CohortsPanel } from "@/components/analytics-os/cohorts-panel";
import { SalesCyclePanel } from "@/components/analytics-os/sales-cycle-panel";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { MarketingPredictivePanel } from "@/components/analytics-os/marketing-predictive-panel";
import { FactorAnalysisPanel } from "@/components/analytics-os/factor-analysis-panel";
import { AnalysisScenariosPanel } from "@/components/analytics-os/analysis-scenarios-panel";
import { AnalysisSlicesPanel } from "@/components/analytics-os/analysis-slices-panel";

function StubPanel({ contour }: { contour: ContourDef }) {
  return (
    <section className="aos-card aos-card--warn">
      <div className="aos-section-head">
        <div>
          <h2>{contour.title}</h2>
          <p>{contour.subtitle}</p>
        </div>
        <StatusBadge status="no_data" />
      </div>
      <p className="aos-muted">
        По этому разделу пока нет живых данных. Экран уже в навигации — источник можно подключить без
        смены структуры.
      </p>
      <DecisionBrief empty />
    </section>
  );
}

export function AnalyticsOsContourScreen({ contour }: { contour: ContourDef }) {
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
  const businessId = businessContourForOsId(contour.id);
  const backHref = businessId ? BUSINESS_CONTOUR_PATHS[businessId] : "/hub";
  const siblings = siblingContours(contour.id);

  return (
    <div className="aos-root aos-root--contour">
      <header className="aos-topbar">
        <div>
          <Link href={backHref} className="aos-back">
            ← Назад
          </Link>
          <div className="aos-topbar__title">{contour.title}</div>
          <div className="aos-topbar__subtitle">{contour.subtitle}</div>
        </div>
        <div className="aos-topbar__meta">
          <span className={`aos-contour-pill aos-contour-pill--${contour.status}`}>
            {contourStatusLabel(contour.status)}
          </span>
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
          <a className="aos-topbar__hub" href="/hub">
            Кабинет
          </a>
        </div>
      </header>

      <div className="aos-contour-layout">
        <aside className="aos-contour-nav">
          <p className="aos-contour-nav__title">В этом направлении</p>
          <nav>
            {siblings.map((item, index) => (
              <Link
                key={item.id}
                href={item.href}
                className={`aos-contour-nav__link ${item.id === contour.id ? "is-active" : ""}`}
              >
                <span>{index + 1}</span>
                {item.shortTitle}
              </Link>
            ))}
          </nav>
          <div className="aos-contour-nav__extra">
            <Link href={backHref}>К сводке направления</Link>
            <Link href="/os">Общая аналитика</Link>
          </div>
        </aside>

        <main className="aos-main">
          <div className="aos-filters aos-filters--bar">
            <p className="aos-filters__title">Фильтры</p>
            <div className="aos-filters__controls">
              <label>
                Страна
                <select value={country} onChange={(event) => setCountry(event.target.value)} disabled={!snapshot}>
                  <option value="">Все</option>
                  {(snapshot?.filterOptions.countries || []).filter(Boolean).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Менеджер
                <select value={managerId} onChange={(event) => setManagerId(event.target.value)} disabled={!snapshot}>
                  <option value="">Все</option>
                  {(snapshot?.filterOptions.managers || [])
                    .filter((item) => item.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Продукт
                <select value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!snapshot}>
                  <option value="">Все</option>
                  {(snapshot?.filterOptions.products || [])
                    .filter((item) => item.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {state === "loading" && snapshot ? (
              <p className="aos-muted" style={{ margin: 0 }}>
                Обновляю срез…
              </p>
            ) : null}
            {state === "error" ? <span className="aos-error">{error}</span> : null}
          </div>

          {!snapshot ? (
            <section className="aos-card">
              <p>{state === "error" ? error : "Загрузка…"}</p>
            </section>
          ) : (
            <>
              {(contour.id === "revenue" || contour.id === "plan") && <AnalyticsKpiRow snapshot={snapshot} />}

              {contour.id === "revenue" && (
                <>
                  <PlanFactForecast snapshot={snapshot} />
                  <RevenueTreePanel
                    snapshot={snapshot}
                    onFilterCountry={setCountry}
                    onFilterManager={setManagerId}
                    onFilterProduct={setProductId}
                  />
                  <ReconciliationPanel snapshot={snapshot} />
                </>
              )}
              {contour.id === "plan" && (
                <>
                  <PlanFactForecast snapshot={snapshot} />
                  <PlanIndicatorsPanel snapshot={snapshot} />
                </>
              )}
              {contour.id === "factors" && <FactorAnalysisPanel snapshot={snapshot} />}
              {contour.id === "scenarios" && (
                <Suspense fallback={<section className="aos-card"><p>Загрузка сценариев…</p></section>}>
                  <AnalysisScenariosPanel snapshot={snapshot} />
                </Suspense>
              )}
              {contour.id === "slices" && (
                <Suspense fallback={<section className="aos-card"><p>Загрузка срезов…</p></section>}>
                  <AnalysisSlicesPanel
                    period={period}
                    country={country}
                    managerId={managerId}
                    productId={productId}
                    setPeriod={setPeriod}
                    setCountry={setCountry}
                    setManagerId={setManagerId}
                    setProductId={setProductId}
                  />
                </Suspense>
              )}
              {contour.id === "unit-economics" && <UnitEconomicsPanel snapshot={snapshot} />}
              {contour.id === "products" && <ProductsPanel snapshot={snapshot} />}
              {contour.id === "customers" && <CustomersPanel snapshot={snapshot} />}
              {contour.id === "marketing" && (
                <>
                  <MarketingPredictivePanel period={period} />
                  <MarketingPanel snapshot={snapshot} />
                </>
              )}
              {contour.id === "funnel" && (
                <>
                  <FunnelPanel snapshot={snapshot} />
                  <PipelinePanel snapshot={snapshot} />
                  <OpportunitiesPanel snapshot={snapshot} />
                  <SalesCyclePanel
                    period={period}
                    managerId={managerId || undefined}
                    country={country || undefined}
                    productId={productId || undefined}
                  />
                </>
              )}
              {contour.id === "managers" && (
                <>
                  <ManagersPanel
                    snapshot={snapshot}
                    selectedManagerId={managerId}
                    onSelectManager={setManagerId}
                  />
                  <OpportunitiesPanel snapshot={snapshot} />
                </>
              )}
              {contour.id === "geography" && (
                <>
                  <CountriesPanel snapshot={snapshot} />
                  <OpportunitiesPanel snapshot={snapshot} />
                </>
              )}
              {contour.id === "production" && <ProductionPanel snapshot={snapshot} />}
              {contour.id === "sources" && (
                <>
                  <DataFoundationPanel snapshot={snapshot} />
                  <DataQualityPanel snapshot={snapshot} />
                </>
              )}
              {contour.id === "cohorts" && (
                <CohortsPanel
                  period={period}
                  managerId={managerId || undefined}
                  country={country || undefined}
                  productId={productId || undefined}
                />
              )}
              {contour.id === "sales-cycle" && (
                <SalesCyclePanel
                  period={period}
                  managerId={managerId || undefined}
                  country={country || undefined}
                  productId={productId || undefined}
                />
              )}
              {contour.id === "creatives" && <StubPanel contour={contour} />}
              {(contour.id === "revenue" || contour.id === "funnel" || contour.id === "managers") && (
                <OwnerIntelligencePanel snapshot={snapshot} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
