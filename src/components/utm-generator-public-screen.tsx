"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { UtmGeneratorPanel } from "@/components/utm-generator-panel";
import { UTM_GENERATOR_PUBLIC_PATH } from "@/lib/auth/routes";

type UtmGeneratorPublicScreenProps = {
  publicUrl: string;
};

function resolvePublicUrl(fallback: string) {
  if (typeof window === "undefined") return fallback;
  if (fallback.startsWith("http")) return fallback;
  return `${window.location.origin}${UTM_GENERATOR_PUBLIC_PATH}`;
}

export function UtmGeneratorPublicScreen({ publicUrl }: UtmGeneratorPublicScreenProps) {
  const [resolvedUrl, setResolvedUrl] = useState(publicUrl);
  const [copyState, setCopyState] = useState<"idle" | "ok">("idle");

  useEffect(() => {
    setResolvedUrl(resolvePublicUrl(publicUrl));
  }, [publicUrl]);

  const copyPublicUrl = useCallback(async () => {
    await navigator.clipboard.writeText(resolvedUrl);
    setCopyState("ok");
    window.setTimeout(() => setCopyState("idle"), 1800);
  }, [resolvedUrl]);

  return (
    <main className="mx-auto min-h-screen w-[min(1180px,calc(100%-32px))] py-8">
      <header className="mb-6 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6">
        <p className="text-sm font-extrabold uppercase tracking-wide text-emerald-600">Retro Pressa</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 lg:text-4xl">UTM-генератор ссылок</h1>
        <p className="mt-3 max-w-3xl text-base text-slate-600">
          Соберите финальный URL для рекламы. Метки попадут в Google Analytics и CRM.
          Используйте только ссылки из этого генератора — так мы убираем Unassigned и видим кампании в отчётах.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <Link2 size={16} className="text-emerald-600" />
            <span className="font-semibold">{resolvedUrl}</span>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
            onClick={() => void copyPublicUrl()}
          >
            {copyState === "ok" ? <Check size={16} /> : <Copy size={16} />}
            {copyState === "ok" ? "Скопировано" : "Скопировать ссылку на генератор"}
          </button>
        </div>
      </header>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Инструкция для подрядчика</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Выберите лендинг, источник и medium из списка — не придумывайте свои значения.</li>
          <li>Имя кампании: формат <code className="rounded bg-slate-100 px-1">2026_07_gift_lv</code> (год_месяц_тема_рынок).</li>
          <li>Скопируйте готовую ссылку и вставьте её в рекламный кабинет как <strong>Final URL</strong>.</li>
          <li>Одна кампания в кабинете = одно имя <code className="rounded bg-slate-100 px-1">utm_campaign</code> в ссылке.</li>
          <li>Не запускайте объявления без UTM — иначе трафик уйдёт в Unassigned.</li>
        </ol>
      </section>

      <UtmGeneratorPanel variant="public" />

      <footer className="mt-8 text-center text-xs text-slate-400">
        Retro Pressa · публичный инструмент разметки · {UTM_GENERATOR_PUBLIC_PATH}
      </footer>
    </main>
  );
}
