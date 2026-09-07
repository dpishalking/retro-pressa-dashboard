import type { Metadata } from "next";
import { ZabkovaClosePlaybookScreen } from "@/components/training/zabkova-close-playbook-screen";

export const metadata: Metadata = {
  title: "Плейбук Забковых — Retro Pressa"
};

export default function ZabkovaClosePlaybookPage() {
  return <ZabkovaClosePlaybookScreen />;
}
