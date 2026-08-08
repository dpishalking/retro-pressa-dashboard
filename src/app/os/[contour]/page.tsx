import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsOsContourScreen } from "@/components/analytics-os/analytics-os-contour-screen";
import { getContour } from "@/lib/analytics-os/contours";

type Props = { params: Promise<{ contour: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { contour: id } = await params;
  const contour = getContour(id);
  return {
    title: contour
      ? `${contour.title} — RETRO PRESSA ANALYTICS OS`
      : "Контур — RETRO PRESSA ANALYTICS OS"
  };
}

export default async function OsContourPage({ params }: Props) {
  const { contour: id } = await params;
  const contour = getContour(id);
  if (!contour || contour.leaveOs) notFound();
  return <AnalyticsOsContourScreen contour={contour} />;
}
