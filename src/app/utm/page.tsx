import type { Metadata } from "next";
import { UtmGeneratorPublicScreen } from "@/components/utm-generator-public-screen";
import { UTM_GENERATOR_PUBLIC_PATH } from "@/lib/auth/routes";

export const metadata: Metadata = {
  title: "UTM-генератор — Retro Pressa",
  description: "Публичный генератор UTM-ссылок для рекламных кампаний Retro Pressa"
};

function publicUtmUrl() {
  const configured = process.env.NEXT_PUBLIC_UTM_GENERATOR_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (appUrl) return `${appUrl.replace(/\/$/, "")}${UTM_GENERATOR_PUBLIC_PATH}`;

  return UTM_GENERATOR_PUBLIC_PATH;
}

export default function PublicUtmGeneratorPage() {
  return <UtmGeneratorPublicScreen publicUrl={publicUtmUrl()} />;
}
