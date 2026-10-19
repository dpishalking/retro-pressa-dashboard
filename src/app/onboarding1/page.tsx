import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { OnboardingNextScreen } from "@/components/onboarding-next-screen";
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
  title: "Работайте из любой точки мира | Retro Pressa",
  description:
    "Ищем менеджеров по продажам в Retro Pressa: переписка с клиентами, обучение продуктам и регистрация на обучающей платформе."
};

export default async function OnboardingPreviewPage() {
  const reviews = await readClientReviewCatalog();
  return (
    <div className={`${display.variable} ${sans.variable} [font-family:var(--font-onb-sans),Manrope,sans-serif]`}>
      <OnboardingNextScreen reviews={reviews} />
    </div>
  );
}
