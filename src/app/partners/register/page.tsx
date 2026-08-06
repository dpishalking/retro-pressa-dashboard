import type { Metadata } from "next";
import { PartnersRegisterScreen } from "@/components/partners/partners-register-screen";

export const metadata: Metadata = {
  title: "Стать партнёром | Retro Pressa"
};

export default function PartnersRegisterPage() {
  return <PartnersRegisterScreen />;
}
