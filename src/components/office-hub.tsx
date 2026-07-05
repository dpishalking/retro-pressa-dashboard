"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, BookOpen, LogOut, Settings, Target, type LucideIcon } from "lucide-react";
import { canSeeOfficeSection, accessLevelLabel } from "@/lib/auth/access";
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

const offices: OfficeCard[] = [
  {
    href: "/analytics",
    title: "Аналитика",
    description: "Операционный пульт: KPI, воронка, маркетинг, продажи, качество переписок и Growth Intelligence.",
    icon: BarChart3,
    status: "active",
    accent: "text-blue-600 bg-blue-50"
  },
  {
    href: "/rop",
    title: "Инструменты РОП",
    description: "Кабинет РОП: ежедневный импорт Bitrix, качество переписок, план-факт, команда и управленческие решения.",
    icon: Target,
    status: "active",
    accent: "text-amber-600 bg-amber-50"
  },
  {
    href: "/training",
    title: "Обучение менеджеров",
    description: "Онбординг и тренировочный кабинет: материалы, практика, симуляции и контроль прогресса.",
    icon: BookOpen,
    status: "active",
    accent: "text-rose-600 bg-rose-50"
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
      <h2 className="text-xl font-black text-slate-950">{office.title}</h2>
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

  const visibleOffices = offices.filter((office) => canSeeOfficeSection(user.accessLevel, office.href));

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">Retro Pressa</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
              {accessLevelLabel(user.accessLevel)}
            </span>
            <span className="text-sm font-semibold text-slate-600">{user.name}</span>
            {user.accessLevel === "admin" ? (
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Settings size={16} />
                Доступы
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
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Единая точка входа для команды продаж: аналитика, инструменты РОП и обучение менеджеров.
        </p>
        {denied ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            У вашего аккаунта нет доступа к этому разделу.
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleOffices.map((office) => (
          <OfficeCardLink key={office.href} office={office} accessLevel={user.accessLevel} />
        ))}
      </section>
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
