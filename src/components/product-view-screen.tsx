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
};

export function ProductViewScreen({ slug }: { slug: string }) {
  const [issue, setIssue] = useState<PublicIssue | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/products/public/${encodeURIComponent(slug)}`);
        const data = await readJsonResponse<{ issue?: PublicIssue; error?: string }>(response);
        if (!response.ok || !data.issue) {
          throw new Error(data.error || "Выпуск не найден");
        }
        if (!cancelled) setIssue(data.issue);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось открыть выпуск");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#1a1714] text-[13px] uppercase tracking-[0.18em] text-white/60">
        Открываем выпуск…
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#1a1714] px-6 text-center text-[#f7f2ea]">
        <div>
          <p className="font-serif text-2xl italic">Выпуск недоступен</p>
          <p className="mt-3 text-sm text-white/60">{error || "Не найден"}</p>
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
