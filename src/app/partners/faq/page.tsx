import type { Metadata } from "next";
import { PartnersFaqScreen } from "@/components/partners/partners-faq-screen";

export const metadata: Metadata = {
  title: "FAQ | Партнёрская программа"
};

export default function PartnersFaqPage() {
  return <PartnersFaqScreen />;
}
