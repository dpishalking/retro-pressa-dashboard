import Link from "next/link";
import { ArrowRight, MessageSquare, Target, Users, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type RopTile = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: "active" | "soon";
};

const tiles: RopTile[] = [
  {
    href: "/rop/conversations",
    title: "Анализ переписок",
    description: "Дневные и месячные срезы переписок из Bitrix: качество, возражения, конверсия и потери.",
    icon: MessageSquare,
    status: "active"
  },
  {
    href: "#",
    title: "План-факт",
    description: "Пока в сборке. Здесь будет управленческий обзор выполнения плана и отклонений.",
    icon: Target,
    status: "soon"
  },
  {
    href: "#",
    title: "Команда",
    description: "Пока в сборке. Здесь будет сводка по менеджерам, активности и нагрузке.",
    icon: Users,
    status: "soon"
  },
  {
    href: "#",
    title: "Рабочие процессы",
    description: "Пока в сборке. Здесь будут приоритеты РОПа и список задач по команде.",
    icon: Workflow,
    status: "soon"
  }
];

function RopTileCard({ tile }: { tile: RopTile }) {
  const Icon = tile.icon;
  const card = (
    <article className={`card flex h-full flex-col p-6 transition ${tile.status === "active" ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-70"}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
          <Icon size={24} />
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${tile.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {tile.status === "active" ? "Открыто" : "Скоро"}
        </span>
      </div>
      <h2 className="text-2xl font-black text-slate-950">{tile.title}</h2>
      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{tile.description}</p>
      {tile.status === "active" ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600">
          Открыть <ArrowRight size={16} />
        </p>
      ) : null}
    </article>
  );

  if (tile.status !== "active") return card;
  return <Link href={tile.href} className="block h-full">{card}</Link>;
}

export function RopHub() {
  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">Инструменты РОП</p>
        <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">Кабинет руководителя отдела продаж</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Это плитка управленческих инструментов. Сюда попадают только рабочие разделы РОПа, а внутри каждого раздела открывается уже свой отдельный экран.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <RopTileCard key={tile.title} tile={tile} />
        ))}
      </section>
    </main>
  );
}
