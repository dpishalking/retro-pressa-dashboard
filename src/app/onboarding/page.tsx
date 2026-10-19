import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { readClientReviewCatalog } from "@/lib/training/client-review-videos";

const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-onb-display",
  display: "swap"
});

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-onb-sans",
  display: "swap"
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Работа, в которой вы дарите эмоции | Retro Pressa",
  description:
    "Retro Pressa — международный сервис персонализированных подарков. Ищем менеджеров по продажам: переписка и звонки, обучение и подготовка к стажировке."
};

export default async function OnboardingPage() {
  const reviews = await readClientReviewCatalog();
  return (
    <div className={`${display.variable} ${sans.variable} [font-family:var(--font-onb-sans),Manrope,sans-serif]`}>
      <OnboardingScreen reviews={reviews} />
    </div>
  );
}
