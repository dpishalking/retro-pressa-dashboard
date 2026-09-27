import type { Metadata } from "next";
import { ArchitectureDepthScreen } from "@/components/architecture-depth-screen";

export const metadata: Metadata = {
  title: "Глубина /gift2man — Retro Pressa",
  description: "Докуда дочитывают лендинг журнала о мужчине и гипотезы по конверсии"
};

export default function Gift2ManDepthPage() {
  return <ArchitectureDepthScreen landingId="gift2man" />;
}
