import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { readClientReviewCatalog } from "@/lib/training/client-review-videos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ищем менеджеров по продажам | Retro Pressa",
  description:
    "Международная компания Retro Pressa ищет менеджеров по продажам. Удалённая работа, обучение продукту и подготовка к стажировке."
};

export default async function OnboardingPage() {
  const reviews = await readClientReviewCatalog();
  return <OnboardingScreen reviews={reviews} />;
}
