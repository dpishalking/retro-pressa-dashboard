"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, Package, Target, type LucideIcon, WalletCards } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { OfficeHubBackLink } from "@/components/office-hub";
import { formatMetricDisplay } from "@/components/analytics-os/format-metric";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";
import { MarketingLandingTiles } from "@/components/marketing-landing-tiles";
import { readJsonResponse } from "@/lib/api-response";
import { metricDefinition, metricLabel } from "@/lib/analytics-os/metric-glossary";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { eur, number, pct } from "@/lib/format";
import type { PredictiveDomain, PredictiveDomainBlock, PredictiveOverview } from "@/lib/predictive/types";
import type { AnalyticsMetricValue, CeoControlCenterSnapshot } from "@/types/analytics-os";

type ContourId = "sales" | "marketing" | "product" | "finance";

type ActionLink = {
  title: string;
  description: string;
  href?: string;
  adminOnly?: boolean;
  primary?: boolean;
};

type ContourConfig = {
  title: string;
  description: string;
  icon: LucideIcon;
  summaryMetricIds: string[];
  forecastDomain?: PredictiveDomain;
  detailLinks: ActionLink[];
  actionLinks: ActionLink[];
};

const CONTOURS: Record<ContourId, ContourConfig> = {
  sales: {
    title: "Продажи",
    description: "Сводка, прогноз до конца месяца и рабочие экраны команды.",
    icon: Target,
    summaryMetricIds: ["revenue", "leads", "paid_orders", "conversion_rate", "aov", "pipeline_amount"],
    forecastDomain: "sales",
    detailLinks: [
      { title: "Воронка", description: "Лиды, счета, оплаты и узкие места.", href: "/os/funnel", primary: true },
      { title: "Когорты", description: "Качество лидов и оплаты по когортам.", href: "/os/cohorts" },
      { title: "Цикл сделки", description: "Скорость от лида до оплаты.", href: "/os/sales-cycle" },
      { title: "Менеджеры", description: "Конверсия и выручка по команде.", href: "/os/managers" },
      { title: "Диалоги", description: "Качество переписок и возражения.", href: "/rop/conversations" }
    ],
    actionLinks: [
      { title: "Работа РОП", description: "Ежедневное управление командой и план-факт.", href: "/rop", primary: true },
      { title: "Мотивация", description: "Бонусы и фокус месяца.", href: "/motivation" },
      { title: "Обучение", description: "Продукты, CRM и прогресс команды.", href: "/training" }
    ]
  },
  marketing: {
    title: "Маркетинг и трафик",
    description: "Лендинги в работе, реклама и атрибуция.",
    icon: Megaphone,
    summaryMetricIds: ["leads", "ad_spend", "cpl", "cac", "conversion_rate"],
    forecastDomain: "marketing",
    detailLinks: [
      { title: "Маркетинг", description: "Бюджет, CPL, CAC и ROAS.", href: "/os/marketing", primary: true },
      { title: "Аналитика рекламы", description: "Каналы, GA4 и сверка с CRM.", href: "/ad-analytics" }
    ],
    actionLinks: [
      { title: "UTM-генератор", description: "Единая разметка ссылок.", href: "/utm" },
      { title: "Качество данных", description: "Что подключено и чему можно верить.", href: "/os/sources" }
    ]
  },
  product: {
    title: "Продукт",
    description: "Ассортимент, спрос и клиентские срезы.",
    icon: Package,
    summaryMetricIds: ["revenue", "aov", "gross_profit", "repeat_rate"],
    detailLinks: [
      { title: "Продукты", description: "SKU, выручка, маржа и доля.", href: "/os/products", primary: true },
      { title: "Клиенты", description: "Новые, повторные и средний чек.", href: "/os/customers" }
    ],
    actionLinks: [
      { title: "Каталог и выпуски", description: "PDF, карточки и ссылки для клиентов.", href: "/products" }
    ]
  },
  finance: {
    title: "Финансы",
    description: "План, факт, прогноз и экономика заказа.",
    icon: WalletCards,
    summaryMetricIds: ["revenue", "gross_profit", "cash", "aov", "cac"],
    forecastDomain: "finance",
    detailLinks: [
      { title: "План / факт", description: "План месяца, факт и прогноз до конца периода.", href: "/os/plan", primary: true },
      { title: "Юнит-экономика", description: "Маржа заказа, средний чек, CPL и ROAS.", href: "/os/unit-economics" }
    ],
    actionLinks: [
      {
        title: "Цифровой двойник",
        description: "P&L и сценарии для собственника.",
        href: "/digital-twin",
        adminOnly: true
      }
    ]
  }
};

function formatPredictiveValue(unit: string, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "eur") return eur(value);
  if (unit === "ratio") return pct(value);
  return number(value);
}

