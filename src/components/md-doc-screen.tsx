import Link from "next/link";
import { markdownToHtml } from "@/lib/md/markdown";
import type { MdDocumentMeta } from "@/lib/md/catalog";

export function MdDocScreen({
  meta,
  markdown,
  documents
}: {
  meta: MdDocumentMeta;
  markdown: string;
  documents: MdDocumentMeta[];
}) {
  const html = markdownToHtml(markdown);

  return (
    <main className="mx-auto w-[min(920px,calc(100%-32px))] py-8">
      <header className="mb-6">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">Retro Pressa · MD</p>
        <h1 className="text-3xl font-black tracking-normal text-slate-950 lg:text-4xl">{meta.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{meta.description}</p>
        {documents.length > 1 ? (
          <nav className="mt-4 flex flex-wrap gap-2">
            {documents.map((doc) => (
              <Link
                key={doc.slug}
                href={`/md/${doc.slug}`}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  doc.slug === meta.slug ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {doc.title}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <article
        className="card md-doc p-5 text-sm leading-7 text-slate-700 sm:p-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <p className="mt-6 text-xs text-slate-500">
        Публичная страница спецификаций. Рабочий раздел мотивации:{" "}
        <Link href="/motivation" className="font-semibold text-blue-600 hover:underline">
          /motivation
        </Link>
      </p>
    </main>
  );
}

export function MdIndexScreen({ documents }: { documents: MdDocumentMeta[] }) {
  return (
    <main className="mx-auto w-[min(920px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">Retro Pressa · MD</p>
        <h1 className="text-4xl font-black tracking-normal text-slate-950">Спецификации</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Публичные ТЗ и описания разделов кабинета. Можно открывать по прямой ссылке без входа.
        </p>
      </header>

      <section className="grid gap-4">
        {documents.map((doc) => (
          <Link key={doc.slug} href={`/md/${doc.slug}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <h2 className="text-xl font-black text-slate-950">{doc.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{doc.description}</p>
            <p className="mt-3 text-sm font-bold text-blue-600">Открыть →</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
