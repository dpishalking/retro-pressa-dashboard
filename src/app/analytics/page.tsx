import type { Metadata } from "next";
import { DashboardApp } from "@/components/dashboard-ui";

export const metadata: Metadata = {
  title: "Аналитика — Retro Pressa",
  description: "Операционный пульт Retro Pressa: KPI, воронка, маркетинг, продажи и Growth Intelligence"
};

export default function AnalyticsPage() {
  return <DashboardApp />;
}
