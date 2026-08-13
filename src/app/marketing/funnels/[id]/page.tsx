import type { Metadata } from "next";
import { FunnelBoardScreen } from "@/components/funnel-board-screen";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Воронка — Retro Pressa",
    description: `Планирование воронки ${id}`
  };
}

export default async function MarketingFunnelPage({ params }: Props) {
  const { id } = await params;
  return <FunnelBoardScreen funnelId={id} />;
}
