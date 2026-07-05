"use client";

import Link from "next/link";
import { ArrowRight, Bot, ExternalLink } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { PRACTICE_BOT_SCENARIOS, TRAINING_TELEGRAM_BOT, trainingTelegramBotUrl } from "@/lib/training/practice-bot";

function TelegramOpenButton({
  startParam,
  label,
  className = ""
}: {
  startParam?: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={trainingTelegramBotUrl(startParam)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-5 py-3 text-sm font-bold text-white hover:bg-[#1a8bc4] ${className}`}
    >
      <ExternalLink size={16} />
      {label}
    </a>
  );
}

function ScenarioCard({ scenario }: { scenario: (typeof PRACTICE_BOT_SCENARIOS)[number] }) {
  return (
    <article className="card flex h-full flex-col p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Сценарий {scenario.sortOrder}</p>
      <h2 className="mt-2 text-lg font-black text-slate-950">{scenario.title}</h2>
      <div className="mt-5 flex flex-wrap gap-3">
        <TelegramOpenButton startParam={scenario.telegramStartParam} label="Начать в Telegram" />
        <Link
          href={`/training/practice/bot/${scenario.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Подробнее
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function BotHubContent() {
  return (
    <>
      <section className="card mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Bot size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-black text-slate-950">{TRAINING_TELEGRAM_BOT.displayName}</h2>
        </div>
        <TelegramOpenButton label="Открыть бота" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {PRACTICE_BOT_SCENARIOS.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </section>
    </>
  );
}

export function TrainingPracticeBotHub() {
  return (
    <TrainingLayout
      title="Тренировочный бот"
      backHref="/training/practice"
      backLabel="К этапу «Практика»"
    >
      <BotHubContent />
    </TrainingLayout>
  );
}
