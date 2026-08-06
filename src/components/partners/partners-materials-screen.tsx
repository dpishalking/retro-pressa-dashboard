"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Image as ImageIcon, Video } from "lucide-react";
import { PartnersLayout } from "@/components/partners/partners-layout";
import { readJsonResponse } from "@/lib/api-response";
import type { PartnerMaterial } from "@/types/partners";

function materialIcon(kind: PartnerMaterial["kind"]) {
  if (kind === "video" || kind === "reels") return Video;
  if (kind === "photo" || kind === "logo" || kind === "banner") return ImageIcon;
  return FileText;
}

export function PartnersMaterialsScreen() {
  const [materials, setMaterials] = useState<PartnerMaterial[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/partners/materials");
        const payload = await readJsonResponse<{ materials: PartnerMaterial[]; error?: string }>(response);
        if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить материалы");
        if (!cancelled) setMaterials(payload.materials);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PartnersLayout title="Материалы для продаж" description="Скачивайте готовые файлы одним кликом.">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2">
        {materials.map((material) => {
          const Icon = materialIcon(material.kind);
          return (
            <article key={material.id} className="card flex items-start gap-4 p-5">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-slate-950">{material.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{material.description}</p>
                <a
                  href={material.href}
                  download
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Download size={16} />
                  Скачать
                </a>
              </div>
            </article>
          );
        })}
      </section>
    </PartnersLayout>
  );
}
