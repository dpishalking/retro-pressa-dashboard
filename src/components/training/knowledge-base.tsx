"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, ExternalLink, Pencil, Plus, Save, Search, Send, ShoppingBag, PenLine, Trash2, X } from "lucide-react";
import { generateId } from "@/lib/training/id";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import { useTrainingUser } from "@/components/training/training-context";
import type {
  KnowledgeBaseCatalog,
  KnowledgeBaseEntry,
  KnowledgeBaseMediaType
} from "@/types/training";

function emptyEntry(sortOrder: number): KnowledgeBaseEntry {
  return {
    id: generateId("kb"),
    question: "",
    answer: "",
    category: "",
    mediaType: "none",
    mediaUrl: "",
    embedUrl: "",
    sortOrder
  };
}

const LIVE_LINKS = [
  {
    label: "Интернет-магазин",
    description: "retropressa.com",
    href: "https://retropressa.com/ru/",
    Icon: ShoppingBag
  },
  {
    label: "Интернет-магазин (Беларусь)",
    description: "retropressa.net",
    href: "https://retropressa.net/ru/",
    Icon: ShoppingBag
  },
  {
    label: "Сервис написания статей",
    description: "retropressa.online",
    href: "https://retropressa.online/",
    Icon: PenLine
  },
  {
    label: "Бот для написания статей",
    description: "t.me/retro_writer_bot",
    href: "https://t.me/retro_writer_bot",
    Icon: Send
  },
  {
    label: "Номера заказов (Европа)",
    description: "admin5.profita.biz",
    href: "https://admin5.profita.biz/",
    Icon: ClipboardList
  }
] as const;

function LiveLinksSection() {
  return (
    <section className="card border-rose-200 bg-rose-50/60 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">Боевые ссылки</h2>
          <p className="mt-1 text-sm text-slate-600">Сервисы, которыми менеджеры пользуются каждый день.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {LIVE_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 transition hover:border-rose-300 hover:bg-rose-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <link.Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-slate-950">{link.label}</span>
              <span className="block truncate text-xs text-slate-500">{link.description}</span>
            </span>
            <ExternalLink size={16} className="shrink-0 text-slate-400 group-hover:text-rose-600" />
          </a>
        ))}
      </div>
    </section>
  );
}

function EntryMedia({ entry }: { entry: KnowledgeBaseEntry }) {
  if (entry.mediaType === "video") {
    const src = normalizeVideoEmbedUrl(entry.mediaUrl ?? entry.embedUrl);
    if (!src) return null;
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-black">
        <div className="aspect-video">
          <iframe
            src={src}
            title={entry.question}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (entry.mediaType === "image" && entry.mediaUrl) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.mediaUrl} alt={entry.question} className="w-full object-cover" />
      </div>
    );
  }

  return null;
}

function EntryCard({ entry }: { entry: KnowledgeBaseEntry }) {
  return (
    <section className="card p-6">
      {entry.category ? (
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-bold uppercase tracking-wide text-slate-600">
          {entry.category}
        </span>
      ) : null}
      <h3 className="mt-3 text-2xl font-black text-slate-950">{entry.question}</h3>
      {entry.answer ? (
        <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-slate-700">{entry.answer}</p>
      ) : null}
      <EntryMedia entry={entry} />
    </section>
  );
}

