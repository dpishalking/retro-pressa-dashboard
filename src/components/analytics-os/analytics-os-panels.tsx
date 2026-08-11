"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CeoControlCenterSnapshot, UnitEconomicsKind, UnitEconomicsUnit } from "@/types/analytics-os";
import { formatMetricDisplay, StatusBadge } from "@/components/analytics-os/format-metric";
import { eur, number, pct } from "@/lib/format";

export function PlanFactForecast({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const { plan } = snapshot;
  return (
    <section className="aos-card aos-plan">
      <div className="aos-section-head">
        <div>
          <h2>План / Факт / Прогноз</h2>
          <p>План из таблицы · прогноз, если текущий темп сохранится</p>
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
          <p>Таблица «План/факт» · {indicators.length} показателей</p>
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
          <p>По странам, продуктам и менеджерам</p>
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
  const uniqueLeads = snapshot.metrics.unique_leads;
  const uniqueCr = snapshot.metrics.unique_conversion_rate;
  return (
    <section className="aos-card" id="aos-funnel">
      <div className="aos-section-head">
        <div>
          <h2>Воронка</h2>
          <p>
            Лиды → сделки → счета → оплаты · уникальные люди:{" "}
            {uniqueLeads ? formatMetricDisplay(uniqueLeads) : "—"} · конверсия уникальных:{" "}
            {uniqueCr ? formatMetricDisplay(uniqueCr) : "—"}
          </p>
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
      {uniqueLeads?.decisionHint ? <p className="aos-note">{uniqueLeads.decisionHint}</p> : null}
    </section>
  );
}

export function ManagersPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const b = snapshot.managerBenchmark;
  return (
    <section className="aos-card" id="aos-managers">
      <div className="aos-section-head">
        <div>
          <h2>Менеджеры</h2>
          <p>Топ 20% по €/лид (от 10 лидов)</p>
        </div>
      </div>
      <div className="aos-stat-grid" style={{ marginBottom: 16 }}>
        <div className="aos-stat">
          <span>Медиана CR</span>
          <strong>{b.medianCr == null ? "—" : pct(b.medianCr)}</strong>
        </div>
        <div className="aos-stat">
          <span>P80 CR</span>
          <strong>{b.p80Cr == null ? "—" : pct(b.p80Cr)}</strong>
        </div>
        <div className="aos-stat">
          <span>Медиана €/лид</span>
          <strong>{b.medianRevenuePerLead == null ? "—" : eur(b.medianRevenuePerLead)}</strong>
        </div>
        <div className="aos-stat">
          <span>P80 €/лид</span>
          <strong>{b.p80RevenuePerLead == null ? "—" : eur(b.p80RevenuePerLead)}</strong>
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
              <th>€ / лид</th>
              <th>Конверсия</th>
              <th>Чек</th>
              <th>Товары / заказ</th>
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
                  <td>{row.revenuePerLead == null ? "—" : eur(row.revenuePerLead)}</td>
                  <td>{row.conversionRate == null ? "—" : pct(row.conversionRate)}</td>
                  <td>{row.aov == null ? "—" : eur(row.aov)}</td>
                  <td>{row.productsPerOrder == null ? "—" : number(row.productsPerOrder, 2)}</td>
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
  const catalogProducts = snapshot.products.filter(
    (row) => !/^(без продукта|не заполнен в crm)$/i.test(row.productName.trim())
  );
  const missingProduct = snapshot.products.filter((row) =>
    /^(без продукта|не заполнен в crm)$/i.test(row.productName.trim())
  );
  const missingOrders = missingProduct.reduce((sum, row) => sum + row.orders, 0);
  const missingRevenue = missingProduct.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <>
      <section className="aos-card" id="aos-products">
        <div className="aos-section-head">
          <div>
            <h2>Продукты</h2>
            <p>
              Основной товар · 2+ в заказе: {formatMetricDisplay(snapshot.multiProductOrdersPct)} · валовая{" "}
              {formatMetricDisplay(snapshot.productMargin.marginRate)}{" "}
              <StatusBadge status={snapshot.productMargin.marginRate.status} />
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
                <th>COGS</th>
                <th>Валовая</th>
                <th>Маржа</th>
                <th>Чек</th>
                <th>Доля</th>
              </tr>
            </thead>
            <tbody>
              {catalogProducts.length === 0 ? (
                <tr>
                  <td colSpan={8}>—</td>
                </tr>
              ) : (
                catalogProducts.map((row) => (
                  <tr key={row.productId}>
                    <td>{row.productName}</td>
                    <td>{number(row.orders)}</td>
                    <td>{eur(row.revenue)}</td>
                    <td>{row.cogs == null ? "—" : eur(row.cogs)}</td>
                    <td>{row.grossProfit == null ? "—" : eur(row.grossProfit)}</td>
                    <td>{row.marginRate == null ? "—" : pct(row.marginRate)}</td>
                    <td>{eur(row.aov)}</td>
                    <td>{pct(row.share)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {missingOrders > 0 ? (
          <p className="aos-note">
            В Bitrix без товара в карточке: {number(missingOrders)} оплат · {eur(missingRevenue)}. В таблице
            продуктов их нет — это дыра заполнения CRM, не отдельный продукт.
          </p>
        ) : null}
      </section>
      <section className="aos-card" id="aos-pricing">
        <div className="aos-section-head">
          <div>
            <h2>Цена витрины vs продажа</h2>
            <p>Product Hub retail vs средняя цена строки Bitrix</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="aos-table">
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Продаж</th>
                <th>Витрина</th>
                <th>Средняя продажа</th>
                <th>Медиана</th>
                <th>Δ к витрине</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot.pricingCompare || []).length === 0 ? (
                <tr>
                  <td colSpan={6}>Нет сопоставления (нужен Product Hub + цены строк)</td>
                </tr>
              ) : (
                snapshot.pricingCompare.map((row) => (
                  <tr key={row.productName}>
                    <td>{row.productName}</td>
                    <td>{number(row.orders)}</td>
                    <td>{row.listPrice == null ? "—" : eur(row.listPrice)}</td>
                    <td>{row.soldAvg == null ? "—" : eur(row.soldAvg)}</td>
                    <td>{row.soldMedian == null ? "—" : eur(row.soldMedian)}</td>
                    <td>
                      {row.deltaPct == null
                        ? "—"
                        : `${row.deltaPct > 0 ? "+" : ""}${number(row.deltaPct, 1)}%`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
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

const UNIT_KIND_OPTIONS: Array<{ id: UnitEconomicsKind; label: string; hint: string }> = [
  { id: "average", label: "Средняя оплата", hint: "Вся компания как один юнит" },
  { id: "product", label: "Продукт", hint: "Конкретный товар в заказе" },
  { id: "manager", label: "Менеджер", hint: "Продавец и его воронка" },
  { id: "country", label: "Страна", hint: "География продаж" },
  { id: "gift_type", label: "Тип подарка", hint: "Оригинал, репродукция и др." },
  { id: "deal", label: "Одна продажа", hint: "Конкретная оплаченная сделка" }
];

function UnitStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className={`aos-stat${tone ? ` aos-stat--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function unitTone(value: number | null, goodIfPositive = true): "ok" | "warn" | "bad" | undefined {
  if (value == null) return undefined;
  if (goodIfPositive) return value > 0 ? "ok" : value < 0 ? "bad" : "warn";
  return undefined;
}

export function UnitEconomicsPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const units = snapshot.unitEconomics?.units || [];
  const [kind, setKind] = useState<UnitEconomicsKind>("average");
  const [unitId, setUnitId] = useState("average");

  const options = useMemo(() => units.filter((unit) => unit.kind === kind), [units, kind]);

  useEffect(() => {
    if (!options.length) return;
    if (!options.some((unit) => unit.id === unitId)) {
      setUnitId(options[0].id);
    }
  }, [options, unitId]);

  const selected: UnitEconomicsUnit | null =
    options.find((unit) => unit.id === unitId) || options[0] || null;
  const kindMeta = UNIT_KIND_OPTIONS.find((item) => item.id === kind);

  return (
    <section className="aos-card" id="aos-unit-economics">
      <div className="aos-section-head">
        <div>
          <h2>Юнит-экономика</h2>
          <p>Выберите юнит → смотрите маржу и стоимость продажи</p>
        </div>
        <StatusBadge status={selected?.mapped ? "calculated" : "partial"} />
      </div>

      <div className="aos-unit-kinds" role="tablist" aria-label="Тип юнита">
        {UNIT_KIND_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={kind === item.id}
            className={`aos-unit-kind${kind === item.id ? " is-active" : ""}`}
            onClick={() => {
              setKind(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {kind !== "average" ? (
        <label className="aos-unit-pick">
          <span>{kindMeta?.label || "Юнит"}</span>
          <select value={selected?.id || ""} onChange={(event) => setUnitId(event.target.value)}>
            {options.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
                {kind === "deal" && unit.closeDate ? ` · ${unit.closeDate.slice(0, 10)}` : ""}
                {kind !== "deal" ? ` · ${unit.orders} опл.` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!selected ? (
        <p className="aos-muted">Нет оплат за период для выбранного юнита.</p>
      ) : (
        <>
          <p className="aos-unit-selected">
            <strong>{selected.name}</strong>
            <span>{kindMeta?.hint}</span>
          </p>

          <div className="aos-stat-grid">
            <UnitStat
              label={kind === "deal" ? "Выручка продажи" : "Выручка юнита"}
              value={eur(selected.revenue)}
            />
            <UnitStat
              label={kind === "deal" ? "Оплата" : "Оплат"}
              value={kind === "deal" ? "1" : number(selected.orders)}
            />
            <UnitStat label="Средний чек без доставки" value={eur(selected.aov)} />
            <UnitStat
              label="Себестоимость"
              value={selected.cogs == null ? "—" : eur(selected.cogs)}
              tone={selected.cogs == null ? "warn" : undefined}
            />
            <UnitStat
              label="Валовая прибыль"
              value={selected.grossProfit == null ? "—" : eur(selected.grossProfit)}
              tone={unitTone(selected.grossProfit)}
            />
            <UnitStat
              label="Валовая маржа"
              value={selected.marginRate == null ? "—" : pct(selected.marginRate)}
              tone={
                selected.marginRate == null
                  ? "warn"
                  : selected.marginRate >= 0.5
                    ? "ok"
                    : selected.marginRate >= 0.3
                      ? "warn"
                      : "bad"
              }
            />
            <UnitStat
              label="Стоимость 1 продажи"
              value={selected.saleCost == null ? "—" : eur(selected.saleCost)}
              tone={selected.saleCost == null ? "warn" : undefined}
            />
            <UnitStat
              label="После стоимости продажи"
              value={selected.profitAfterSaleCost == null ? "—" : eur(selected.profitAfterSaleCost)}
              tone={unitTone(selected.profitAfterSaleCost)}
            />
            {selected.leads != null ? (
              <UnitStat label="Лиды юнита" value={number(selected.leads)} />
            ) : null}
          </div>

          <p className="aos-note">
            {selected.saleCostNote}. Себестоимость — из каталога по позициям заказа; доставка из выручки
            уже вычтена. Комиссии платёжек ещё не вычтены.
            {selected.mapped ? "" : " У этого юнита нет полной себестоимости по товарам."}
          </p>

          {kind !== "average" && kind !== "deal" && options.length > 1 ? (
            <div className="table-scroll" style={{ marginTop: "1rem" }}>
              <table className="aos-table">
                <thead>
                  <tr>
                    <th>{kindMeta?.label}</th>
                    <th>Оплат</th>
                    <th>Чек</th>
                    <th>Маржа</th>
                    <th>Стоимость продажи</th>
                    <th>После затрат</th>
                  </tr>
                </thead>
                <tbody>
                  {options.slice(0, 20).map((unit) => (
                    <tr
                      key={unit.id}
                      className={unit.id === selected.id ? "aos-row-active" : undefined}
                      onClick={() => setUnitId(unit.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{unit.name}</td>
                      <td>{number(unit.orders)}</td>
                      <td>{eur(unit.aov)}</td>
                      <td>{unit.marginRate == null ? "—" : pct(unit.marginRate)}</td>
                      <td>{unit.saleCost == null ? "—" : eur(unit.saleCost)}</td>
                      <td>{unit.profitAfterSaleCost == null ? "—" : eur(unit.profitAfterSaleCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export function PipelinePanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const p = snapshot.pipeline;
  const age = p.age;
  return (
    <section className="aos-card">
      <div className="aos-section-head">
        <div>
          <h2>Открытая воронка</h2>
          <p>
            Без касания &gt;7 дн.: {age ? number(age.stuckOver7d.deals) : "—"} ·{" "}
            {age ? eur(age.stuckOver7d.amount) : "—"}
            {age?.activityCoveragePct != null
              ? ` · LAST_ACTIVITY ${Math.round(age.activityCoveragePct * 100)}%`
              : ""}
          </p>
        </div>
      </div>
      <div className="aos-stat-grid">
        {[
          ["Сделки", p.openDeals],
          ["Сумма", p.pipelineAmount],
          ["С весом", p.weightedAmount],
          ["Без касания >7 дн.", p.overdueDeals]
        ].map(([label, metric]) => (
          <div key={String(label)} className="aos-stat">
            <span>{label as string}</span>
            <strong>{formatMetricDisplay(metric as typeof p.openDeals)}</strong>
            <StatusBadge status={(metric as typeof p.openDeals).status} />
          </div>
        ))}
      </div>
      {age?.byStage?.length ? (
        <div className="table-scroll" style={{ marginTop: 16 }}>
          <table className="aos-table">
            <thead>
              <tr>
                <th>Стадия</th>
                <th>Сделки</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {age.byStage.slice(0, 10).map((row) => (
                <tr key={row.stageId}>
                  <td>{row.stageName}</td>
                  <td>{number(row.deals)}</td>
                  <td>{eur(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {age?.buckets?.length ? (
        <div className="table-scroll" style={{ marginTop: 16 }}>
          <table className="aos-table">
            <thead>
              <tr>
                <th>Простой (с касания)</th>
                <th>Сделки</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {age.buckets.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{number(row.deals)}</td>
                  <td>{eur(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function OpportunitiesPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const rows = snapshot.opportunities || [];
  return (
    <section className="aos-card" id="aos-opportunities">
      <div className="aos-section-head">
        <div>
          <h2>Где теряем деньги</h2>
          <p>Разрывы vs медиана CR / €/лид · оценка upside</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="aos-note">Пока нет значимых разрывов (нужно ≥40 лидов в сегменте).</p>
      ) : (
        <div className="table-scroll">
          <table className="aos-table">
            <thead>
              <tr>
                <th>Сегмент</th>
                <th>Деталь</th>
                <th>Upside ≈</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.body}</td>
                  <td>{row.euroImpact == null ? "—" : eur(row.euroImpact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
