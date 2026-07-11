import type { Metadata } from "next";
import { KnowledgeBaseScreen } from "@/components/training/knowledge-base-screen";

export const metadata: Metadata = {
  title: "База знаний — Retro Pressa"
};

export default function KnowledgeBasePage() {
  return <KnowledgeBaseScreen />;
}
