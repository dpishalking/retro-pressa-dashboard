import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShiftFeedbackScreen } from "@/components/shift-feedback-screen";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type Props = { params: Promise<{ day: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day } = await params;
  return {
    title: `Смена ${day} — Retro Pressa`,
    description: "Срез по менеджерам, которые были на смене в этот день."
  };
}

export default async function ShiftFeedbackDayPage({ params }: Props) {
  const { day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  return <ShiftFeedbackScreen day={day} />;
}
