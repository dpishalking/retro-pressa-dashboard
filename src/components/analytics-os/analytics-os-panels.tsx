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
          <h2>План / Факт / Прогноз</h2>
          <p>
            План: {plan.planSource || "—"} · показателей: {plan.indicatorCount ?? plan.indicators?.length ?? 0}
            <br />
            Прогноз: {plan.forecastSource}
          </p>
        </div>
        <StatusBadge status={plan.forecastRevenue.status} />
      </div>
      <div className="aos-plan__grid">
        <div>
          <span>ПЛАН</span>
          <strong>{formatMetricDisplay(plan.planRevenue)}</strong>
        </div>
        <div>
          <span>ФАКТ</span>
          <strong>{formatMetricDisplay(plan.factRevenue)}</strong>
        </div>
        <div>
          <span>ПРОГНОЗ</span>
          <strong>{formatMetricDisplay(plan.forecastRevenue)}</strong>
        </div>
        <div>
          <span>РАЗРЫВ</span>
          <strong>{formatMetricDisplay(plan.gap)}</strong>
        </div>
        <div>
          <span>ПРОГРЕСС</span>
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
        Дни: {plan.daysElapsed} · Остаток: {plan.daysRemaining} · Месяц: {plan.calendarDays}
      </div>
    </section>
  );
}

