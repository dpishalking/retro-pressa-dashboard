import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShiftManagerPdfScreen } from "@/components/shift-manager-pdf-screen";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type Props = { params: Promise<{ day: string; managerId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day } = await params;
  return {
    title: `PDF смены ${day} — Retro Pressa`,
    description: "Печатный отчёт по менеджеру за смену."
  };
}

export default async function ShiftManagerPdfPage({ params }: Props) {
  const { day, managerId } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !managerId) notFound();
  return <ShiftManagerPdfScreen day={day} managerId={managerId} />;
}
