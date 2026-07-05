import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard-ui";

export const metadata: Metadata = {
  title: "Инструменты РОП — Retro Pressa",
  description: "Кабинет РОП: ежедневный импорт переписок из Bitrix, план-факт, команда и Growth Intelligence."
};

export default function RopPage() {
  return <DashboardApp mode="rop" initialTab="Данные и настройки" />;
}