export function PlanIndicatorsPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const indicators = snapshot.plan.indicators || [];
  const sections = Array.from(new Set(indicators.map((item) => item.section)));
  return (
    <section className="aos-card" id="aos-plan-indicators">
      <div className="aos-section-head">
        <div>
          <h2>План месяца</h2>
          <p>
            {snapshot.plan.planSource || "Google Sheets · План/факт"} · {indicators.length} показателей
          </p>
        </div>
        <StatusBadge status={indicators.length > 0 ? "live" : "no_data"} />
      </div>
      {indicators.length === 0 ? (
        <p className="aos-muted">Нет плана за {snapshot.period}</p>
      ) : (
        <div className="table-scroll">
          <table className="aos-table">
            <thead>
              <tr>
                <th>Блок</th>
                <th>Показатель</th>
                <th>План</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((item) => (
                <tr key={item.id}>
                  <td>{item.section}</td>
                  <td>{item.label}</td>
                  <td>
                    {item.unit === "eur"
                      ? eur(item.value)
                      : item.unit === "pct"
                        ? pct(item.value)
                        : item.unit === "ratio"
                          ? `${number(item.value, 2)}×`
                          : number(item.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sections.length > 0 ? (
        <p className="aos-muted" style={{ marginTop: "0.75rem" }}>
          Блоки: {sections.join(" · ")}
        </p>
      ) : null}
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
          <h2>Выручка</h2>
          <p>Bitrix → страны → продукты → менеджеры</p>
        </div>
        <StatusBadge status={revenueTree.total.status} />
      </div>
      <div className="aos-revenue-total">{formatMetricDisplay(revenueTree.total)}</div>
      <div className="aos-tree-grid">
        <TreeColumn title="Страны" rows={revenueTree.countries} onClick={(id) => onFilterCountry(id)} />
        <TreeColumn title="Продукты" rows={revenueTree.products} onClick={(id) => onFilterProduct(id)} />
        <TreeColumn title="Менеджеры" rows={revenueTree.managers} onClick={(id) => onFilterManager(id)} />
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
          <h2>Воронка</h2>
          <p>Лиды → Сделки → Счета → Оплаты</p>
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
              Конверсия: {stage.conversionFromPrevious == null ? "—" : pct(stage.conversionFromPrevious)}
              {" · "}
              Отсев: {stage.dropOffFromPrevious == null ? "—" : number(stage.dropOffFromPrevious)}
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
          <h2>Менеджеры</h2>
          <p>Топ 20% по выручке</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Менеджер</th>
              <th>Лиды</th>
              <th>Оплаты</th>
              <th>Выручка</th>
              <th>Конверсия</th>
              <th>Чек</th>
              <th>Товары / заказ</th>
              <th>Ответ</th>
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
                    {row.isTopPerformer ? <span className="aos-chip">ТОП 20%</span> : null}
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
          <h2>Продукты</h2>
          <p>
            Основной товар · Заказы с 2+ товарами:{" "}
            {formatMetricDisplay(snapshot.multiProductOrdersPct)} <StatusBadge status="partial" />
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Продукт</th>
              <th>Заказы</th>
              <th>Выручка</th>
              <th>Чек</th>
              <th>Доля</th>
              <th>Товары / заказ</th>
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
          <h2>Страны</h2>
          <p>Выручка = страна заказа · Конверсия = страна лида</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Страна</th>
              <th>Выручка</th>
              <th>Заказы</th>
              <th>Чек</th>
              <th>Доля</th>
              <th>Лиды</th>
              <th>Конверсия</th>
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
          <h2>Клиенты</h2>
          <p>Повтор и средний LTV — частично</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Клиенты", c.customers],
          ["Новые", c.newCustomers],
          ["Повтор", c.repeatCustomers],
          ["Доля повтора", c.repeatRate],
          ["Средняя выручка", c.avgCustomerRevenue]
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
          <h2>Юнит-экономика</h2>
          <p>{m.note}</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Средний чек", snapshot.metrics.aov],
          ["CPL", m.cpl],
          ["CAC", m.cac],
          ["ROAS", m.roas],
          ["Валовая прибыль", snapshot.metrics.gross_profit],
          ["Маржа вклада", snapshot.metrics.contribution_margin]
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
        Доставка, комиссии и полная себестоимость по заказу пока нет.
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
          <h2>Открытая воронка</h2>
          <p>Открытые сделки</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Сделки", p.openDeals],
          ["Сумма", p.pipelineAmount],
          ["С весом", p.weightedAmount],
          ["Просрочка", p.overdueDeals]
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
          <h2>Производство</h2>
          <p>{p.message}</p>
        </div>
        <StatusBadge status={p.status} />
      </div>
      <div className="aos-two-col">
        <div>
          <h3>Есть</h3>
          <ul>
            {p.available.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Нет</h3>
          <ul>
            {p.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <button type="button" className="aos-cta" disabled>
        Подключить источник
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
          <h2>Сверка выручки</h2>
          <p>Без среднего. Основной источник — Bitrix.</p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Bitrix", r.bitrixRevenue],
          ["Maria", r.mariaRevenue],
          ["СВОД", r.svodAttributedRevenue],
          ["Разница Bitrix−Maria", r.bitrixVsMariaDelta],
          ["Разница %", r.bitrixVsMariaDeltaPct]
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
          <h2>ДЛЯ СОБСТВЕННИКА</h2>
          <p>Правила · не Gemini</p>
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
                Digital Twin →
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
          <h2>ОДНА МОДЕЛЬ ДАННЫХ</h2>
          <p>Источники и свежесть</p>
        </div>
      </div>
      <div className="aos-sources-grid">
        {snapshot.sources.map((source) => (
          <article key={source.id} className="aos-source-card">
            <div className="aos-source-card__top">
              <strong>{source.name}</strong>
              <span className={`aos-conn aos-conn--${source.connection}`}>
                {source.connection === "connected"
                  ? "Есть"
                  : source.connection === "partial"
                    ? "Частично"
                    : "Нет"}
              </span>
            </div>
            <div className="aos-muted">Синк: {source.lastSync || "—"}</div>
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
          <h2>Качество данных</h2>
          <p>
            {q.label === "AUDIT BASELINE" ? "База аудита" : q.label}
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
            <span>
              {domain.id === "sales"
                ? "Продажи"
                : domain.id === "marketing"
                  ? "Маркетинг"
                  : domain.id === "product"
                    ? "Продукт"
                    : domain.id === "finance"
                      ? "Финансы"
                      : domain.id === "operations"
                        ? "Операции"
                        : domain.name}
            </span>
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
          <h2>Маркетинг</h2>
          <p>{m.note}</p>
        </div>
        <Link href="/ad-analytics" className="aos-link">
          Реклама →
        </Link>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Расход", m.adSpend],
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