function EntryEditor({
  entry,
  index,
  onChange,
  onRemove
}: {
  entry: KnowledgeBaseEntry;
  index: number;
  onChange: (patch: Partial<KnowledgeBaseEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm font-black text-slate-950">Вопрос {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} />
          Удалить
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-sm font-bold text-slate-800">Вопрос</span>
          <input
            type="text"
            value={entry.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder="Например: Как оформить возврат?"
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-800">Категория</span>
          <input
            type="text"
            value={entry.category ?? ""}
            onChange={(event) => onChange({ category: event.target.value })}
            placeholder="CRM, Продажи, Продукт..."
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-800">Тип вложения</span>
          <select
            value={entry.mediaType}
            onChange={(event) => onChange({ mediaType: event.target.value as KnowledgeBaseMediaType })}
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          >
            <option value="none">Без вложения</option>
            <option value="video">Видео (YouTube)</option>
            <option value="image">Фото (ссылка)</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm font-bold text-slate-800">Ответ</span>
          <textarea
            value={entry.answer}
            onChange={(event) => onChange({ answer: event.target.value })}
            rows={4}
            placeholder="Текст ответа для менеджеров"
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          />
        </label>
        {entry.mediaType !== "none" ? (
          <label className="block md:col-span-2">
            <span className="text-sm font-bold text-slate-800">
              {entry.mediaType === "video" ? "Ссылка на YouTube" : "Ссылка на изображение"}
            </span>
            <input
              type="url"
              value={entry.mediaUrl ?? ""}
              onChange={(event) => onChange({ mediaUrl: event.target.value, embedUrl: "" })}
              placeholder={
                entry.mediaType === "video"
                  ? "https://www.youtube.com/watch?v=..."
                  : "https://.../photo.jpg"
              }
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
            />
          </label>
        ) : null}
      </div>

      <EntryMedia entry={entry} />
    </section>
  );
}

export function KnowledgeBase() {
  const { isAdmin } = useTrainingUser();
  const [catalog, setCatalog] = useState<KnowledgeBaseCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/training/knowledge-base", { cache: "no-store" });
      const data = (await response.json()) as { catalog?: KnowledgeBaseCatalog; error?: string };
      if (!response.ok || !data.catalog) {
        throw new Error(data.error ?? "Не удалось загрузить базу знаний");
      }
      setCatalog(data.catalog);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить базу знаний");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog.entries;
    return catalog.entries.filter((entry) =>
      [entry.question, entry.answer, entry.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [catalog, query]);

  const updateEntry = (index: number, patch: Partial<KnowledgeBaseEntry>) => {
    setCatalog((current) => {
      if (!current) return current;
      const entries = current.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      );
      return { ...current, entries };
    });
  };

  const addEntry = () => {
    setCatalog((current) => {
      if (!current) return current;
      return { ...current, entries: [...current.entries, emptyEntry(current.entries.length + 1)] };
    });
  };

  const removeEntry = (index: number) => {
    setCatalog((current) => {
      if (!current) return current;
      return {
        ...current,
        entries: current.entries
          .filter((_, entryIndex) => entryIndex !== index)
          .map((entry, entryIndex) => ({ ...entry, sortOrder: entryIndex + 1 }))
      };
    });
  };

  const save = async () => {
    if (!catalog) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/training/knowledge-base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalog)
      });
      const data = (await response.json()) as { catalog?: KnowledgeBaseCatalog; error?: string };
      if (!response.ok || !data.catalog) {
        throw new Error(data.error ?? "Не удалось сохранить базу знаний");
      }
      setCatalog(data.catalog);
      setMessage("База знаний сохранена.");
      setEditMode(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить базу знаний");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка базы знаний...</div>;
  }

  if (!catalog) {
    return <div className="card p-8 text-sm text-red-600">{error ?? "Не удалось загрузить базу знаний."}</div>;
  }

  if (isAdmin && editMode) {
    return (
      <div className="space-y-4">
        <section className="card flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">Редактирование базы знаний</h2>
            <p className="mt-1 text-sm text-slate-600">Добавляйте вопросы, ответы и вложения (видео/фото).</p>
          </div>
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <X size={16} />
            Отмена
          </button>
        </section>

        {catalog.entries.map((entry, index) => (
          <EntryEditor
            key={entry.id}
            entry={entry}
            index={index}
            onChange={(patch) => updateEntry(index, patch)}
            onRemove={() => removeEntry(index)}
          />
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addEntry}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={16} />
            Добавить вопрос
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">База знаний</h2>
            <p className="mt-1 text-sm text-slate-600">Ответы на частые вопросы: текст, видео и фото.</p>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setEditMode(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100"
            >
              <Pencil size={16} />
              Редактировать
            </button>
          ) : null}
        </div>

        <div className="relative mt-5">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по вопросам и ответам..."
            className="w-full rounded-xl border border-[var(--line)] py-3 pl-11 pr-4 text-base"
          />
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </section>

      <LiveLinksSection />

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-600">
          {query.trim() ? "Ничего не найдено. Попробуйте изменить запрос." : "База знаний пока пуста."}
        </div>
      ) : (
        filtered.map((entry) => <EntryCard key={entry.id} entry={entry} />)
      )}
    </div>
  );
}
