"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { getPracticeScenario, trainingTelegramBotUrl } from "@/lib/training/practice-bot";

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
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-5 py-3 text-sm font-bold text-white hover:bg-[#1a8bc4]"
        >
          <ExternalLink size={16} />
          Начать в Telegram
        </a>
      </section>
    </div>
  );
}

export function TrainingPracticeBotChat({ scenarioId }: { scenarioId: string }) {
  const scenario = getPracticeScenario(scenarioId);

  return (
    <TrainingLayout
      title={scenario?.title ?? "Сценарий"}
      backHref="/training/practice/bot"
      backLabel="К сценариям"
    >
      <BotScenarioContent scenarioId={scenarioId} />
    </TrainingLayout>
  );
}
