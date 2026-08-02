import type { Metadata } from "next";
import { MdIndexScreen } from "@/components/md-doc-screen";
import { listMdDocuments } from "@/lib/md/catalog";

export const metadata: Metadata = {
  title: "Спецификации | Retro Pressa",
  description: "Публичные ТЗ и описания разделов кабинета Retro Pressa"
};

export default function MdIndexPage() {
  return <MdIndexScreen documents={listMdDocuments()} />;
}
