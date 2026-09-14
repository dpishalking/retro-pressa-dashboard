import type { Metadata } from "next";
import { ShiftFeedbackScreen } from "@/components/shift-feedback-screen";

export const metadata: Metadata = {
  title: "Смена менеджеров — Retro Pressa",
  description: "Ежедневный срез по менеджерам, которые были на смене."
};

export default function ShiftFeedbackPage() {
  return <ShiftFeedbackScreen />;
}
