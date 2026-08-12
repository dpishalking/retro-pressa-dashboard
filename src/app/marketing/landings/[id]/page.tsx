import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingEfficiencyScreen } from "@/components/landing-efficiency-screen";
import { getAlxLandingById } from "@/config/alx-landings";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const landing = getAlxLandingById(id);
  return {
    title: landing
      ? `${landing.siteName}${landing.address} — эффективность — Retro Pressa`
      : "Лендинг — Retro Pressa"
  };
}

export default async function MarketingLandingPage({ params }: Props) {
  const { id } = await params;
  if (!getAlxLandingById(id)) notFound();
  return <LandingEfficiencyScreen landingId={id} />;
}
