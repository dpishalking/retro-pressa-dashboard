import type { Metadata } from "next";
import { AdAnalyticsScreen } from "@/components/ad-analytics-screen";

export const metadata: Metadata = {
  title: "Аналитика рекламы — Retro Pressa",
  description: "GA4, каналы привлечения, сверка с CRM-лидами и AI-ответы по трафику"
};

export default function AdAnalyticsPage() {
  return <AdAnalyticsScreen />;
}
