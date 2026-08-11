import { Suspense } from "react";
import type { Metadata } from "next";
import { PredictiveModelsScreen } from "@/components/predictive-models-screen";

export const metadata: Metadata = {
  title: "Предиктивные модели — Retro Pressa",
  description: "Прогнозы продаж, маркетинга и финансов: план, факт и run-rate"
};

export default function PredictivePage() {
  return (
    <Suspense fallback={<main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8 text-sm text-slate-500">Загрузка…</main>}>
      <PredictiveModelsScreen />
    </Suspense>
  );
}
