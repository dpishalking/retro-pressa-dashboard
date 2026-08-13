"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, Package, Target, type LucideIcon, WalletCards } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { OfficeHubBackLink } from "@/components/office-hub";
import { formatMetricDisplay } from "@/components/analytics-os/format-metric";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";
import { MarketingAudienceBoard } from "@/components/marketing-audience-board";
import { MarketingFunnelTiles } from "@/components/marketing-funnel-tiles";
import { MarketingLandingTiles } from "@/components/marketing-landing-tiles";
import { readJsonResponse } from "@/lib/api-response";
import { metricLabel } from "@/lib/analytics-os/metric-glossary";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { eur, number, pct } from "@/lib/format";
import { matchGiftVisual } from "@/lib/product-cards/gift-visual";
import type { PredictiveDomain, PredictiveDomainBlock, PredictiveOverview } from "@/lib/predictive/types";
import type { AnalyticsMetricValue, AnalyticsProductRow, CeoControlCenterSnapshot } from "@/types/analytics-os";

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
    summaryMetricIds: [
      "revenue",
      "leads",
      "bitrix_cards",
      "unique_leads",
      "conversion_rate",
      "unique_conversion_rate",
      "pipeline_stuck_amount",
      "paid_orders"
    ],
    forecastDomain: "sales",
    detailLinks: [
      { title: "Воронка", description: "Лиды, счета, оплаты и зависшие сделки.", href: "/os/funnel", primary: true },
      { title: "Цикл сделки", description: "Скорость от лида до оплаты.", href: "/os/sales-cycle" },
      { title: "Менеджеры", description: "Конверсия и выручка по команде.", href: "/os/managers" },
      { title: "Диалоги", description: "Качество переписок и возражения.", href: "/rop/conversations" }
    ],
    actionLinks: [
      { title: "Работа РОП", description: "Ежедневное управление командой и план-факт.", href: "/rop", primary: true },
      {
        title: "Зарплаты менеджеров",
        description: "Калькулятор ФОТ: факт Bitrix или ручной сценарий.",
        href: "/sales/payroll"
      },
      { title: "Мотивация", description: "Бонусы и фокус месяца.", href: "/motivation" },
      { title: "Обучение", description: "Продукты, CRM и прогресс команды.", href: "/training" }
    ]
  },
  marketing: {
    title: "Маркетинг и трафик",
    description: "Лендинги, офферы и целевая аудитория.",
    icon: Megaphone,
    summaryMetricIds: ["leads", "ad_spend", "cpl", "roas", "cac", "conversion_rate"],
    detailLinks: [
      { title: "Маркетинг", description: "Бюджет, CPL, CAC и ROAS.", href: "/os/marketing", primary: true },
      { title: "Когорты", description: "Качество лидов и оплаты по когортам.", href: "/os/cohorts" },
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
    summaryMetricIds: [
      "revenue",
      "product_revenue_net",
      "delivery_revenue",
      "product_aov",
      "aov",
      "gross_profit",
      "repeat_rate"
    ],
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
        const value =
          id === "cpl" && metric?.value != null && metric.unit === "eur"
            ? eur(metric.value, 1)
            : formatMetricDisplay(metric);
        return (
          <article key={id} className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
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

const TOP_GIFT_BAR = ["bg-amber-700", "bg-slate-800", "bg-orange-600"] as const;

function TopGiftCard({ product, rank }: { product: AnalyticsProductRow; rank: number }) {
  const visual = matchGiftVisual(product.productName);
  const bar = TOP_GIFT_BAR[rank] ?? "bg-slate-700";
  const media = (
    <div className="relative aspect-[5/3] overflow-hidden bg-slate-100">
      {visual ? (
        <Image
          src={visual.image}
          alt={product.productName}
          fill
          className="object-cover object-top"
          sizes="(max-width: 768px) 100vw, 33vw"
          unoptimized
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-100 to-slate-200">
          <span className="text-4xl font-black text-slate-400">{product.productName.slice(0, 1)}</span>
        </div>
      )}
      <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-xs font-black text-slate-900">
        #{rank + 1}
      </span>
    </div>
  );

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      {visual?.href ? (
        <Link href={visual.href} className="block" target="_blank" rel="noreferrer">
          {media}
        </Link>
      ) : (
        media
      )}
      <div className="p-4">
        <p className="text-sm font-bold text-slate-950">{product.productName}</p>
        {visual?.subtitle ? <p className="mt-1 text-xs text-slate-500">{visual.subtitle}</p> : null}
        <p className="mt-3 text-xl font-black text-slate-950">{eur(product.revenue)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(4, Math.min(100, product.share * 100))}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {pct(product.share)} доли · {number(product.orders)} продаж
          {product.marginRate == null ? "" : ` · маржа ${pct(product.marginRate)}`}
        </p>
        {visual?.href ? (
          <Link href={visual.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-blue-600">
            Карточка подарка →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ProductHighlights({ snapshot }: { snapshot: CeoControlCenterSnapshot | null }) {
  if (!snapshot) return null;
  const top = snapshot.products.slice(0, 3);
  const pricing = (snapshot.pricingCompare || []).slice(0, 6);
  if (!top.length && !pricing.length) return null;
  const mixTotal = top.reduce((sum, row) => sum + row.share, 0);
  return (
    <>
      {top.length ? (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-slate-950">Топ продуктов</h2>
            <p className="mt-1 text-sm text-slate-600">Визуал подарка и оплаченная выручка за выбранный период.</p>
          </div>
          {mixTotal > 0 ? (
            <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {top.map((product, index) => (
                <div
                  key={product.productId}
                  className={TOP_GIFT_BAR[index] ?? "bg-slate-700"}
                  style={{ width: `${(product.share / mixTotal) * 100}%` }}
                  title={`${product.productName}: ${pct(product.share)}`}
                />
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            {top.map((product, index) => (
              <TopGiftCard key={product.productId} product={product} rank={index} />
            ))}
          </div>
        </section>
      ) : null}

      {pricing.length ? (
        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Витрина vs факт</h2>
              <p className="mt-1 text-sm text-slate-600">
                Цена витрины Product Hub против средней продажи в Bitrix.
              </p>
            </div>
            <Link href="/os/products" className="text-sm font-bold text-blue-600">
              Все продукты →
            </Link>
          </div>
          <div className="table-scroll rounded-xl border border-[var(--line)] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Продукт</th>
                  <th className="px-4 py-3 font-bold">Продаж</th>
                  <th className="px-4 py-3 font-bold">Витрина</th>
                  <th className="px-4 py-3 font-bold">Средняя</th>
                  <th className="px-4 py-3 font-bold">Δ</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((row) => (
                  <tr key={row.productName} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.productName}</td>
                    <td className="px-4 py-3 text-slate-700">{number(row.orders)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.listPrice == null ? "—" : eur(row.listPrice)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.soldAvg == null ? "—" : eur(row.soldAvg)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {row.deltaPct == null
                        ? "—"
                        : `${row.deltaPct > 0 ? "+" : ""}${number(row.deltaPct, 1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

function ManagerBenchmarkStrip({ snapshot }: { snapshot: CeoControlCenterSnapshot | null }) {
  if (!snapshot) return null;
  const b = snapshot.managerBenchmark;
  const top = (snapshot.managers || []).filter((row) => row.isTopPerformer).slice(0, 3);
  const hasBench =
    b.medianCr != null ||
    b.p80Cr != null ||
    b.medianRevenuePerLead != null ||
    b.p80RevenuePerLead != null;
  if (!hasBench && !top.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Бенчмарк команды</h2>
          <p className="mt-1 text-sm text-slate-600">
            Медиана vs топ 20% по CR и €/лид (менеджеры от 10 лидов).
          </p>
        </div>
        <Link href="/os/managers" className="text-sm font-bold text-blue-600">
          Все менеджеры →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Медиана CR</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {b.medianCr == null ? "—" : pct(b.medianCr)}
          </p>
        </article>
        <article className="rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Топ 20% CR</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {b.p80Cr == null ? "—" : pct(b.p80Cr)}
          </p>
        </article>
        <article className="rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Медиана €/лид</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {b.medianRevenuePerLead == null ? "—" : eur(b.medianRevenuePerLead)}
          </p>
        </article>
        <article className="rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Топ 20% €/лид</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {b.p80RevenuePerLead == null ? "—" : eur(b.p80RevenuePerLead)}
          </p>
        </article>
      </div>
      {top.length ? (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Лидеры по €/лид</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {top.map((row) => (
              <div key={row.managerId}>
                <p className="font-bold text-slate-950">{row.managerName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {eur(row.revenue)} · CR {row.conversionRate == null ? "—" : pct(row.conversionRate)} ·{" "}
                  {row.revenuePerLead == null ? "—" : `${eur(row.revenuePerLead)}/лид`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
            <Link key={link.title} href={link.href} className="block transition hover:bg-slate-50 active:bg-slate-100 active:translate-y-px">
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

      {contourId !== "product" ? (
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
      ) : state === "error" && !snapshot ? (
        <p className="mb-8 text-sm text-red-700">{error}</p>
      ) : null}

      {contour.forecastDomain ? <ContourForecast domain={contour.forecastDomain} /> : null}
      {contourId === "sales" ? <ManagerBenchmarkStrip snapshot={snapshot} /> : null}
      {contourId === "product" ? <ProductHighlights snapshot={snapshot} /> : null}
      {contourId === "marketing" ? (
        <>
          <LinkList title="Детализация" links={detailLinks} />
          <MarketingLandingTiles />
          <MarketingFunnelTiles />
          <MarketingAudienceBoard />
          <LinkList title="Действия" links={actionLinks} />
        </>
      ) : (
        <>
          <LinkList title="Детализация" links={detailLinks} />
          <LinkList title="Действия" links={actionLinks} />
        </>
      )}
    </main>
  );
}
