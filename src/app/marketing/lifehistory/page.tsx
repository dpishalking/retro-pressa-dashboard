import type { Metadata } from "next";
import { ArchitectureDepthScreen } from "@/components/architecture-depth-screen";

export const metadata: Metadata = {
  title: "Глубина /lifehistory — Retro Pressa",
  description: "Докуда дочитывают лендинг книги жизни и гипотезы по конверсии"
};

export default function LifeHistoryDepthPage() {
  return <ArchitectureDepthScreen landingId="lifehistory" />;
}
