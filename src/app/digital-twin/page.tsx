import { Suspense } from "react";
import type { Metadata } from "next";
import { DigitalTwinApp } from "@/components/digital-twin/digital-twin-app";

export const metadata: Metadata = {
  title: "Цифровой двойник — Retro Pressa",
  description: "Decision Engine: управление бизнесом через драйверы роста, сценарии и AI-рекомендации"
};

export default function DigitalTwinPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-500">Загрузка цифрового двойника…</main>}>
      <DigitalTwinApp />
    </Suspense>
  );
}
