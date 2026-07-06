"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { getStageConfig } from "@/lib/training/stages";

function PracticeHubContent() {
  const { user, loading: userLoading } = useTrainingUser();
  const [botLink, setBotLink] = useState<string | null>(null);
  const [fallbackBotLink, setFallbackBotLink] = useState<string | null>(null);
  const [botLinkError, setBotLinkError] = useState<string | null>(null);
  const [botLinkLoading, setBotLinkLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setBotLinkLoading(true);
    setBotLinkError(null);
    fetch("/api/training/bot-link")
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { error?: string; botLink?: string; fallbackBotLink?: string };
        if (!r.ok) {
          if (body.fallbackBotLink) setFallbackBotLink(body.fallbackBotLink);
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return body as { botLink: string };
      })
      .then((data) => setBotLink(data.botLink))
      .catch((e) => setBotLinkError(e instanceof Error ? e.message : "Не удалось получить ссылку"))
      .finally(() => setBotLinkLoading(false));
  }, [user]);

  if (userLoading || !user) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка модулей...</div>;
  }

  return (
    <>
      <article className="card mb-6 p-6 sm:p-8">
        <p className="text-base leading-7 text-slate-600">
          В тренажёрном боте вы отрабатываете навыки продаж в безопасной атмосфере: ведёте диалог
          с AI-клиентом, получаете обратную связь и разбор после каждой ролевки. Никакого давления
          от реального клиента — только практика и рост.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm leading-6 text-slate-600">
          <li>• Отработка квалификации, рекомендаций и работы с возражениями</li>
          <li>• Ролевки на реальных сценариях Retro Pressa</li>
          <li>• Оценка и подсказки от искусственного интеллекта после диалога</li>
        </ul>

        {botLinkLoading ? (
          <p className="mt-6 text-sm text-slate-500">Подготавливаем вашу персональную ссылку…</p>
        ) : botLink ? (
          <>
            <p className="mt-4 text-sm text-amber-800">
              Важно: открывайте бота только по этой персональной ссылке — иначе результаты не попадут в кабинет.
            </p>
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2481cc] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1a6ead]"
            >
              Открыть тренажёр в Telegram
              <ExternalLink size={18} />
            </a>
          </>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-red-600">
              {botLinkError ?? "Ссылка временно недоступна. Обратитесь к администратору."}
            </p>
            {fallbackBotLink ? (
              <a
                href={fallbackBotLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#2481cc] px-6 py-3 text-sm font-bold text-[#2481cc] transition hover:bg-blue-50"
              >
                Открыть бот в Telegram (без персональной ссылки)
                <ExternalLink size={18} />
              </a>
            ) : null}
          </div>
        )}
      </article>
    </>
  );
}

export function TrainingPracticeHub() {
  const stage = getStageConfig("practice")!;

  return (
    <TrainingLayout
      title={stage.title.replace(/^Этап \d+\.\s/, "")}
      backHref="/training"
      backLabel="К этапам обучения"
    >
      <PracticeHubContent />
    </TrainingLayout>
  );
}
