"use client";

import Link from "next/link";
import { BarChart3, BookOpen, Briefcase, MessageSquare, Target, type LucideIcon } from "lucide-react";

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
    href: "/correspondence",
    title: "Переписки",
    description: "Рабочее место для переписки с клиентами: очередь, шаблоны, контроль качества диалогов.",
    icon: MessageSquare,
    status: "soon",
    accent: "text-violet-600 bg-violet-50"
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
    href: "/sales",
    title: "Офис продаж",
    description: "Рабочее место менеджера: сделки, клиенты, задачи и инструменты для ежедневной работы с продажами.",
    icon: Briefcase,
    status: "soon",
    accent: "text-emerald-600 bg-emerald-50"
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

function OfficeCardLink({ office }: { office: OfficeCard }) {
  const Icon = office.icon;
  const isActive = office.status === "active";

  const content = (
    <article className={`card flex h-full flex-col p-6 transition ${isActive ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-70"}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={`rounded-xl p-3 ${office.accent}`}>
          <Icon size={24} />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${isActive ? "status-green" : "bg-slate-100 text-slate-500"}`}>
          {isActive ? "Открыто" : "Скоро"}
        </span>
      </div>
      <h2 className="text-xl font-black text-slate-950">{office.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{office.description}</p>
      {isActive ? <p className="mt-4 text-sm font-bold text-blue-600">Перейти →</p> : null}
    </article>
  );

  if (!isActive) return content;
  return (
    <Link href={office.href} className="block h-full">
      {content}
    </Link>
  );
}

export function OfficeHub() {
  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">Retro Pressa</p>
        <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">Рабочий кабинет</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Единая точка входа для команды продаж: аналитика, переписки, инструменты РОП, офис продаж и обучение менеджеров.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {offices.map((office) => (
          <OfficeCardLink key={office.href} office={office} />
        ))}
      </section>
    </main>
  );
}
