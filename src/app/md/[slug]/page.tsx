import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MdDocScreen } from "@/components/md-doc-screen";
import { findMdDocument, listMdDocuments, readMdDocument } from "@/lib/md/catalog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return listMdDocuments().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = findMdDocument(slug);
  if (!meta) return { title: "Спецификация | Retro Pressa" };
  return {
    title: `${meta.title} | Retro Pressa`,
    description: meta.description
  };
}

export default async function MdDocumentPage({ params }: Props) {
  const { slug } = await params;
  const doc = await readMdDocument(slug);
  if (!doc) notFound();

  return <MdDocScreen meta={doc.meta} markdown={doc.markdown} documents={listMdDocuments()} />;
}
