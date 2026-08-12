import type { Metadata } from "next";
import { BusinessContourScreen } from "@/components/business-contour-screen";

export const metadata: Metadata = {
  title: "Финансы — Retro Pressa",
  description: "План, факт, прогноз и юнит-экономика"
};

export default function FinancePage() {
  return <BusinessContourScreen contourId="finance" />;
}
