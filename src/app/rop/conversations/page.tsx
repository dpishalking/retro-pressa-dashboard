import type { Metadata } from "next";
import { RopConversationsScreen } from "@/components/rop-conversations-screen";

export const metadata: Metadata = {
  title: "Анализ переписок — Инструменты РОП",
  description: "Ежедневный анализ переписок из Bitrix с историей, конверсией, возражениями и потерями."
};

export default function RopConversationsPage() {
  return <RopConversationsScreen />;
}
