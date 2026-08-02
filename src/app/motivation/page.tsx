import type { Metadata } from "next";
import { MotivationScreen } from "@/components/motivation-screen";

export const metadata: Metadata = {
  title: "Мотивация | Retro Pressa"
};

export default function MotivationPage() {
  return <MotivationScreen />;
}
