"use client";

import Link from "next/link";
import { Megaphone, Package, Target, type LucideIcon, WalletCards } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { OfficeHubBackLink } from "@/components/office-hub";
import { AnalyticsKpiRow } from "@/components/analytics-os/kpi-row";
import { useCeoSnapshot } from "@/components/analytics-os/use-ceo-snapshot";

type ContourId = "sales" | "marketing" | "product" | "finance";

type ModuleCard = {
  title: string;
  description: string;
  href?: string;
  adminOnly?: boolean;
  status?: "active" | "soon";
};

type ContourConfig = {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  /** Hide company-wide KPI strip (already on main dashboard). */
  hideKpiSummary?: boolean;
  /** Classic dashboard + forecast pair. Omit when contour uses predictiveModels. */
  dashboard?: ModuleCard;
  forecast?: ModuleCard;
  /** Marketing-style predictive model tiles. */
  predictiveModels?: ModuleCard[];
  modules: ModuleCard[];
};

const CONTOURS: Record<ContourId, ContourConfig> = {
  sales: {
    title: "Продажи",
    eyebrow: "Контур BI",
    description: "Сводка продаж, прогноз, команда и все рабочие инструменты РОП.",
    icon: Target,
    dashboard: {
      title: "Дашборд продаж",
      description: "Воронка, выручка, оплаты и текущая картина по продажам.",
      href: "/os/funnel"
    },
    forecast: {
      title: "Прогноз продаж",
      description: "План, факт и run-rate по продажам.",
      href: "/predictive?domain=sales"
    },
    modules: [
      { title: "Инструменты РОП", description: "Управление командой, ежедневная работа и план-факт.", href: "/rop" },
      { title: "Когорты", description: "Качество лидов и оплаты в разрезе когорт.", href: "/os/cohorts" },
      { title: "Цикл сделки", description: "Скорость перехода от лида к оплате.", href: "/os/sales-cycle" },
      { title: "Менеджеры", description: "Эффективность команды и конверсия.", href: "/os/managers" },
      { title: "Диалоги", description: "Качество переписок, возражения и точки роста.", href: "/rop/conversations" },
      { title: "Мотивация", description: "Бонусы и фокус месяца для команды.", href: "/motivation" },
      { title: "Обучение", description: "Продукты, CRM, база знаний и прогресс команды.", href: "/training" }
    ]
  },
  marketing: {
    title: "Маркетинг и трафик",
    eyebrow: "Контур BI",
    description: "Предиктивные модели привлечения, рекламные каналы и атрибуция трафика.",
    icon: Megaphone,
    hideKpiSummary: true,
    predictiveModels: [
      {
        title: "Общая",
        description: "План, факт и прогноз по всему маркетингу. Месяц с разворотом по дням.",
        href: "/predictive?domain=marketing&scope=general"
      },
      {
        title: "Органика",
        description: "Предиктивная модель органического трафика и лидов.",
        href: "/predictive?domain=marketing&scope=organic"
      },
      {
        title: "Платный трафик",
        description: "Предиктивная модель платных каналов: spend, CPL, ROAS.",
        href: "/predictive?domain=marketing&scope=paid"
      }
    ],
    modules: [
      { title: "Аналитика рекламы", description: "GA4, каналы, CRM-сверка и AI-анализ.", href: "/ad-analytics" },
      { title: "UTM-генератор", description: "Единая разметка ссылок для корректной атрибуции.", href: "/utm" },
      { title: "Источники данных", description: "Подключения и качество данных маркетинга.", href: "/os/sources" }
    ]
  },
  product: {
    title: "Продукт",
    eyebrow: "Контур BI",
    description: "Продуктовая сводка, ассортимент, выпуски, спрос и клиентские срезы.",
    icon: Package,
    dashboard: {
      title: "Дашборд продукта",
      description: "SKU, выручка, маржа и доля продуктов в результате.",
      href: "/os/products"
    },
    modules: [
      { title: "Продукты и выпуски", description: "Загрузка PDF, карточки и вечные ссылки для клиентов.", href: "/products" },
      { title: "Клиенты", description: "Повторные покупки, средний чек и клиентская база.", href: "/os/customers" }
    ]
  },
  finance: {
    title: "Финансы",
    eyebrow: "Контур BI",
    description: "План, факт, финансовый прогноз, юнит-экономика и управленческие сценарии.",
    icon: WalletCards,
    dashboard: {
      title: "Финансовый дашборд",
      description: "План, факт, прогноз до конца периода и ключевые показатели.",
      href: "/os/plan"
    },
    forecast: {
      title: "Прогноз финансов",
      description: "План, факт и run-rate финансовых показателей.",
      href: "/predictive?domain=finance"
    },
    modules: [
      { title: "Юнит-экономика", description: "Маржа заказа, средний чек, CPL и ROAS.", href: "/os/unit-economics" },
      { title: "Цифровой двойник", description: "P&L, сценарии и ограничения для собственника.", href: "/digital-twin", adminOnly: true }
    ]
  }
};

function ContourCard({ module }: { module: ModuleCard }) {
  const content = (
    <article className={`card flex h-full flex-col p-5 ${module.status === "soon" ? "opacity-70" : "transition hover:-translate-y-0.5 hover:shadow-lg"}`}>
      {module.status === "soon" ? (
        <span className="mb-3 w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">Скоро</span>
      ) : null}
      <h2 className="text-xl font-black text-slate-950">{module.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{module.description}</p>
      {module.href ? <p className="mt-4 text-sm font-bold text-blue-600">Открыть →</p> : null}
    </article>
  );

  return module.href ? <Link href={module.href} className="block h-full">{content}</Link> : content;
}

export function BusinessContourScreen({ contourId }: { contourId: ContourId }) {
  const { user } = useAuth();
  const { snapshot, state, error } = useCeoSnapshot();
  const contour = CONTOURS[contourId];
  const Icon = contour.icon;
  const modules = contour.modules.filter((module) => !module.adminOnly || user?.accessLevel === "admin");
  const showDashboardPair = Boolean(contour.dashboard || contour.forecast);
  const showPredictive = Boolean(contour.predictiveModels?.length);

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <OfficeHubBackLink />
        <div className="mt-4 flex items-start gap-4">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Icon size={28} /></div>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">{contour.eyebrow}</p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950">{contour.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{contour.description}</p>
          </div>
        </div>
      </header>

      {!contour.hideKpiSummary ? (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-slate-950">Общая сводка</h2>
            <p className="mt-1 text-sm text-slate-600">Актуальные ключевые показатели из Analytics OS.</p>
          </div>
          {snapshot ? (
            <AnalyticsKpiRow snapshot={snapshot} />
          ) : (
            <p className="text-sm text-slate-500">{state === "error" ? error : "Загрузка сводки…"}</p>
          )}
        </section>
      ) : null}

      {showPredictive ? (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-slate-950">Предиктивные модели</h2>
            <p className="mt-1 text-sm text-slate-600">План / факт / прогноз по срезам маркетинга.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contour.predictiveModels!.map((module) => (
              <ContourCard key={module.title} module={module} />
            ))}
          </div>
        </section>
      ) : null}

      {showDashboardPair ? (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-slate-950">Дашборд и прогноз</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {contour.dashboard ? <ContourCard module={contour.dashboard} /> : null}
            {contour.forecast ? <ContourCard module={contour.forecast} /> : null}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-black text-slate-950">
            {contourId === "marketing" ? "Дополнительные модули" : "Все модули контура"}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <ContourCard key={module.title} module={module} />
          ))}
        </div>
      </section>
    </main>
  );
}
