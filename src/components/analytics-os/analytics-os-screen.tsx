"use client";

import { useEffect, useMemo, useState } from "react";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { AnalyticsOsSidebar, type AnalyticsOsSection } from "@/components/analytics-os/analytics-os-sidebar";
import { AnalyticsKpiRow } from "@/components/analytics-os/kpi-row";
import {
  CountriesPanel,
  CustomersPanel,
  DataFoundationPanel,
  DataQualityPanel,
  FunnelPanel,
  ManagersPanel,
  MarketingPanel,
  OwnerIntelligencePanel,
  PipelinePanel,
  PlanFactForecast,
  ProductionPanel,
  ProductsPanel,
  ReconciliationPanel,
  RevenueTreePanel,
  UnitEconomicsPanel
} from "@/components/analytics-os/analytics-os-panels";
import { StatusBadge } from "@/components/analytics-os/format-metric";

type LoadState = "loading" | "ok" | "error";

export function AnalyticsOsScreen() {
  const [section, setSection] = useState<AnalyticsOsSection>("overview");
  const [period, setPeriod] = useState<string>("");
  const [country, setCountry] = useState("");
  const [managerId, setManagerId] = useState("");
  const [productId, setProductId] = useState("");
  const [snapshot, setSnapshot] = useState<CeoControlCenterSnapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (country) params.set("country", country);
    if (managerId) params.set("managerId", managerId);
    if (productId) params.set("productId", productId);
    return params.toString();
  }, [period, country, managerId, productId]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError("");
    fetch(`/api/analytics/ceo-snapshot${query ? `?${query}` : ""}`)
      .then(async (response) => {
        const json = (await response.json()) as CeoControlCenterSnapshot & { error?: string };
        if (!response.ok) throw new Error(json.error || "Ошибка загрузки");
        if (cancelled) return;
        setSnapshot(json);
        setPeriod((current) => current || json.period);
        setState("ok");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState("error");
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const health =
    snapshot == null
      ? "—"
      : snapshot.asOf
        ? "OK"
        : snapshot.metrics.revenue.status === "no_data"
          ? "NO DATA"
          : "PARTIAL";

  return (
    <div className="aos-root">
      <header className="aos-topbar">
        <div>
          <div className="aos-topbar__title">RETRO PRESSA ANALYTICS OS</div>
          <div className="aos-topbar__subtitle">CEO Control Center</div>
        </div>
        <div className="aos-topbar__meta">
          <label>
            Period
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
            <span>Last Sync</span>
            <strong>{snapshot?.asOf ? new Date(snapshot.asOf).toLocaleString("ru-RU") : "—"}</strong>
          </div>
          <div className="aos-topbar__stat">
            <span>Data Health</span>
            <strong>{health}</strong>
          </div>
          <a className="aos-topbar__hub" href="/hub">
            Кабинет
          </a>
        </div>
      </header>

      <div className="aos-layout">
        <AnalyticsOsSidebar active={section} onNavigate={setSection} />

        <main className="aos-main">
          <div className="aos-filters">
            <label>
              Country
              <select value={country} onChange={(event) => setCountry(event.target.value)}>
                <option value="">All</option>
                {(snapshot?.filterOptions.countries || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Manager
              <select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                <option value="">All</option>
                {(snapshot?.filterOptions.managers || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">All</option>
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
                Сбросить фильтры
              </button>
            )}
            {state === "loading" ? <StatusBadge status="calculated" /> : null}
            {state === "error" ? <span className="aos-error">{error}</span> : null}
          </div>

          {!snapshot ? (
            <section className="aos-card">
              <p>{state === "error" ? error : "Загрузка CEO Control Center…"}</p>
            </section>
          ) : (
            <>
              {(section === "overview" || section === "revenue") && (
                <>
                  <AnalyticsKpiRow snapshot={snapshot} />
                  <PlanFactForecast snapshot={snapshot} />
                </>
              )}

              <div className="aos-main-grid">
                {(section === "overview" || section === "revenue") && (
                  <RevenueTreePanel
                    snapshot={snapshot}
                    onFilterCountry={setCountry}
                    onFilterManager={setManagerId}
                    onFilterProduct={setProductId}
                  />
                )}
                {(section === "overview" || section === "funnel") && <FunnelPanel snapshot={snapshot} />}
                {(section === "overview" || section === "managers") && <ManagersPanel snapshot={snapshot} />}
              </div>

              {(section === "overview" || section === "managers" || section === "funnel") && (
                <div className="aos-main-grid aos-main-grid--2">
                  <PipelinePanel snapshot={snapshot} />
                  <ReconciliationPanel snapshot={snapshot} />
                </div>
              )}

              {(section === "overview" || section === "products") && <ProductsPanel snapshot={snapshot} />}
              {(section === "overview" || section === "countries") && <CountriesPanel snapshot={snapshot} />}
              {(section === "overview" || section === "customers") && <CustomersPanel snapshot={snapshot} />}
              {(section === "overview" || section === "unit-economics") && <UnitEconomicsPanel snapshot={snapshot} />}
              {(section === "overview" || section === "marketing") && <MarketingPanel snapshot={snapshot} />}
              {(section === "overview" || section === "production") && <ProductionPanel snapshot={snapshot} />}

              {section === "overview" && <OwnerIntelligencePanel snapshot={snapshot} />}
              {(section === "overview" || section === "sources") && <DataFoundationPanel snapshot={snapshot} />}
              {(section === "overview" || section === "quality") && <DataQualityPanel snapshot={snapshot} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
