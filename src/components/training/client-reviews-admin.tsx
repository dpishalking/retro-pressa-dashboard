"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import { generateId } from "@/lib/training/id";
import type { TrainingClientReviewCatalog, TrainingClientReviewVideo } from "@/types/training";

function emptyVideo(sortOrder: number): TrainingClientReviewVideo {
  return {
    id: generateId("client-review"),
    title: `Отзыв ${sortOrder}`,
    url: "",
    embedUrl: "",
    sortOrder
  };
}

export function ClientReviewsAdmin({ onSaved }: { onSaved?: () => void }) {
  const [catalog, setCatalog] = useState<TrainingClientReviewCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/training/client-reviews", { cache: "no-store" });
      const data = (await response.json()) as { catalog?: TrainingClientReviewCatalog; error?: string };
      if (!response.ok || !data.catalog) {
        throw new Error(data.error ?? "Не удалось загрузить отзывы");
      }
      setCatalog(data.catalog);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateVideo = (index: number, patch: Partial<TrainingClientReviewVideo>) => {
    setCatalog((current) => {
      if (!current) return current;
      const videos = current.videos.map((video, videoIndex) =>
        videoIndex === index ? { ...video, ...patch } : video
      );
      return { ...current, videos };
    });
  };

  const addVideo = () => {
    setCatalog((current) => {
      if (!current) return current;
      return {
        ...current,
        videos: [...current.videos, emptyVideo(current.videos.length + 1)]
      };
    });
  };

  const removeVideo = (index: number) => {
    setCatalog((current) => {
      if (!current) return current;
      return {
        ...current,
        videos: current.videos
          .filter((_, videoIndex) => videoIndex !== index)
          .map((video, videoIndex) => ({ ...video, sortOrder: videoIndex + 1 }))
      };
    });
  };

  const save = async () => {
    if (!catalog) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/training/client-reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalog)
      });
      const data = (await response.json()) as { catalog?: TrainingClientReviewCatalog; error?: string };
      if (!response.ok || !data.catalog) {
        throw new Error(data.error ?? "Не удалось сохранить отзывы");
      }
      setCatalog(data.catalog);
      setMessage("Отзывы сохранены.");
      onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить отзывы");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка отзывов...</div>;
  }

  if (!catalog) {
    return (
      <div className="card p-8 text-sm text-red-600">
        {error ?? "Не удалось загрузить отзывы."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h3 className="text-lg font-black text-slate-950">Блок отзывов на этапе «Продукт»</h3>
        <p className="mt-2 text-sm text-slate-600">
          Видео показываются над карточками продуктов на странице `/training/products`.
        </p>

        <label className="mt-5 block">
          <span className="text-sm font-bold text-slate-800">Заголовок блока</span>
          <input
            type="text"
            value={catalog.sectionTitle}
            onChange={(event) => setCatalog({ ...catalog, sectionTitle: event.target.value })}
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          />
        </label>
      </section>

      {catalog.videos.map((video, index) => (
        <section key={video.id} className="card p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="text-sm font-black text-slate-950">Видео {index + 1}</p>
            <button
              type="button"
              onClick={() => removeVideo(index)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
              Удалить
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Название</span>
              <input
                type="text"
                value={video.title}
                onChange={(event) => updateVideo(index, { title: event.target.value })}
                className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-bold text-slate-800">Ссылка на YouTube</span>
              <input
                type="url"
                value={video.url ?? ""}
                onChange={(event) => updateVideo(index, { url: event.target.value, embedUrl: "" })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
              />
            </label>
          </div>

          {(() => {
            const previewUrl = normalizeVideoEmbedUrl(video.url ?? video.embedUrl);
            return previewUrl ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-black">
              <div className="aspect-video">
                <iframe
                  src={previewUrl}
                  title={video.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
            ) : null;
          })()}
        </section>
      ))}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addVideo}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <Plus size={16} />
          Добавить видео
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Сохранение..." : "Сохранить отзывы"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
