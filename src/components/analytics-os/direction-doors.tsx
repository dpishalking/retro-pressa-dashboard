"use client";

import Link from "next/link";
import { BarChart3, Database, GitBranch, Megaphone, Package, Search, Target, WalletCards, type LucideIcon } from "lucide-react";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { formatMetricDisplay } from "@/components/analytics-os/format-metric";
import { ANALYSIS_SCENARIOS, runAnalysisScenario } from "@/lib/analytics-os/analysis-scenarios";
import { BUSINESS_CONTOUR_PATHS, type BusinessContourId } from "@/lib/analytics-os/contours";
import { metricLabel } from "@/lib/analytics-os/metric-glossary";
import { eur, pct } from "@/lib/format";

type DoorMetric = { label: string; value: string };

type DoorDef = {
  id: Exclude<BusinessContourId, "analytics"> | "factors";
  title: string;
  subtitle: string;
  icon: LucideIcon;
  href?: string;
  metrics: (snapshot: CeoControlCenterSnapshot) => DoorMetric[];
};

const DOORS: DoorDef[] = [
  {
    id: "sales",
    title: "Продажи",
    subtitle: "Воронка, команда и прогноз оплат",
    icon: Target,
    metrics: (snapshot) => [
      { label: metricLabel("revenue"), value: formatMetricDisplay(snapshot.metrics.revenue) },
      { label: metricLabel("leads"), value: formatMetricDisplay(snapshot.metrics.leads) },
      {
        label: "CR медиана",
        value:
          snapshot.managerBenchmark.medianCr == null ? "—" : pct(snapshot.managerBenchmark.medianCr)
      },
      {
        label: metricLabel("pipeline_stuck_amount"),
        value: formatMetricDisplay(snapshot.metrics.pipeline_stuck_amount)
      }
    ]
  },
  {
    id: "marketing",
    title: "Маркетинг и трафик",
    subtitle: "Лендинги, бюджет и привлечение",
    icon: Megaphone,
    metrics: (snapshot) => [
      { label: metricLabel("ad_spend"), value: formatMetricDisplay(snapshot.marketing.adSpend) },
      { label: metricLabel("roas"), value: formatMetricDisplay(snapshot.marketing.roas) },
      { label: metricLabel("cpl"), value: formatMetricDisplay(snapshot.marketing.cpl) },
      { label: metricLabel("leads"), value: formatMetricDisplay(snapshot.metrics.leads) }
    ]
  },
  {
    id: "product",
    title: "Продукт",
    subtitle: "SKU, спрос и клиенты",
    icon: Package,
    metrics: (snapshot) => {
      const top = snapshot.products[0];
      return [
        { label: metricLabel("product_aov"), value: formatMetricDisplay(snapshot.metrics.product_aov) },
        {
          label: metricLabel("product_margin_rate"),
          value: formatMetricDisplay(snapshot.productMargin.marginRate)
        },
        {
          label: top ? "Топ SKU" : metricLabel("delivery_revenue"),
          value: top ? top.productName : formatMetricDisplay(snapshot.metrics.delivery_revenue)
        }
      ];
    }
  },
  {
    id: "finance",
    title: "Финансы",
    subtitle: "План, факт и экономика",
    icon: WalletCards,
    metrics: (snapshot) => [
      { label: "План", value: formatMetricDisplay(snapshot.plan.planRevenue) },
      { label: "Факт", value: formatMetricDisplay(snapshot.plan.factRevenue) },
      { label: "Прогноз", value: formatMetricDisplay(snapshot.plan.forecastRevenue) }
    ]
  },
  {
    id: "factors",
    title: "Факторный анализ",
    subtitle: "Что съело план и куда жать",
    icon: GitBranch,
    href: "/os/factors",
    metrics: (snapshot) => [
      { label: "План", value: formatMetricDisplay(snapshot.plan.planRevenue) },
      { label: "Факт", value: formatMetricDisplay(snapshot.plan.factRevenue) },
      { label: "Разрыв", value: formatMetricDisplay(snapshot.plan.gap) }
    ]
  }
];

