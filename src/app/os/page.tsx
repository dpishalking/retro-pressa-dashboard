import type { Metadata } from "next";
import { AnalyticsOsScreen } from "@/components/analytics-os/analytics-os-screen";

export const metadata: Metadata = {
  title: "RETRO PRESSA ANALYTICS OS — CEO Control Center",
  description: "Аналитическая операционная система собственника Retro Pressa"
};

export default function OsAnalyticsPage() {
  return <AnalyticsOsScreen />;
}
