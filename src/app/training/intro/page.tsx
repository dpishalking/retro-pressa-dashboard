import type { Metadata } from "next";
import { TrainingIntroScreen } from "@/components/training/training-intro-screen";

export const metadata: Metadata = {
  title: "Retro Pressa — кто мы? — Обучение"
};

export default function TrainingIntroPage() {
  return <TrainingIntroScreen />;
}
