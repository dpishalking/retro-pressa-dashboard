"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { useAuth } from "@/components/auth-provider";
import { readJsonResponse } from "@/lib/api-response";
import { slugifyTitle } from "@/lib/products/slug";
import type { ProductIssueSummary } from "@/types/products";

type UploadStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

function publicOrigin() {
  if (typeof window === "undefined") return "https://rp-bi.site";
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return window.location.origin;
  }
  return "https://rp-bi.site";
}

export function ProductsScreen() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<ProductIssueSummary[]>([]);
  const [listStatus, setListStatus] = useState<UploadStatus>({ state: "idle", message: "" });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ state: "idle", message: "" });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState("");

  const origin = useMemo(() => publicOrigin(), []);

  const loadIssues = useCallback(async () => {
    setListStatus({ state: "loading", message: "Загружаю список…" });
    try {
      const response = await fetch("/api/products");
      const data = await readJsonResponse<{ issues?: ProductIssueSummary[]; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить список");
      setIssues(data.issues ?? []);
      setListStatus({ state: "ok", message: "" });
    } catch (error) {
      setListStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка загрузки списка"
      });
    }
  }, []);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyTitle(title));
  }, [title, slugTouched]);

  if (!user) return null;

  const onPickFile = (next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) {
      setUploadStatus({ state: "error", message: "Нужен файл PDF" });
      return;
    }
    setFile(next);
    setUploadStatus({ state: "idle", message: "" });
    if (!title) {
      const base = next.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      setTitle(base);
    }
  };

  const onUpload = async () => {
    if (!file) {
      setUploadStatus({ state: "error", message: "Выберите PDF" });
      return;
    }
    if (!title.trim()) {
      setUploadStatus({ state: "error", message: "Укажите название" });
      return;
    }

    setUploadStatus({ state: "loading", message: "Конвертирую PDF в страницы…" });
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("slug", slug.trim());
      form.set("file", file);
      const response = await fetch("/api/products", { method: "POST", body: form });
      const data = await readJsonResponse<{
        ok?: boolean;
        viewPath?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || "Ошибка загрузки");

      setUploadStatus({
        state: "ok",
        message: `Готово. Ссылка: ${origin}${data.viewPath}`
      });
      setFile(null);
      setTitle("");
      setSlug("");
      setSlugTouched(false);
      await loadIssues();
    } catch (error) {
      setUploadStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка загрузки"
      });
    }
  };

  const copyLink = async (viewPath: string, issueSlug: string) => {
    const url = `${origin}${viewPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(issueSlug);
      window.setTimeout(() => setCopiedSlug(""), 1600);
    } catch {
      window.prompt("Скопируйте ссылку:", url);
    }
  };

  const onDelete = async (issueSlug: string) => {
    if (!window.confirm(`Удалить выпуск «${issueSlug}»?`)) return;
    try {
      const response = await fetch(`/api/products?slug=${encodeURIComponent(issueSlug)}`, {
        method: "DELETE"
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось удалить");
      await loadIssues();
    } catch (error) {
      setListStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка удаления"
      });
    }
  };

  return (
    <main className="mx-auto w-[min(1100px,calc(100%-32px))] py-8">
      <OfficeHubBackLink />
      <header className="mb-8 mt-4">
        <p className="text-sm font-extrabold uppercase tracking-normal text-sky-600">Продукты</p>
        <h1 className="mt-2 text-4xl font-black tracking-normal text-slate-950">Готовые выпуски</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Загрузите PDF — получите вечную ссылку для клиента:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">rp-bi.site/view/…</code>. Вход в
          кабинет клиенту не нужен.
        </p>
      </header>

      <section className="card mb-6 p-5">
        <h2 className="text-lg font-black text-slate-950">Загрузить PDF</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Название
            <input
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-sky-400"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Весёлая семейка №1"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Slug ссылки
            <input
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-sky-400"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="veselaya-semeyka"
            />
            <span className="mt-1 block text-xs font-medium text-slate-500">
              {origin}/view/{slug || "…"}
            </span>
          </label>
        </div>

        <div
          className={`mt-4 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-slate-50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const next = e.dataTransfer.files?.[0] ?? null;
            onPickFile(next);
          }}
        >
          <Upload className="mx-auto text-slate-400" size={28} />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            Перетащите PDF сюда или{" "}
            <label className="cursor-pointer text-sky-600 underline">
              выберите файл
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-slate-500">До 120 МБ · до 80 страниц</p>
          {file ? (
            <p className="mt-3 text-sm font-bold text-slate-900">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onUpload()}
            disabled={uploadStatus.state === "loading"}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            {uploadStatus.state === "loading" ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            {uploadStatus.state === "loading" ? "Конвертирую…" : "Загрузить и опубликовать"}
          </button>
          {uploadStatus.message ? (
            <p
              className={`text-sm font-medium ${
                uploadStatus.state === "error"
                  ? "text-rose-600"
                  : uploadStatus.state === "ok"
                    ? "text-emerald-700"
                    : "text-slate-600"
              }`}
            >
              {uploadStatus.message}
            </p>
          ) : null}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950">Опубликованные выпуски</h2>
          <button
            type="button"
            onClick={() => void loadIssues()}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Обновить
          </button>
        </div>

        {listStatus.state === "loading" && issues.length === 0 ? (
          <p className="text-sm text-slate-500">Загрузка…</p>
        ) : null}
        {listStatus.state === "error" ? <p className="text-sm text-rose-600">{listStatus.message}</p> : null}

        {issues.length === 0 && listStatus.state !== "loading" ? (
          <p className="text-sm text-slate-500">Пока нет загруженных выпусков.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {issues.map((issue) => {
              const url = `${origin}${issue.viewPath}`;
              return (
                <li key={issue.slug} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">{issue.title}</p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500">
                      {issue.pageCount} стр. · {issue.slug} · {new Date(issue.updatedAt).toLocaleString("ru-RU")}
                    </p>
                    <p className="mt-1 truncate text-xs text-sky-700">{url}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyLink(issue.viewPath, issue.slug)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {copiedSlug === issue.slug ? <Check size={15} /> : <Copy size={15} />}
                      {copiedSlug === issue.slug ? "Скопировано" : "Ссылка"}
                    </button>
                    <Link
                      href={issue.viewPath}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink size={15} />
                      Открыть
                    </Link>
                    <button
                      type="button"
                      onClick={() => void onDelete(issue.slug)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 size={15} />
                      Удалить
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
