import type { Metadata } from "next";
import { RopHub } from "@/components/rop-hub";

export const metadata: Metadata = {
  title: "Инструменты РОП — Retro Pressa",
  description: "Кабинет РОП: анализ переписок и мотивация команды."
};

export default function RopPage() {
  return <RopHub />;
}
