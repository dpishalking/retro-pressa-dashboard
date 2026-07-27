"use client";

import { useEffect, useState } from "react";
import { IssueReader } from "@/modules/issue-reader";
import { readJsonResponse } from "@/lib/api-response";

type PublicIssue = {
  slug: string;
  title: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  pages: Array<{ page: number; src: string }>;
  status?: "processing" | "ready" | "error";
  errorMessage?: string;
};

export function ProductViewScreen({ slug }: { slug: string }) {
  const [issue, setIssue] = useState<PublicIssue | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      try {
        const response = await fetch(`/api/products/public/${encodeURIComponent(slug)}`);
        const data = await readJsonResponse<{ issue?: PublicIssue; error?: string }>(response);
        if (!response.ok || !data.issue) {
          throw new Error(data.error || "Выпуск не найден");
        }
        if (cancelled) return;
        setIssue(data.issue);
        setError("");
        setLoading(false);

        if (data.issue.status === "processing") {
          timer = window.setTimeout(() => {
            void load();
          }, 4000);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Не удалось открыть выпуск");
        setLoading(false);
      }
    };

    setLoading(true);
    void load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [slug]);

  if (loading && !issue) {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#1a1714] text-[13px] uppercase tracking-[0.18em] text-white/60">
        Открываем выпуск…
      </div>
    );
  }

  if (error && !issue) {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#1a1714] px-6 text-center text-[#f7f2ea]">
        <div>
          <p className="font-serif text-2xl italic">Выпуск недоступен</p>
          <p className="mt-3 text-sm text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  if (!issue) return null;

  if (issue.status === "processing") {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#1a1714] px-6 text-center text-[#f7f2ea]">
        <div>
          <p className="font-serif text-2xl italic">{issue.title}</p>
          <p className="mt-3 text-[13px] uppercase tracking-[0.18em] text-white/60">Готовим страницы…</p>
          <p className="mt-2 text-sm text-white/45">Обычно это занимает 1–3 минуты для большого PDF.</p>
        </div>
      </div>
    );
  }

  if (issue.status === "error") {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#1a1714] px-6 text-center text-[#f7f2ea]">
        <div>
          <p className="font-serif text-2xl italic">Не удалось подготовить выпуск</p>
          <p className="mt-3 text-sm text-white/60">{issue.errorMessage || "Ошибка конвертации"}</p>
        </div>
      </div>
    );
  }

  return (
    <IssueReader
      title={issue.title}
      subtitle="Retro Pressa · готовый выпуск"
      pageWidth={issue.pageWidth}
      pageHeight={issue.pageHeight}
      pages={issue.pages}
    />
  );
}
