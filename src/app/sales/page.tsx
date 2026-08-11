import type { Metadata } from "next";
import { BusinessContourScreen } from "@/components/business-contour-screen";

export const metadata: Metadata = {
  title: "Продажи — Retro Pressa",
  description: "Контур продаж: сводка, прогноз и рабочие модули РОП"
};

export default function SalesPage() {
  return <BusinessContourScreen contourId="sales" />;
}
