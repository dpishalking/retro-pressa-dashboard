import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagerCabinetScreen } from "@/components/manager-cabinet-screen";

export const metadata: Metadata = {
  title: "Мои продажи | Retro Pressa",
  description: "Личные продажи, зарплата и разбор вчерашних чатов"
};

export default function ManagerCabinetPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8 text-sm text-slate-600">Загружаю кабинет…</main>}>
      <ManagerCabinetScreen />
    </Suspense>
  );
}
