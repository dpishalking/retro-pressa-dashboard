import type { Metadata } from "next";
import { AdminPartnersPanel } from "@/components/admin-partners-panel";

export const metadata: Metadata = {
  title: "Админ · Партнёры | Retro Pressa"
};

export default function AdminPartnersPage() {
  return <AdminPartnersPanel />;
}
