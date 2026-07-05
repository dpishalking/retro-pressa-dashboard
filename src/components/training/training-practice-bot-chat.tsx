"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { getPracticeScenario, trainingTelegramBotUrl } from "@/lib/training/practice-bot";

function BotScenarioContent({ scenarioId }: { scenarioId: string }) {
  const { user } = useTrainingUser();
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const scenario = getPracticeScenario(scenarioId);

  useEffect(() => {
    if (!user || !scenarioId) return;
    fetch("/api/training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        scenarioId,
        action: "start_bot_scenario"
      })
    }).catch(() => undefined);
  }, [scenarioId, user]);

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

  const markCompleted = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await fetch("/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          scenarioId,
          action: "complete_bot_scenario"
        })
      });
      setCompleted(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Сценарий {scenario.sortOrder}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">{scenario.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{scenario.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-5 py-3 text-sm font-bold text-white hover:bg-[#1a8bc4]"
          >
            <ExternalLink size={16} />
            Начать в Telegram
          </a>
          <button
            type="button"
            disabled={saving || completed}
            onClick={() => void markCompleted()}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {completed ? "Сценарий отмечен пройденным" : saving ? "Сохранение..." : "Отметить сценарий пройденным"}
          </button>
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
      backHref="/training/practice/bot"
      backLabel="К сценариям"
    >
      <BotScenarioContent scenarioId={scenarioId} />
    </TrainingLayout>
  );
}
