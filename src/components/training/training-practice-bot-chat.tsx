"use client";

import Link from "next/link";
import { Bot, ExternalLink } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { getPracticeScenario, TRAINING_TELEGRAM_BOT, trainingTelegramBotUrl } from "@/lib/training/practice-bot";

function BotScenarioContent({ scenarioId }: { scenarioId: string }) {
  const scenario = getPracticeScenario(scenarioId);

  if (!scenario) {
    return (
      <div className="card p-8">
        <p className="text-sm text-slate-600">Сценарий не найден.</p>
        <Link href="/training/practice/bot" className="mt-4 inline-block text-sm font-bold text-blue-600">
          К списку сценариев
        </Link>
      </div>
    );
  }

  const telegramUrl = trainingTelegramBotUrl(scenario.telegramStartParam);

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Сценарий {scenario.sortOrder}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">{scenario.title}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">{scenario.description}</p>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-bold text-slate-900">Роль клиента:</span> {scenario.role}
        </p>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--line)] bg-gradient-to-r from-[#229ED9] to-[#1a8bc4] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <Bot size={24} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/80">Telegram</p>
              <p className="text-lg font-black">{TRAINING_TELEGRAM_BOT.displayName}</p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm leading-7 text-slate-600">
            Нажмите кнопку ниже — откроется бот в Telegram с этим сценарием. Отвечайте как менеджер Retro Pressa:
            слушайте запрос, подбирайте продукт по смыслу, отрабатывайте возражения.
          </p>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-5 py-3 text-sm font-bold text-white hover:bg-[#1a8bc4]"
          >
            <ExternalLink size={16} />
            Начать сценарий в Telegram
          </a>
          <p className="text-xs text-slate-500">
            Ссылка:{" "}
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
              {telegramUrl.replace("https://", "")}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

export function TrainingPracticeBotChat({ scenarioId }: { scenarioId: string }) {
  const scenario = getPracticeScenario(scenarioId);

  return (
    <TrainingLayout
      title={scenario?.title ?? "Сценарий"}
      description="Отработайте диалог в Telegram-боте."
      backHref="/training/practice/bot"
      backLabel="К сценариям"
    >
      <BotScenarioContent scenarioId={scenarioId} />
    </TrainingLayout>
  );
}
