import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard-ui";

export const metadata: Metadata = {
  title: "Аналитика (legacy) — Retro Pressa",
  description: "Предыдущий операционный пульт KPI Retro Pressa"
};

export default function AnalyticsLegacyPage() {
  return <DashboardApp />;
}
