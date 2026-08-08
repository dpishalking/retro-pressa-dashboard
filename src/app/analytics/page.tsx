import type { Metadata } from "next";
import { AnalyticsOsScreen } from "@/components/analytics-os/analytics-os-screen";

export const metadata: Metadata = {
  title: "RETRO PRESSA ANALYTICS OS — Центр управления",
  description: "Аналитика Retro Pressa для собственника"
};

export default function AnalyticsPage() {
  return <AnalyticsOsScreen />;
}
