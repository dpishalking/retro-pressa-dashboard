"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { useAuth } from "@/components/auth-provider";
import { readJsonResponse } from "@/lib/api-response";
import type { ProductIssueSummary } from "@/types/products";

type ListStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

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
  const [listStatus, setListStatus] = useState<ListStatus>({ state: "idle", message: "" });
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

  if (!user) return null;

  const copyLink = async (viewPath: string, issueSlug: string) => {
    const url = `${origin}${viewPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(issueSlug);
      window.setTimeout(() => setCopiedSlug(""), 2000);
    } catch {
      window.prompt("Скопируйте ссылку:", url);
    }
  };

  const onDelete = async (slug: string) => {
    if (!window.confirm(`Удалить выпуск «${slug}»?`)) return;
    try {
      const response = await fetch(`/api/products?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(response);
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось удалить");
      await loadIssues();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ошибка удаления");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <OfficeHubBackLink />
          <h1 className="mt-3 font-serif text-3xl italic tracking-tight text-slate-950">Готовые выпуски</h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-slate-600">
            Публичные ссылки для клиентов. Новые PDF публикуются через агента/CLI — здесь список и копирование
            ссылок.
          </p>
        </div>
      </div>

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
                <li
                  key={issue.slug}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">{issue.title}</p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500">
                      {issue.status === "processing"
                        ? "Готовим страницы…"
                        : issue.status === "error"
                          ? `Ошибка: ${issue.errorMessage || "конвертация не удалась"}`
                          : `${issue.pageCount} стр.`}{" "}
                      · {issue.slug} · {new Date(issue.updatedAt).toLocaleString("ru-RU")}
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
