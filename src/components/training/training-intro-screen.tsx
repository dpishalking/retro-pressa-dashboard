"use client";

import { PlayCircle } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";

const INTRO_VIDEO_URL = "https://www.youtube.com/watch?v=o9KPK9g8CeQ";

export function TrainingIntroScreen() {
  const embedUrl = normalizeVideoEmbedUrl(INTRO_VIDEO_URL);

  return (
    <TrainingLayout title="Что такое Retro Pressa" backHref="/training" backLabel="К обучению">
      <section className="card p-6">
        <p className="text-base leading-relaxed text-slate-700">
          Посмотрите это видео, чтобы лучше понять масштаб компании, географию работы и продукты, с которыми мы
          работаем.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--line)] bg-black">
          {embedUrl ? (
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                title="Что такое Retro Pressa"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center bg-slate-50 px-6 text-center">
              <PlayCircle size={40} className="text-blue-500" />
              <p className="mt-3 text-base font-black text-slate-900">Видео скоро появится</p>
            </div>
          )}
        </div>
      </section>
    </TrainingLayout>
  );
}
