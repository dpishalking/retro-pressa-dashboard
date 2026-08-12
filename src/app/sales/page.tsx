import type { Metadata } from "next";
import { BusinessContourScreen } from "@/components/business-contour-screen";

export const metadata: Metadata = {
  title: "Продажи — Retro Pressa",
  description: "Сводка продаж, прогноз и работа команды"
};

export default function SalesPage() {
  return <BusinessContourScreen contourId="sales" />;
}
