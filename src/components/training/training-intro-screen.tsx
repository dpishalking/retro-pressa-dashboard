"use client";

import { PlayCircle } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { COMPANY_INTRO_TITLE, COMPANY_INTRO_VIDEO_URL, COMPANY_INTRO_LEAD } from "@/lib/training/company-intro";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";

export function TrainingIntroScreen() {
  const embedUrl = normalizeVideoEmbedUrl(COMPANY_INTRO_VIDEO_URL);

  return (
    <TrainingLayout title={COMPANY_INTRO_TITLE} backHref="/training" backLabel="К обучению">
      <section className="card p-6">
        <p className="text-base leading-relaxed text-slate-700">{COMPANY_INTRO_LEAD}</p>

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--line)] bg-black">
          {embedUrl ? (
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                title={COMPANY_INTRO_TITLE}
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
