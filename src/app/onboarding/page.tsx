import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { readClientReviewCatalog } from "@/lib/training/client-review-videos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ищем менеджеров по продажам | Retro Pressa",
  description:
    "Retro Pressa — международный сервис персональных подарков. Ищем менеджеров: переписка 80%, звонки 20%."
};

export default async function OnboardingPage() {
  const reviews = await readClientReviewCatalog();
  return <OnboardingScreen reviews={reviews} />;
}
