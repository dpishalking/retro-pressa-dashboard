import type { Metadata } from "next";
import { PartnersProfileScreen } from "@/components/partners/partners-profile-screen";

export const metadata: Metadata = {
  title: "Профиль | Партнёрская программа"
};

export default function PartnersProfilePage() {
  return <PartnersProfileScreen />;
}
