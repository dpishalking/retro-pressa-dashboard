import type { Metadata } from "next";
import { ArchitectureDepthScreen } from "@/components/architecture-depth-screen";

export const metadata: Metadata = {
  title: "Глубина /architecture — Retro Pressa",
  description: "Докуда дочитывают лендинг архитектуры подарка и гипотезы по конверсии"
};

export default function ArchitectureDepthPage() {
  return <ArchitectureDepthScreen />;
}
