import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { readClientReviewCatalog } from "@/lib/training/client-review-videos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Онбординг менеджера | Retro Pressa",
  description: "Видео о компании Retro Pressa, отзывы клиентов и регистрация на обучение менеджеров."
};

export default async function OnboardingPage() {
  const reviews = await readClientReviewCatalog();
  return <OnboardingScreen reviews={reviews} />;
}