function ContourSummary({
  snapshot,
  metricIds
}: {
  snapshot: CeoControlCenterSnapshot | null;
  metricIds: string[];
}) {
  if (!snapshot) {
    return <p className="text-sm text-slate-500">Загрузка сводки…</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metricIds.map((id) => {
        const fromMetrics = snapshot.metrics[id];
        const fromMarketing =
          id === "ad_spend"
            ? snapshot.marketing.adSpend
            : id === "cpl"
              ? snapshot.marketing.cpl
              : id === "cac"
                ? snapshot.marketing.cac
                : id === "roas"
                  ? snapshot.marketing.roas
                  : undefined;
        const metric: AnalyticsMetricValue | undefined = fromMetrics ?? fromMarketing;
        const label = metricLabel(id);
        const definition = metricDefinition(id);
        return (
          <article key={id} className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{formatMetricDisplay(metric)}</p>
            {definition ? <p className="mt-2 text-xs leading-5 text-slate-500">{definition}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

function ContourForecast({ domain }: { domain: PredictiveDomain }) {
  const period = currentPeriodKey();
  const [block, setBlock] = useState<PredictiveDomainBlock | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ period, scope: "general" });
        const response = await fetch(`/api/predictive/overview?${qs.toString()}`, { cache: "no-store" });
        const payload = await readJsonResponse<
          (PredictiveOverview & { ok: true }) | { ok: false; error: string }
        >(response);
        if (!response.ok || !("ok" in payload) || payload.ok !== true) {
          throw new Error("error" in payload ? payload.error : "Не удалось загрузить прогноз");
        }
        if (!cancelled) setBlock(payload.domains[domain]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки прогноза");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [domain, period]);

  const rows = (block?.metrics || []).filter((row) => row.primary !== false).slice(0, 4);

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Прогноз</h2>
          <p className="mt-1 text-sm text-slate-600">План, факт и прогноз до конца месяца.</p>
        </div>
        <Link href={`/predictive?domain=${domain}`} className="text-sm font-bold text-blue-600">
          Открыть прогноз →
        </Link>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!block && !error ? <p className="text-sm text-slate-500">Загрузка прогноза…</p> : null}
      {block ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-slate-700">{block.message}</p>
          {block.asOf ? <p className="mt-1 text-xs text-slate-500">На дату: {block.asOf}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {rows.length ? (
              rows.map((row) => (
                <div key={row.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{row.label}</p>
                  <p className="mt-2 text-lg font-black text-slate-950">
                    {formatPredictiveValue(row.unit, row.forecast)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    План {formatPredictiveValue(row.unit, row.plan)} · факт{" "}
                    {formatPredictiveValue(row.unit, row.fact)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 sm:col-span-2 xl:col-span-4">Нет метрик прогноза за период.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProductHighlights({ snapshot }: { snapshot: CeoControlCenterSnapshot | null }) {
  if (!snapshot) return null;
  const top = snapshot.products.slice(0, 3);
  if (!top.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">Топ продуктов</h2>
        <p className="mt-1 text-sm text-slate-600">По оплаченной выручке за выбранный период.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {top.map((product) => (
          <article key={product.productId} className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-bold text-slate-950">{product.productName}</p>
            <p className="mt-2 text-xl font-black text-slate-950">{eur(product.revenue)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {pct(product.share)}
              {product.marginRate == null ? "" : ` · маржа ${pct(product.marginRate)}`}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LinkList({ title, links }: { title: string; links: ActionLink[] }) {
  if (!links.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      </div>
      <div className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
        {links.map((link) => {
          const row = (
            <div className="flex items-center justify-between gap-4 px-4 py-4">
              <div>
                <p className="font-bold text-slate-950">
                  {link.title}
                  {link.primary ? (
                    <span className="ml-2 text-xs font-bold uppercase tracking-wide text-blue-600">главный</span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-slate-600">{link.description}</p>
              </div>
              {link.href ? <span className="shrink-0 text-sm font-bold text-blue-600">Открыть →</span> : null}
            </div>
          );
          return link.href ? (
            <Link key={link.title} href={link.href} className="block transition hover:bg-slate-50">
              {row}
            </Link>
          ) : (
            <div key={link.title}>{row}</div>
          );
        })}
      </div>
    </section>
  );
}

export function BusinessContourScreen({ contourId }: { contourId: ContourId }) {
  const { user } = useAuth();
  const { snapshot, state, error } = useCeoSnapshot();
  const contour = CONTOURS[contourId];
  const Icon = contour.icon;
  const detailLinks = contour.detailLinks.filter(
    (link) => !link.adminOnly || user?.accessLevel === "admin"
  );
  const actionLinks = contour.actionLinks.filter(
    (link) => !link.adminOnly || user?.accessLevel === "admin"
  );

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <OfficeHubBackLink />
        <div className="mt-4 flex items-start gap-4">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Icon size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-normal text-slate-950">{contour.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{contour.description}</p>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-2xl font-black text-slate-950">Сводка</h2>
          <p className="mt-1 text-sm text-slate-600">Ключевые показатели направления.</p>
        </div>
        {state === "error" && !snapshot ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <ContourSummary snapshot={snapshot} metricIds={contour.summaryMetricIds} />
        )}
      </section>

      {contour.forecastDomain ? <ContourForecast domain={contour.forecastDomain} /> : null}
      {contourId === "product" ? <ProductHighlights snapshot={snapshot} /> : null}
      {contourId === "marketing" ? <MarketingLandingTiles /> : null}

      <LinkList title="Детализация" links={detailLinks} />
      <LinkList title="Действия" links={actionLinks} />
    </main>
  );
}
