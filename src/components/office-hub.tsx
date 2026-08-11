"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, BookOpen, Brain, Handshake, LineChart, LogOut, Megaphone, Newspaper, Settings, Target, Trophy, type LucideIcon } from "lucide-react";
import { canSeeOfficeSection } from "@/lib/auth/access";
import { canAccessUserManagement } from "@/lib/auth/admin-users-auth";
import { HUB_PATH, PARTNERS_PATH } from "@/lib/auth/routes";
import { useAuth } from "@/components/auth-provider";
import type { AccessLevel } from "@/types/auth";

type OfficeCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: "active" | "soon";
  accent: string;
};

type OfficeSection = {
  id: string;
  title: string;
  subtitle: string;
  cards: OfficeCard[];
};

const officeSections: OfficeSection[] = [
  {
    id: "analytics",
    title: "Аналитика и решения",
    subtitle: "Картина бизнеса, каналы привлечения и сценарии для собственника.",
    cards: [
      {
        href: "/os",
        title: "Analytics OS",
        description: "Центр управления: план, факт, выручка, воронка, менеджеры, страны, продукты.",
        icon: BarChart3,
        status: "active",
        accent: "text-blue-600 bg-blue-50"
      },
      {
        href: "/ad-analytics",
        title: "Аналитика рекламы",
        description: "GA4, каналы привлечения, сверка веб-трафика с CRM-лидами и ответы на вопросы через Gemini.",
        icon: Megaphone,
        status: "active",
        accent: "text-emerald-600 bg-emerald-50"
      },
      {
        href: "/predictive",
        title: "Предиктивные модели",
        description: "Прогнозы продаж, маркетинга и финансов: план, факт и run-rate в одном кабинете.",
        icon: LineChart,
        status: "active",
        accent: "text-indigo-600 bg-indigo-50"
      },
      {
        href: "/digital-twin",
        title: "Цифровой двойник",
        description: "Decision Engine: управление драйверами бизнеса, сценарии, ограничения и AI-рекомендации для собственника.",
        icon: Brain,
        status: "active",
        accent: "text-violet-600 bg-violet-50"
      }
    ]
  },
  {
    id: "sales",
    title: "Продажи и команда",
    subtitle: "Ежедневный контур РОП, фокус месяца и развитие менеджеров.",
    cards: [
      {
        href: "/rop",
        title: "Инструменты РОП",
        description: "Кабинет РОП: ежедневный импорт Bitrix, качество переписок, план-факт, команда и управленческие решения.",
        icon: Target,
        status: "active",
        accent: "text-amber-600 bg-amber-50"
      },
      {
        href: "/motivation",
        title: "Мотивация",
        description: "Бонусы текущего месяца и продукты, на которых сейчас стоит сфокусироваться в продажах.",
        icon: Trophy,
        status: "active",
        accent: "text-orange-600 bg-orange-50"
      },
      {
        href: "/training",
        title: "Обучение менеджеров",
        description: "Онбординг и тренировочный кабинет: материалы, практика, симуляции и контроль прогресса.",
        icon: BookOpen,
        status: "active",
        accent: "text-rose-600 bg-rose-50"
      }
    ]
  },
  {
    id: "product",
    title: "Продукт и каналы",
    subtitle: "Клиентские выпуски и партнёрский контур.",
    cards: [
      {
        href: "/products",
        title: "Продукты",
        description: "Загрузка PDF-выпусков и вечные ссылки для клиентов: полистать готовое издание без входа в кабинет.",
        icon: Newspaper,
        status: "active",
        accent: "text-sky-600 bg-sky-50"
      },
      {
        href: PARTNERS_PATH,
        title: "Партнёрская программа",
        description: "Кабинет партнёра: промокод, материалы, продажи и начисления (без реферальных ссылок). Для admin — предпросмотр.",
        icon: Handshake,
        status: "active",
        accent: "text-emerald-700 bg-emerald-50"
      }
    ]
  }
];

function OfficeCardLink({ office, accessLevel }: { office: OfficeCard; accessLevel: AccessLevel }) {
  const Icon = office.icon;
  const canSee = canSeeOfficeSection(accessLevel, office.href);
  const isFuture = office.status === "soon";
  const isClickable = canSee && (office.status === "active" || accessLevel === "admin");

  const content = (
    <article
      className={`card flex h-full flex-col p-6 transition ${isClickable ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-70"}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={`rounded-xl p-3 ${office.accent}`}>
          <Icon size={24} />
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
            isClickable ? "status-green" : "bg-slate-100 text-slate-500"
          }`}
        >
          {isClickable ? (isFuture ? "Предпросмотр" : "Открыто") : "Скоро"}
        </span>
      </div>
      <h3 className="text-xl font-black text-slate-950">{office.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{office.description}</p>
      {isClickable ? <p className="mt-4 text-sm font-bold text-blue-600">Перейти →</p> : null}
    </article>
  );

  if (!isClickable) return content;
  return (
    <Link href={office.href} className="block h-full">
      {content}
    </Link>
  );
}

export function OfficeHub() {
  const { user, logout } = useAuth();
  const searchParams = useSearchParams();
  const denied = searchParams.get("denied") === "1";
  if (!user) return null;

  const visibleSections = officeSections
    .map((section) => ({
      ...section,
      cards: section.cards.filter((office) => canSeeOfficeSection(user.accessLevel, office.href))
    }))
    .filter((section) => section.cards.length > 0);

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">Retro Pressa</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">{user.name}</span>
            {canAccessUserManagement(user.accessLevel) ? (
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Settings size={16} />
                {user.accessLevel === "rop" ? "Менеджеры" : "Доступы"}
              </Link>
            ) : null}
            {user.accessLevel === "admin" ? (
              <Link
                href="/admin/partners"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Handshake size={16} />
                Партнёры
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
        </div>
        <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">Рабочий кабинет</h1>
        {denied ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            У вашего аккаунта нет доступа к этому разделу.
          </p>
        ) : null}
      </header>

      <div className="space-y-6">
        {visibleSections.map((section) => (
          <section key={section.id} className="rounded-2xl border border-[var(--line)] bg-slate-50/80 p-5 sm:p-6">
            <div className="mb-5 border-b border-[var(--line)] pb-4">
              <h2 className="text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">{section.title}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{section.subtitle}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((office) => (
                <OfficeCardLink key={office.href} office={office} accessLevel={user.accessLevel} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export function OfficeHubBackLink() {
  return (
    <Link href={HUB_PATH} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
      <ArrowLeft size={16} />
      В кабинет
    </Link>
  );
}
