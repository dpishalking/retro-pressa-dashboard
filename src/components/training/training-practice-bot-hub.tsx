"use client";

import Link from "next/link";
import { ArrowRight, Bot, ExternalLink, MessageSquare, Sparkles } from "lucide-react";
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
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{scenario.description}</p>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-bold text-slate-800">Роль клиента:</span> {scenario.role}
      </p>
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
      <section className="card mb-6 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-10 text-white">
            <Bot size={56} strokeWidth={1.5} />
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Этап 3 · Практика</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Тренировочный бот в Telegram</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Прогрейте роль менеджера в {TRAINING_TELEGRAM_BOT.displayName}: бот играет клиента, вы отвечаете как
              в реальном диалоге — подбор подарка, возражения, сроки, возврат после расчёта.
            </p>
            <div className="mt-5">
              <TelegramOpenButton label={`Открыть ${TRAINING_TELEGRAM_BOT.displayName}`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Ролевые диалоги</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Разные типы клиентов</span>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Без риска для реальных лидов</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4 flex items-center gap-2">
        <Sparkles size={18} className="text-emerald-600" />
        <h3 className="text-lg font-black text-slate-950">Выберите сценарий</h3>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {PRACTICE_BOT_SCENARIOS.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </section>

      <section className="card mt-6 p-6">
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <MessageSquare size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <p>
            Диалог идёт в Telegram — на телефоне или в десктоп-приложении. Можно начать с общего меню бота или сразу
            выбрать сценарий кнопкой «Начать в Telegram».
          </p>
        </div>
      </section>
    </>
  );
}

export function TrainingPracticeBotHub() {
  return (
    <TrainingLayout
      title="Тренировочный бот"
      description={`Ролевые диалоги в Telegram: ${TRAINING_TELEGRAM_BOT.displayName}`}
      backHref="/training/practice"
      backLabel="К этапу «Практика»"
    >
      <BotHubContent />
    </TrainingLayout>
  );
}
