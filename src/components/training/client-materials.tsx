"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, FileText, ImageIcon, Play, Share2 } from "lucide-react";
import clientMaterialsCatalog from "../../../data/training/client-materials.json";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { ClientMaterial, ClientMaterialsCatalog } from "@/types/training";

const catalog = clientMaterialsCatalog as ClientMaterialsCatalog;

const CLIENT_MATERIAL_CATEGORY_ORDER = [
  "Репродукция",
  "Оригинал",
  "Персонализированный журнал",
  "Персонализированная газета",
  "Дигитальная версия",
  "Поздравительный журнал",
  "Поздравительная газета",
  "Оживи",
  "Книга жизни",
  "Наклейка",
  "Семейное издание",
  "Упаковка",
  "Видеоотзывы"
];

const ONLINE_READERS = [
  {
    id: "veselaya-semeika-1",
    title: "Весёлая семейка 1",
    href: "https://rp-bi.site/view/veselaya-semeika-1"
  },
  {
    id: "glamur-14-06-2025",
    title: "Гламур 14-06-2025",
    href: "https://rp-bi.site/view/glamur-14-06-2025"
  }
] as const;

function publicUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}

function MaterialPreview({ material }: { material: ClientMaterial }) {
  if (material.type === "video") {
    const embedUrl = normalizeVideoEmbedUrl(material.url);

    if (embedUrl) {
      return (
        <div className="aspect-video overflow-hidden rounded-2xl border border-[var(--line)] bg-black">
          <iframe
            src={embedUrl}
            title={material.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-[var(--line)] bg-slate-100 text-slate-500">
        <Play size={34} />
      </div>
    );
  }

  if (material.type === "document") {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-[var(--line)] bg-slate-100 text-slate-500">
        <FileText size={38} />
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={material.thumbnailUrl ?? material.url}
        alt={material.title}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function MaterialCard({
  material,
  copiedId,
  onCopy,
  onShare
}: {
  material: ClientMaterial;
  copiedId: string | null;
  onCopy: (material: ClientMaterial) => void;
  onShare: (material: ClientMaterial) => void;
}) {
  const canDownload = material.type !== "video" || Boolean(material.downloadUrl);
  const downloadUrl = `/api/training/client-materials/download?id=${encodeURIComponent(material.id)}`;

  return (
    <article className="card flex h-full flex-col p-5">
      <MaterialPreview material={material} />

      <div className="mt-4 flex-1">
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          {material.category}
        </span>
        <h3 className="mt-3 text-lg font-black text-slate-950">{material.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{material.description}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {canDownload ? (
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            <Download size={16} />
            Скачать
          </a>
        ) : (
          <a
            href={material.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            <ExternalLink size={16} />
            Открыть
          </a>
        )}

        <button
          type="button"
          onClick={() => onCopy(material)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          {copiedId === material.id ? <Check size={16} /> : <Copy size={16} />}
          {copiedId === material.id ? "Скопировано" : "Ссылка"}
        </button>

        <button
          type="button"
          onClick={() => onShare(material)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <Share2 size={16} />
          Поделиться
        </button>
      </div>
    </article>
  );
}

export function ClientMaterials() {
  const [activeCategory, setActiveCategory] = useState("Все");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReaderId, setCopiedReaderId] = useState<string | null>(null);

  const materials = useMemo(
    () => [...catalog.materials].sort((a, b) => a.sortOrder - b.sortOrder),
    []
  );
  const categories = useMemo(() => {
    const materialCategories = new Set(materials.map((material) => material.category));
    const extraCategories = Array.from(materialCategories).filter(
      (category) => !CLIENT_MATERIAL_CATEGORY_ORDER.includes(category)
    );
    return ["Все", ...CLIENT_MATERIAL_CATEGORY_ORDER, ...extraCategories];
  }, [materials]);
  const filteredMaterials = useMemo(
    () =>
      activeCategory === "Все"
        ? materials
        : materials.filter((material) => material.category === activeCategory),
    [activeCategory, materials]
  );

  const copyMaterialLink = async (material: ClientMaterial) => {
    const link = publicUrl(material.downloadUrl ?? material.url);
    await navigator.clipboard.writeText(link);
    setCopiedId(material.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const copyReaderLink = async (id: string, href: string) => {
    await navigator.clipboard.writeText(href);
    setCopiedReaderId(id);
    window.setTimeout(() => setCopiedReaderId(null), 2000);
  };

  const shareMaterial = async (material: ClientMaterial) => {
    const link = publicUrl(material.downloadUrl ?? material.url);

    if (navigator.share) {
      try {
        await navigator.share({
          title: material.title,
          text: material.description,
          url: link
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await copyMaterialLink(material);
  };

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Материалы для клиентов</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Готовые визуалы и видео, которые менеджер может скачать, скопировать ссылкой или отправить
              через системное меню «Поделиться».
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-black">Как пользоваться</p>
            <p className="mt-1 leading-5">Скачайте файл или скопируйте публичную ссылку и отправьте клиенту.</p>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                activeCategory === category ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {category === "Все" ? <ImageIcon size={16} /> : null}
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-5 shadow-[0_10px_30px_rgba(37,99,235,0.08)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white">
              Онлайн
            </span>
            <h3 className="mt-3 text-xl font-black text-slate-950">Онлайн-читалки наших изданий</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Откройте выпуск в браузере или скопируйте ссылку и отправьте клиенту.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {ONLINE_READERS.map((reader) => (
            <article
              key={reader.id}
              className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-black text-slate-950">{reader.title}</p>
                <p className="mt-1 truncate text-xs font-medium text-blue-700/70">{reader.href}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={reader.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <ExternalLink size={16} />
                  Открыть
                </a>
                <button
                  type="button"
                  onClick={() => void copyReaderLink(reader.id, reader.href)}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100"
                >
                  {copiedReaderId === reader.id ? <Check size={16} /> : <Copy size={16} />}
                  {copiedReaderId === reader.id ? "Скопировано" : "Ссылка"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {filteredMaterials.length === 0 ? (
        <section className="card p-8 text-center text-sm text-slate-600">
          Пока нет материалов в этой категории.
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              copiedId={copiedId}
              onCopy={(item) => void copyMaterialLink(item)}
              onShare={(item) => void shareMaterial(item)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
