"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, BookOpen, Handshake, LogOut, Settings, Target, Trophy, UserRound, type LucideIcon } from "lucide-react";
import { canSeeOfficeSection } from "@/lib/auth/access";
import { canAccessUserManagement, pendingRegistrationPhrase, USER_MANAGEMENT_PATH } from "@/lib/auth/admin-users-auth";
import { HUB_PATH } from "@/lib/auth/routes";
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
    title: "Аналитика",
    subtitle: "Общая картина бизнеса, KPI и решения.",
    cards: [
      {
        href: "/os",
        title: "Аналитика",
        description: "Общая сводка собственника по всему бизнесу.",
        icon: BarChart3,
        status: "active",
        accent: "text-blue-600 bg-blue-50"
      }
    ]
  },
  {
    id: "sales",
    title: "Продажи",
    subtitle: "Сводка, прогноз, воронка и команда.",
    cards: [
      {
        href: "/sales",
        title: "Продажи",
        description: "Сводка, прогноз и работа команды продаж.",
        icon: Target,
        status: "active",
        accent: "text-amber-600 bg-amber-50"
      },
      {
        href: "/me",
        title: "Кабинеты менеджеров",
        description: "Личные лиды, сделки, конверсии и зарплата.",
        icon: UserRound,
        status: "active",
        accent: "text-amber-600 bg-amber-50"
      }
    ]
  },
  {
    id: "training",
    title: "Обучение",
    subtitle: "Уроки, CRM и база знаний.",
    cards: [{
      href: "/training",
      title: "Обучение",
      description: "Уроки, CRM, шпаргалки и прогресс команды.",
      icon: BookOpen,
      status: "active",
      accent: "text-rose-600 bg-rose-50"
    }]
  }
];

const managerServices: OfficeCard[] = [
  {
    href: "/training",
    title: "Обучение",
    description: "Уроки, CRM, шпаргалки и твой прогресс.",
    icon: BookOpen,
    status: "active",
    accent: "text-rose-600 bg-rose-50"
  },
  {
    href: "/motivation",
    title: "Мотивация",
    description: "Бонусы и фокус текущего месяца.",
    icon: Trophy,
    status: "active",
    accent: "text-orange-600 bg-orange-50"
  }
];

function OfficeCardLink({
  office,
  accessLevel,
  hideDetails
}: {
  office: OfficeCard;
  accessLevel: AccessLevel;
  hideDetails?: boolean;
}) {
  const Icon = office.icon;
  const canSee = canSeeOfficeSection(accessLevel, office.href);
  const isFuture = office.status === "soon";
  const isClickable = canSee && (office.status === "active" || accessLevel === "admin");

  const content = (
    <article
      className={`card flex h-full flex-col p-6 transition ${isClickable ? "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-md active:bg-slate-50" : "opacity-70"}`}
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
      {hideDetails || !office.description ? null : (
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{office.description}</p>
      )}
      {isClickable ? <p className="mt-4 text-sm font-bold text-rose-700">Перейти →</p> : null}
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
  const { user, pendingRegistrationCount, logout } = useAuth();
  const searchParams = useSearchParams();
  const denied = searchParams.get("denied") === "1";
  if (!user) return null;

  const visibleCards = (user.accessLevel === "mop"
    ? managerServices
    : officeSections.flatMap((section) => section.cards)
  ).filter((office) => canSeeOfficeSection(user.accessLevel, office.href));
  const showPendingBanner = canAccessUserManagement(user.accessLevel) && pendingRegistrationCount > 0;

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-extrabold uppercase tracking-normal text-rose-700">Retro Pressa</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">{user.name}</span>
            {canAccessUserManagement(user.accessLevel) ? (
              <Link
                href={USER_MANAGEMENT_PATH}
                className="relative inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 active:translate-y-px"
              >
                <Settings size={16} />
                {user.accessLevel === "rop" ? "Менеджеры" : "Доступы"}
                {pendingRegistrationCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[11px] font-black leading-none text-white">
                    {pendingRegistrationCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {user.accessLevel === "admin" ? (
              <Link
                href="/admin/partners"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 active:translate-y-px"
              >
                <Handshake size={16} />
                Партнёры
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 active:translate-y-px"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
        </div>
        <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">
          {user.accessLevel === "mop" ? `Привет, ${user.name.split(/\s+/)[0] || user.name}` : "Рабочий кабинет"}
        </h1>
        {denied ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            У вашего аккаунта нет доступа к этому разделу.
          </p>
        ) : null}
        {showPendingBanner ? (
          <Link
            href={USER_MANAGEMENT_PATH}
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 no-underline shadow-sm transition hover:bg-amber-100"
          >
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-amber-800">Нужно одобрение</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {pendingRegistrationPhrase(pendingRegistrationCount)}
              </p>
              <p className="mt-1 text-sm text-slate-600">Новые менеджеры ждут доступ к обучению и базе знаний.</p>
            </div>
            <span className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white">Открыть заявки →</span>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((office) => (
          <OfficeCardLink
            key={office.href}
            office={office}
            accessLevel={user.accessLevel}
            hideDetails={user.accessLevel === "mop"}
          />
        ))}
      </div>
    </main>
  );
}

export function OfficeHubBackLink() {
  return (
    <Link
      href={HUB_PATH}
      className="inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 active:translate-y-px"
    >
      <ArrowLeft size={16} />
      В кабинет
    </Link>
  );
}
