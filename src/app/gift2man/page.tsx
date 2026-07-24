import type { Metadata } from "next";
import { Gift2manLandingScreen } from "@/components/gift2man-landing-screen";

export const metadata: Metadata = {
  title: "Familia Studio — Подарок для него",
  description:
    "Настоящая газета из дня его рождения. Проверьте дату и соберите подарок со смыслом.",
  robots: {
    index: true,
    follow: true
  }
};

export default function Gift2manLandingPage() {
  return <Gift2manLandingScreen />;
}
