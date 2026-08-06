import type { Metadata } from "next";
import { PartnersSalesScreen } from "@/components/partners/partners-sales-screen";

export const metadata: Metadata = {
  title: "Продажи | Партнёрская программа"
};

export default function PartnersSalesPage() {
  return <PartnersSalesScreen />;
}
