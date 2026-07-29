"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Trash2 } from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { useAuth } from "@/components/auth-provider";
import { readJsonResponse } from "@/lib/api-response";
import type { ProductIssueSummary } from "@/types/products";
import type { PassportDashboardProduct } from "@/types/product-passports";

type ListStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };
type ProductsTab = "issues" | "passports";

function publicOrigin() {
  if (typeof window === "undefined") return "https://rp-bi.site";
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return window.location.origin;
  }
  return "https://rp-bi.site";
}

function moneyLabel(price?: string, currency?: string) {
  if (!price) return "—";
  const cur = (currency || "EUR").toUpperCase() === "EUR" ? "€" : currency || "";
  return `${price} ${cur}`.trim();
}

function FieldBlock({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-800">{text}</p>
    </div>
  );
}

function PassportCard({
  product,
  canSeeCogs,
  expanded,
  onToggle,
}: {
  product: PassportDashboardProduct;
  canSeeCogs: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const m = product.meanings;
  const e = product.economy;
  const retail = moneyLabel(e.retail_price, e.currency);
  const cogs = moneyLabel(e.cost_price || e.cogs_total, e.currency);
  const margin = e.cogs_margin_pct ? `${e.cogs_margin_pct}%` : null;

  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-950">{product.bitrixName}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Цена: <span className="text-slate-950">{retail}</span>
            {canSeeCogs ? (
              <>
                {" · "}
                COGS: <span className="text-slate-950">{cogs}</span>
                {margin ? (
                  <>
                    {" · "}
                    Маржа: <span className="text-slate-950">{margin}</span>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          {m.key_idea ? <p className="mt-2 text-sm font-medium text-slate-700">{m.key_idea}</p> : null}
          {product.error ? <p className="mt-2 text-sm text-rose-600">Ошибка снимка: {product.error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={product.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink size={15} />
            Открыть карточку
          </a>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? "Свернуть" : "Как продавать"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <FieldBlock title="Что это" text={m.what_it_is} />
          <FieldBlock title="Для кого" text={m.for_whom} />
          <FieldBlock title="Боль клиента" text={m.client_pain} />
          <FieldBlock title="Когда предлагать" text={m.when_to_offer} />
          <FieldBlock title="Питч для менеджера" text={m.pitch_short || m.pitch_one_paragraph} />
          <FieldBlock title="Роль в линейке" text={m.role_in_line} />
          <FieldBlock title="Чем отличается" text={m.compare_with} />
          <FieldBlock title="Как работает" text={m.how_it_works} />
          <FieldBlock title="Выгоды" text={m.benefits} />
          <FieldBlock title="Жанры / опции" text={m.genres} />
          <FieldBlock title="Вопросы клиенту" text={m.client_questions} />
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {m.for_whom ? (
            <p className="text-sm text-slate-600">
              <span className="font-black text-slate-500">Кому: </span>
              {m.for_whom.length > 160 ? `${m.for_whom.slice(0, 160)}…` : m.for_whom}
            </p>
          ) : null}
          {m.when_to_offer ? (
            <p className="text-sm text-slate-600">
              <span className="font-black text-slate-500">Когда: </span>
              {m.when_to_offer.length > 160 ? `${m.when_to_offer.slice(0, 160)}…` : m.when_to_offer}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}

function PassportsPanel() {
  const [products, setProducts] = useState<PassportDashboardProduct[]>([]);
  const [canSeeCogs, setCanSeeCogs] = useState(false);
  const [syncedAt, setSyncedAt] = useState("");
  const [status, setStatus] = useState<ListStatus>({ state: "idle", message: "" });
  const [expandedId, setExpandedId] = useState("");

  const load = useCallback(async () => {
    setStatus({ state: "loading", message: "Загружаю продукты…" });
    try {
      const response = await fetch("/api/product-passports", { cache: "no-store" });
      const data = await readJsonResponse<{
        products?: PassportDashboardProduct[];
        canSeeCogs?: boolean;
        syncedAt?: string;
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить продукты");
      setProducts(data.products ?? []);
      setCanSeeCogs(Boolean(data.canSeeCogs));
      setSyncedAt(data.syncedAt || "");
      setStatus({ state: "ok", message: "" });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка загрузки продуктов",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Наши продукты</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Кому предложить, когда говорить, какой питч и какая цена
            {canSeeCogs ? ", плюс себестоимость и маржа" : ""}. Это линейка товаров Retro Pressa для продажи.
          </p>
          {syncedAt ? (
            <p className="mt-1 text-xs font-medium text-slate-500">
              Обновлено: {new Date(syncedAt).toLocaleString("ru-RU")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Обновить
        </button>
      </div>

      {status.state === "loading" && products.length === 0 ? (
        <p className="text-sm text-slate-500">Загрузка…</p>
      ) : null}
      {status.state === "error" ? <p className="text-sm text-rose-600">{status.message}</p> : null}

      {products.length === 0 && status.state !== "loading" ? (
        <p className="text-sm text-slate-500">Пока нет данных по продуктам.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((product) => (
            <PassportCard
              key={product.productId}
              product={product}
              canSeeCogs={canSeeCogs}
              expanded={expandedId === product.productId}
              onToggle={() =>
                setExpandedId((prev) => (prev === product.productId ? "" : product.productId))
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProductsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ProductsTab>("passports");
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
        message: error instanceof Error ? error.message : "Ошибка загрузки списка",
      });
    }
  }, []);

  useEffect(() => {
    if (tab === "issues") void loadIssues();
  }, [loadIssues, tab]);

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
          <h1 className="mt-3 font-serif text-3xl italic tracking-tight text-slate-950">Продукты</h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-slate-600">
            Линейка Retro Pressa для продаж и готовые PDF-выпуски со ссылками для клиентов.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("passports")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            tab === "passports"
              ? "bg-slate-950 text-white"
              : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Наши продукты
        </button>
        <button
          type="button"
          onClick={() => setTab("issues")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            tab === "issues"
              ? "bg-slate-950 text-white"
              : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Готовые выпуски
        </button>
      </div>

      {tab === "passports" ? <PassportsPanel /> : null}

      {tab === "issues" ? (
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Опубликованные выпуски</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Публичные ссылки для клиентов. Новые PDF — через агента/CLI.
              </p>
            </div>
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
      ) : null}
    </main>
  );
}
