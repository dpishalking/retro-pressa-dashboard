"use client";

import { useEffect, useState } from "react";
import { PartnersLayout } from "@/components/partners/partners-layout";
import { readJsonResponse } from "@/lib/api-response";
import type { PartnerFaqItem } from "@/types/partners";

export function PartnersFaqScreen() {
  const [faq, setFaq] = useState<PartnerFaqItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/partners/faq");
        const payload = await readJsonResponse<{ faq: PartnerFaqItem[]; error?: string }>(response);
        if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить FAQ");
        if (!cancelled) setFaq(payload.faq);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PartnersLayout title="FAQ" description="Короткие ответы на частые вопросы партнёров.">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <section className="space-y-3">
        {faq.map((item) => (
          <details key={item.id} className="card group p-5 open:shadow-md">
            <summary className="cursor-pointer list-none text-lg font-black text-slate-950 marker:content-none">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
          </details>
        ))}
      </section>
    </PartnersLayout>
  );
}
