"use client";

import Link from "next/link";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import { eur, number, pct } from "@/lib/format";

export function PlanFactForecast({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const { plan } = snapshot;
  return (
    <section className="aos-card aos-plan">
      <div className="aos-section-head">
        <div>
          <h2>Plan / Fact / Forecast</h2>
          <p>Источник прогноза: {plan.forecastSource}</p>
        </div>
        <StatusBadge status={plan.forecastRevenue.status} />
      </div>
      <div className="aos-plan__grid">
        <div>
          <span>PLAN</span>
          <strong>{formatMetricDisplay(plan.planRevenue)}</strong>
        </div>
        <div>
          <span>FACT</span>
          <strong>{formatMetricDisplay(plan.factRevenue)}</strong>
        </div>
        <div>
          <span>FORECAST</span>
          <strong>{formatMetricDisplay(plan.forecastRevenue)}</strong>
        </div>
        <div>
          <span>GAP</span>
          <strong>{formatMetricDisplay(plan.gap)}</strong>
        </div>
        <div>
          <span>PROGRESS</span>
          <strong>{formatMetricDisplay(plan.planCompletion)}</strong>
        </div>
      </div>
      <div className="aos-plan__bar">
        <div
          className="aos-plan__bar-fill"
          style={{
            width: `${Math.min(100, Math.max(0, (plan.planCompletion.value ?? 0) * 100))}%`
          }}
        />
      </div>
      <div className="aos-plan__days">
        Дней прошло: {plan.daysElapsed} · Осталось: {plan.daysRemaining} · Календарь: {plan.calendarDays}
      </div>
    </section>
  );
}

export function RevenueTreePanel({
  snapshot,
  onFilterCountry,
  onFilterManager,
  onFilterProduct
}: {
  snapshot: CeoControlCenterSnapshot;
  onFilterCountry: (country: string) => void;
  onFilterManager: (managerId: string) => void;
  onFilterProduct: (productId: string) => void;
}) {
  const { revenueTree } = snapshot;
  return (
    <section className="aos-card" id="aos-revenue">
      <div className="aos-section-head">
        <div>
          <h2>Revenue Tree</h2>
          <p>Bitrix WON → страны → продукты → менеджеры</p>
        </div>
        <StatusBadge status={revenueTree.total.status} />
      </div>
      <div className="aos-revenue-total">{formatMetricDisplay(revenueTree.total)}</div>
      <div className="aos-tree-grid">
        <TreeColumn title="Top Countries" rows={revenueTree.countries} onClick={(id) => onFilterCountry(id)} />
        <TreeColumn title="Top Products" rows={revenueTree.products} onClick={(id) => onFilterProduct(id)} />
        <TreeColumn title="Top Managers" rows={revenueTree.managers} onClick={(id) => onFilterManager(id)} />
      </div>
    </section>
  );
}

function TreeColumn({
  title,
  rows,
  onClick
}: {
  title: string;
  rows: Array<{ id: string; name: string; revenue: number; share: number }>;
  onClick: (id: string) => void;
}) {
  return (
    <div className="aos-tree-col">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="aos-muted">—</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => onClick(row.id)}>
                <span>{row.name}</span>
                <strong>
                  {eur(row.revenue)} · {pct(row.share)}
                </strong>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FunnelPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-card" id="aos-funnel">
      <div className="aos-section-head">
        <div>
          <h2>Sales Funnel</h2>
          <p>Leads → Deals → Invoices → Paid. Qualified Leads не как LIVE stage.</p>
        </div>
      </div>
      <div className="aos-funnel">
        {snapshot.funnel.map((stage) => (
          <div key={stage.id} className="aos-funnel__stage">
            <div className="aos-funnel__top">
              <span>{stage.label}</span>
              <StatusBadge status={stage.status} />
            </div>
            <strong>{stage.count == null ? "—" : number(stage.count)}</strong>
            <div className="aos-muted">
              CR prev: {stage.conversionFromPrevious == null ? "—" : pct(stage.conversionFromPrevious)}
              {" · "}
              Drop: {stage.dropOffFromPrevious == null ? "—" : number(stage.dropOffFromPrevious)}
            </div>
            {stage.note ? <p className="aos-note">{stage.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ManagersPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-card" id="aos-managers">
      <div className="aos-section-head">
        <div>
          <h2>Managers</h2>
          <p>TOP 20% по выручке отмечены</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Manager</th>
              <th>Leads</th>
              <th>Paid</th>
              <th>Revenue</th>
              <th>CR</th>
              <th>AOV</th>
              <th>Prod/Order</th>
              <th>Response</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.managers.length === 0 ? (
              <tr>
                <td colSpan={8}>—</td>
              </tr>
            ) : (
              snapshot.managers.slice(0, 15).map((row) => (
                <tr key={row.managerId}>
                  <td>
                    {row.managerName}
                    {row.isTopPerformer ? <span className="aos-chip">TOP 20%</span> : null}
                  </td>
                  <td>{number(row.leads)}</td>
                  <td>{number(row.paidOrders)}</td>
                  <td>{eur(row.revenue)}</td>
                  <td>{row.conversionRate == null ? "—" : pct(row.conversionRate)}</td>
                  <td>{row.aov == null ? "—" : eur(row.aov)}</td>
                  <td>{row.productsPerOrder == null ? "—" : number(row.productsPerOrder, 2)}</td>
                  <td>{row.responseMinutes == null ? "—" : `${number(row.responseMinutes)} мин`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProductsPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-card" id="aos-products">
      <div className="aos-section-head">
        <div>
          <h2>Product Analytics</h2>
          <p>
            Primary product · Multi-product orders{" "}
            {formatMetricDisplay(snapshot.multiProductOrdersPct)} <StatusBadge status="partial" />
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Orders</th>
              <th>Revenue</th>
              <th>AOV</th>
              <th>Share</th>
              <th>Prod/Order</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.products.length === 0 ? (
              <tr>
                <td colSpan={6}>—</td>
              </tr>
            ) : (
              snapshot.products.map((row) => (
                <tr key={row.productId}>
                  <td>{row.productName}</td>
                  <td>{number(row.orders)}</td>
                  <td>{eur(row.revenue)}</td>
                  <td>{eur(row.aov)}</td>
                  <td>{pct(row.share)}</td>
                  <td>{number(row.productsPerOrder, 2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CountriesPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-card" id="aos-countries">
      <div className="aos-section-head">
        <div>
          <h2>Countries</h2>
          <p>
            Revenue Country = order/deal country · Lead CR Country = lead country
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>Revenue</th>
              <th>Orders</th>
              <th>AOV</th>
              <th>Share</th>
              <th>Leads</th>
              <th>Lead CR</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.countries.length === 0 ? (
              <tr>
                <td colSpan={7}>—</td>
              </tr>
            ) : (
              snapshot.countries.map((row) => (
                <tr key={row.country}>
                  <td>{row.country}</td>
                  <td>{eur(row.revenue)}</td>
                  <td>{number(row.orders)}</td>
                  <td>{eur(row.aov)}</td>
                  <td>{pct(row.share)}</td>
                  <td>{row.leads == null ? "—" : number(row.leads)}</td>
                  <td>{row.leadConversionRate == null ? "—" : pct(row.leadConversionRate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CustomersPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const c = snapshot.customers;
  return (
    <section className="aos-card" id="aos-customers">
      <div className="aos-section-head">
        <div>
          <h2>Customers / Repeat</h2>
          <p>customer_key identity · LTV = PARTIAL proxy</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Customers", c.customers],
          ["New", c.newCustomers],
          ["Repeat", c.repeatCustomers],
          ["Repeat Rate", c.repeatRate],
          ["Avg Customer Revenue", c.avgCustomerRevenue]
        ].map(([label, metric]) => (
          <div key={String(label)} className="aos-stat">
            <span>{label as string}</span>
            <strong>{formatMetricDisplay(metric as typeof c.customers)}</strong>
            <StatusBadge status={(metric as typeof c.customers).status} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function UnitEconomicsPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const m = snapshot.marketing;
  return (
    <section className="aos-card" id="aos-unit-economics">
      <div className="aos-section-head">
        <div>
          <h2>Unit Economics</h2>
          <p>{m.note}</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["AOV", snapshot.metrics.aov],
          ["CPL", m.cpl],
          ["CAC", m.cac],
          ["ROAS", m.roas],
          ["Gross Profit", snapshot.metrics.gross_profit],
          ["Contribution Margin", snapshot.metrics.contribution_margin]
        ].map(([label, metric]) => (
          <div key={String(label)} className="aos-stat">
            <span>{label as string}</span>
            <strong>{formatMetricDisplay(metric as typeof m.cpl)}</strong>
            <StatusBadge
              status={
                (metric as typeof m.cpl).confidence === "low" && (metric as typeof m.cpl).status === "calculated"
                  ? "partial"
                  : (metric as typeof m.cpl).status
              }
            />
          </div>
        ))}
      </div>
      <p className="aos-note">
        Order-level shipping, payment fees and full actual COGS are not yet available.
      </p>
    </section>
  );
}

export function PipelinePanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const p = snapshot.pipeline;
  return (
    <section className="aos-card">
      <div className="aos-section-head">
        <div>
          <h2>Pipeline</h2>
          <p>Leading indicator — open deals</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Open Deals", p.openDeals],
          ["Pipeline Amount", p.pipelineAmount],
          ["Weighted", p.weightedAmount],
          ["Overdue", p.overdueDeals]
        ].map(([label, metric]) => (
          <div key={String(label)} className="aos-stat">
            <span>{label as string}</span>
            <strong>{formatMetricDisplay(metric as typeof p.openDeals)}</strong>
            <StatusBadge status={(metric as typeof p.openDeals).status} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductionPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const p = snapshot.production;
  return (
    <section className="aos-card aos-card--warn" id="aos-production">
      <div className="aos-section-head">
        <div>
          <h2>Production Analytics</h2>
          <p>{p.message}</p>
        </div>
        <StatusBadge status={p.status} />
      </div>
      <div className="aos-two-col">
        <div>
          <h3>Available</h3>
          <ul>
            {p.available.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Missing</h3>
          <ul>
            {p.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <button type="button" className="aos-cta" disabled>
        Connect Production Source
      </button>
    </section>
  );
}

export function ReconciliationPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const r = snapshot.reconciliation;
  return (
    <section className="aos-card">
      <div className="aos-section-head">
        <div>
          <h2>Revenue Reconciliation</h2>
          <p>Не усредняем. Bitrix — primary CEO Revenue.</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Bitrix WON", r.bitrixRevenue],
          ["Maria", r.mariaRevenue],
          ["СВОД attributed", r.svodAttributedRevenue],
          ["Delta Bitrix−Maria", r.bitrixVsMariaDelta],
          ["Delta %", r.bitrixVsMariaDeltaPct]
        ].map(([label, metric]) => (
          <div key={String(label)} className="aos-stat">
            <span>{label as string}</span>
            <strong>{formatMetricDisplay(metric as typeof r.bitrixRevenue)}</strong>
            <StatusBadge status={(metric as typeof r.bitrixRevenue).status} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function OwnerIntelligencePanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-owner" id="aos-owner">
      <div className="aos-section-head">
        <div>
          <h2>OWNER INTELLIGENCE</h2>
          <p>Rule-based signals · не Gemini</p>
        </div>
      </div>
      <div className="aos-owner__grid">
        {snapshot.ownerIntelligence.map((card) => (
          <article key={card.id} className="aos-owner__card">
            <div className="aos-owner__card-head">
              <h3>{card.title}</h3>
              <StatusBadge status={card.status} />
            </div>
            <p>{card.body}</p>
            {card.href ? (
              <Link href={card.href} className="aos-link">
                Open Digital Twin →
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function DataFoundationPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-foundation" id="aos-sources">
      <div className="aos-section-head">
        <div>
          <h2>ONE DATA MODEL — ONE SOURCE OF TRUTH</h2>
          <p>Data Foundation · freshness и connection status</p>
        </div>
      </div>
      <div className="aos-sources-grid">
        {snapshot.sources.map((source) => (
          <article key={source.id} className="aos-source-card">
            <div className="aos-source-card__top">
              <strong>{source.name}</strong>
              <span className={`aos-conn aos-conn--${source.connection}`}>
                {source.connection === "connected"
                  ? "Connected"
                  : source.connection === "partial"
                    ? "Partial"
                    : "Not Connected"}
              </span>
            </div>
            <div className="aos-muted">Last sync: {source.lastSync || "—"}</div>
            {source.note ? <div className="aos-note">{source.note}</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function DataQualityPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const q = snapshot.dataQuality;
  return (
    <section className="aos-card" id="aos-quality">
      <div className="aos-section-head">
        <div>
          <h2>Data Quality</h2>
          <p>
            {q.label} · mode: {q.mode}
          </p>
        </div>
      </div>
      <div className="aos-quality-score">
        <strong>{q.overallScore}</strong>
        <span>/ 100</span>
      </div>
      <div className="aos-quality-domains">
        {q.domains.map((domain) => (
          <div key={domain.id}>
            <span>{domain.name}</span>
            <strong>{domain.score}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MarketingPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const m = snapshot.marketing;
  return (
    <section className="aos-card" id="aos-marketing">
      <div className="aos-section-head">
        <div>
          <h2>Marketing</h2>
          <p>{m.note}</p>
        </div>
        <Link href="/ad-analytics" className="aos-link">
          Open Ad Analytics →
        </Link>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Ad Spend", m.adSpend],
          ["CPL", m.cpl],
          ["CAC", m.cac],
          ["ROAS", m.roas]
        ].map(([label, metric]) => (
          <div key={String(label)} className="aos-stat">
            <span>{label as string}</span>
            <strong>{formatMetricDisplay(metric as typeof m.cpl)}</strong>
            <StatusBadge
              status={
                (metric as typeof m.cpl).confidence === "low" && (metric as typeof m.cpl).status === "calculated"
                  ? "partial"
                  : (metric as typeof m.cpl).status
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
