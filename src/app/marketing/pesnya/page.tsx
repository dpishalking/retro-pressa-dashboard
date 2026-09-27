import type { Metadata } from "next";
import { ArchitectureDepthScreen } from "@/components/architecture-depth-screen";

export const metadata: Metadata = {
  title: "Глубина /pesnya — Retro Pressa",
  description: "Докуда дочитывают лендинг песни и гипотезы по конверсии"
};

export default function PesnyaDepthPage() {
  return <ArchitectureDepthScreen landingId="pesnya" />;
}