export function DirectionDoors({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-doors-band" aria-label="Направления бизнеса">
      <div className="aos-doors-band__head">
        <h2>Направления</h2>
        <p>Рабочие контуры и факторный разбор месяца. Цифры — из текущей сводки.</p>
      </div>
      <div className="aos-doors">
        {DOORS.map((door) => {
          const Icon = door.icon;
          return (
            <Link
              key={door.id}
              href={door.href || BUSINESS_CONTOUR_PATHS[door.id as Exclude<BusinessContourId, "analytics">]}
              className={`aos-door aos-door--${door.id}`}
            >
              <div className="aos-door__art" aria-hidden="true">
                <span className="aos-door__shape aos-door__shape--a" />
                <span className="aos-door__shape aos-door__shape--b" />
                <span className="aos-door__shape aos-door__shape--c" />
              </div>
              <div className="aos-door__body">
                <span className="aos-door__icon">
                  <Icon size={22} strokeWidth={2.1} />
                </span>
                <h3>{door.title}</h3>
                <p>{door.subtitle}</p>
                <dl className="aos-door__metrics">
                  {door.metrics(snapshot).map((metric) => (
                    <div key={metric.label}>
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
                <span className="aos-door__cta">Открыть направление</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function liveScenarioSignals(snapshot: CeoControlCenterSnapshot) {
  let live = 0;
  let alerts = 0;
  for (const item of ANALYSIS_SCENARIOS) {
    if (item.readiness !== "live") continue;
    live += 1;
    const ran = runAnalysisScenario(item.id, snapshot);
    if (ran?.run.status === "problem" || ran?.run.status === "attention") alerts += 1;
  }
  return { live, alerts };
}

const ANALYSIS_DOORS: Array<{
  id: "scenarios" | "slices";
  title: string;
  subtitle: string;
  icon: LucideIcon;
  href: string;
  cta: string;
  metrics: (snapshot: CeoControlCenterSnapshot) => DoorMetric[];
}> = [
  {
    id: "scenarios",
    title: "Сценарии анализа",
    subtitle: "Почему так произошло и куда жать",
    icon: Search,
    href: "/os/scenarios",
    cta: "Разобрать причину",
    metrics: (snapshot) => {
      const signals = liveScenarioSignals(snapshot);
      return [
        { label: "Разрыв", value: formatMetricDisplay(snapshot.plan.gap) },
        { label: metricLabel("conversion_rate"), value: formatMetricDisplay(snapshot.metrics.conversion_rate) },
        { label: metricLabel("cac"), value: formatMetricDisplay(snapshot.marketing.cac) },
        { label: "Сигналы", value: `${signals.alerts} из ${signals.live}` }
      ];
    }
  },
  {
    id: "slices",
    title: "Срезы",
    subtitle: "Страна → продукт → источник на фактах когорты",
    icon: BarChart3,
    href: "/os/slices",
    cta: "Исследовать",
    metrics: (snapshot) => {
      const topCountry = snapshot.revenueTree.countries[0];
      const topProduct = snapshot.revenueTree.products[0];
      return [
        { label: "Топ страна", value: topCountry?.name || "—" },
        { label: "Выручка топа", value: topCountry ? eur(topCountry.revenue) : "—" },
        { label: "Топ продукт", value: topProduct?.name || "—" },
        { label: metricLabel("aov"), value: formatMetricDisplay(snapshot.metrics.aov) }
      ];
    }
  }
];

export function ScenariosModule({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  return (
    <section className="aos-doors-band" aria-label="Сценарии и срезы">
      <div className="aos-doors-band__head">
        <h2>Разбор</h2>
        <p>Сценарии — маршрут причины. Срезы — где результат. Цифры на плитках из текущей сводки.</p>
      </div>
      <div className="aos-doors">
        {ANALYSIS_DOORS.map((door) => {
          const Icon = door.icon;
          return (
            <Link key={door.id} href={door.href} className={`aos-door aos-door--${door.id}`}>
              <div className="aos-door__art" aria-hidden="true">
                <span className="aos-door__shape aos-door__shape--a" />
                <span className="aos-door__shape aos-door__shape--b" />
                <span className="aos-door__shape aos-door__shape--c" />
              </div>
              <div className="aos-door__body">
                <span className="aos-door__icon">
                  <Icon size={22} strokeWidth={2.1} />
                </span>
                <h3>{door.title}</h3>
                <p>{door.subtitle}</p>
                <dl className="aos-door__metrics">
                  {door.metrics(snapshot).map((metric) => (
                    <div key={metric.label}>
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
                <span className="aos-door__cta">{door.cta}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SourcesModule({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const connected = snapshot.sources.filter((item) => item.connection === "connected").length;
  const partial = snapshot.sources.filter((item) => item.connection === "partial").length;
  const missing = snapshot.sources.filter((item) => item.connection === "not_connected").length;

  return (
    <section className="aos-sources-module" aria-label="Источники данных">
      <Link href="/os/sources" className="aos-sources-module__card">
        <span className="aos-sources-module__icon">
          <Database size={20} strokeWidth={2.1} />
        </span>
        <div>
          <h2>Источники данных</h2>
          <p>
            {connected} подключено · {partial} частично · {missing} нет
          </p>
        </div>
        <span className="aos-sources-module__cta">Открыть модуль →</span>
      </Link>
    </section>
  );
}
