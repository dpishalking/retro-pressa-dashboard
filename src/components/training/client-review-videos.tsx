"use client";

import { useEffect, useState } from "react";
import type { TrainingClientReviewCatalog } from "@/types/training";

export function ClientReviewVideos() {
  const [catalog, setCatalog] = useState<TrainingClientReviewCatalog | null>(null);

  useEffect(() => {
    fetch("/api/training/client-reviews", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.catalog) setCatalog(data.catalog);
      })
      .catch(() => setCatalog(null));
  }, []);

  if (!catalog?.videos.length) return null;

  return (
    <section className="card mb-6 p-6">
      <h3 className="text-lg font-black text-slate-950">{catalog.sectionTitle}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {catalog.videos.map((video) => (
          <div key={video.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-black">
            <div className="aspect-video">
              <iframe
                src={video.embedUrl}
                title={video.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
