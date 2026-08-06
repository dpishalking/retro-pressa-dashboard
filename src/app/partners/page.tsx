import type { Metadata } from "next";
import { Suspense } from "react";
import { PartnersHomeScreen } from "@/components/partners/partners-home-screen";

export const metadata: Metadata = {
  title: "Кабинет партнёра | Retro Pressa"
};

export default function PartnersPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-[min(1120px,calc(100%-32px))] py-8 text-sm text-slate-500">Загрузка...</main>}>
      <PartnersHomeScreen />
    </Suspense>
  );
}
