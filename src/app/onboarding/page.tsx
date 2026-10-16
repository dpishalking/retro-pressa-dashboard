import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { readClientReviewCatalog } from "@/lib/training/client-review-videos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Продавайте кусочек истории | Retro Pressa",
  description:
    "Для будущих менеджеров: видео о компании, реакция людей на подарок и переход к изучению продукта."
};

export default async function OnboardingPage() {
  const reviews = await readClientReviewCatalog();
  return <OnboardingScreen reviews={reviews} />;
}
