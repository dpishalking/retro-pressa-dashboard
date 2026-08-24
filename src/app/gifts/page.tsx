import type { Metadata } from "next";
import { GiftsLanding } from "@/components/gifts/gifts-landing";
import { giftsLandingMeta } from "@/config/gifts-landing";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://rp-bi.site";
const pageUrl = `${siteOrigin}/gifts`;

export const metadata: Metadata = {
  title: giftsLandingMeta.seoTitle,
  description: giftsLandingMeta.seoDescription,
  alternates: { canonical: pageUrl },
  openGraph: {
    type: "website",
    url: pageUrl,
    title: giftsLandingMeta.seoTitle,
    description: giftsLandingMeta.seoDescription,
    siteName: giftsLandingMeta.brand,
    locale: "ru_RU",
    images: [{ url: `${siteOrigin}/training/newspaper-from-date/pravda-izvestiya-stack.png`, alt: giftsLandingMeta.brand }]
  }
};

export default function GiftsPage() {
  return <GiftsLanding />;
}
