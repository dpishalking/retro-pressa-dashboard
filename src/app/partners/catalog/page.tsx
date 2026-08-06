import type { Metadata } from "next";
import { PartnersCatalogScreen } from "@/components/partners/partners-catalog-screen";

export const metadata: Metadata = {
  title: "Каталог | Партнёрская программа"
};

export default function PartnersCatalogPage() {
  return <PartnersCatalogScreen />;
}
