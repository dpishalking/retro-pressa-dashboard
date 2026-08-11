import type { Metadata } from "next";
import { BusinessContourScreen } from "@/components/business-contour-screen";

export const metadata: Metadata = {
  title: "Маркетинг и трафик — Retro Pressa",
  description: "Контур маркетинга: сводка, прогноз и инструменты привлечения"
};

export default function MarketingPage() {
  return <BusinessContourScreen contourId="marketing" />;
}
