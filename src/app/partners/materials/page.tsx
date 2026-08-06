import type { Metadata } from "next";
import { PartnersMaterialsScreen } from "@/components/partners/partners-materials-screen";

export const metadata: Metadata = {
  title: "Материалы | Партнёрская программа"
};

export default function PartnersMaterialsPage() {
  return <PartnersMaterialsScreen />;
}
