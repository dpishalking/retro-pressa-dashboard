import type { Metadata } from "next";
import { ArchitectureDepthScreen } from "@/components/architecture-depth-screen";

export const metadata: Metadata = {
  title: "Глубина /letter — Retro Pressa",
  description: "Докуда дочитывают лендинг письма и гипотезы по конверсии"
};

export default function LetterDepthPage() {
  return <ArchitectureDepthScreen landingId="letter" />;
}
