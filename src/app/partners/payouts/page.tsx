import type { Metadata } from "next";
import { PartnersPayoutsScreen } from "@/components/partners/partners-payouts-screen";

export const metadata: Metadata = {
  title: "Выплаты | Партнёрская программа"
};

export default function PartnersPayoutsPage() {
  return <PartnersPayoutsScreen />;
}
