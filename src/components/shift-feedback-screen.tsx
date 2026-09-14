"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, FileDown, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { number } from "@/lib/format";
import { readJsonResponse } from "@/lib/api-response";
import type { ShiftFeedbackReport, ShiftManagerPage } from "@/lib/shift-feedback/types";

type Payload = {
  ok?: boolean;
  day?: string;
  report?: ShiftFeedbackReport | null;
  days?: string[];
  emptyHint?: string | null;
  error?: string;
};

type Status = { state: "idle" | "loading" | "error" | "ok"; message: string };

function fmtMin(value: number | null) {
  if (value === null) return "—";
  if (value < 1) return "<1 мин";
  if (value < 60) return `${Math.round(value)} мин`;
  return `${(value / 60).toFixed(1).replace(".", ",")} ч`;
}

function fmtPct(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

async function downloadManagerPdf(day: string, managerId: string) {
  const response = await fetch(
    `/api/rop/shift-feedback/pdf?day=${encodeURIComponent(day)}&manager=${encodeURIComponent(managerId)}`
  );
  const type = response.headers.get("content-type") || "";
  if (response.ok && type.includes("pdf")) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const header = response.headers.get("content-disposition") || "";
    const utfName = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const asciiName = header.match(/filename="([^"]+)"/i)?.[1];
    link.href = url;
    link.download = decodeURIComponent(utfName || asciiName || `smena-${day}.pdf`);
    link.click();
    URL.revokeObjectURL(url);
    return "pdf" as const;
  }
  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response);
    throw new Error(data.error || "Не удалось скачать PDF");
  }
  window.open(`/rop/shift/${day}/pdf/${encodeURIComponent(managerId)}`, "_blank");
  return "print" as const;
}

function ManagerCard({ row, day }: { row: ShiftManagerPage; day: string }) {
  const [pdfStatus, setPdfStatus] = useState<Status>({ state: "idle", message: "" });

  async function downloadPdf() {
    setPdfStatus({ state: "loading", message: "Собираю PDF…" });
    try {
      const mode = await downloadManagerPdf(day, row.bitrixUserId);
      setPdfStatus({
        state: "ok",
        message: mode === "pdf" ? "PDF скачан." : "Открыл печатную страницу — сохраните как PDF."
      });
    } catch (error) {
      setPdfStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось скачать PDF"
      });
    }
  }

  return (
    <article id={`m-${row.bitrixUserId}`} className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-950">{row.name}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{row.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {row.leadsCreated} лидов · {row.dialogs} чатов
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-slate-800 disabled:opacity-60"
            onClick={() => void downloadPdf()}
            disabled={pdfStatus.state === "loading"}
          >
            <FileDown size={14} />
            {pdfStatus.state === "loading" ? "PDF…" : "Скачать PDF"}
          </button>
        </div>
      </div>
      {pdfStatus.state === "error" ? <p className="mt-2 text-xs font-semibold text-rose-700">{pdfStatus.message}</p> : null}
      {pdfStatus.state === "ok" ? <p className="mt-2 text-xs font-semibold text-emerald-700">{pdfStatus.message}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatChip label="Лиды / уник." value={`${row.leadsCreated} → ${row.leadUnique}`} />
        <StatChip label="Медиана ответа" value={fmtMin(row.medianReplyMin)} />
        <StatChip label="До 5 минут" value={fmtPct(row.shareUnder5)} />
        <StatChip label="Сообщ. на чат" value={row.avgManagerMessages == null ? "—" : String(row.avgManagerMessages).replace(".", ",")} />
        <StatChip label="Клиент последний" value={String(row.waitingOnUs)} />
        <StatChip label="Позже часа" value={fmtPct(row.shareOver60)} />
      </div>

      {row.good.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Получилось</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {row.good.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.better.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Усилить</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {row.better.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.focusLeads.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Три лида на утро</p>
          <div className="table-scroll mt-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-3">Лид</th>
                  <th className="py-1 pr-3">Почему</th>
                  <th className="py-1">Что написать</th>
                </tr>
              </thead>
              <tbody>
                {row.focusLeads.map((lead) => (
                  <tr key={lead.id} className="border-t border-[var(--line)]">
                    <td className="py-2 pr-3">
                      <a className="font-semibold text-blue-700 hover:underline" href={lead.url} target="_blank" rel="noreferrer">
                        {lead.title}
                      </a>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{lead.note}</td>
                    <td className="py-2 text-slate-700">{lead.nextStep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ShiftFeedbackScreen({ day }: { day: string }) {
  const router = useRouter();
  const [days, setDays] = useState<string[]>([]);
  const [report, setReport] = useState<ShiftFeedbackReport | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<Status>({ state: "loading", message: "Загружаю срез…" });
  const [refreshStatus, setRefreshStatus] = useState<Status>({ state: "idle", message: "" });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (targetDay: string) => {
    setLoadStatus({ state: "loading", message: "Загружаю срез…" });
    try {
      const response = await fetch(`/api/rop/shift-feedback?day=${encodeURIComponent(targetDay)}`, { cache: "no-store" });
      const data = await readJsonResponse<Payload>(response);
      if (!response.ok || data.error) throw new Error(data.error || "Не удалось загрузить срез");
      setReport(data.report ?? null);
      setDays(data.days ?? []);
      setEmptyHint(data.emptyHint ?? null);
      setLoadStatus({ state: "ok", message: "" });
    } catch (error) {
      setLoadStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить срез"
      });
    }
  }, []);

  useEffect(() => {
    void load(day);
  }, [day, load]);

  async function refresh() {
    setRefreshStatus({ state: "loading", message: "Собираю смену из Bitrix. Это может занять несколько минут…" });
    try {
      const response = await fetch("/api/rop/shift-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day })
      });
      const data = await readJsonResponse<Payload>(response);
      if (!response.ok || data.error) throw new Error(data.error || "Не удалось обновить срез");
      setReport(data.report ?? null);
      setDays(data.days ?? []);
      setEmptyHint(data.emptyHint ?? null);
      setRefreshStatus({ state: "ok", message: "Срез обновлён из Bitrix." });
    } catch (error) {
      setRefreshStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось обновить срез"
      });
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/rop/shift/${day}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const team = report?.team;
  const shiftUrl = `/rop/shift/${day}`;
  const dayPills = Array.from(new Set([day, ...days])).sort((a, b) => b.localeCompare(a));

  return (
    <main className="mx-auto w-[min(1100px,calc(100%-32px))] py-8">
      <Link href="/rop" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} />
        К инструментам РОП
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">Смена</p>
          <h1 className="text-4xl font-black tracking-normal text-slate-950">Обратная связь за день</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Постоянная ссылка на этот день: <span className="font-semibold text-slate-800">{shiftUrl}</span>.
            Официальный срез — каждый вечер в 20:05 по Москве.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold text-slate-700">
            День
            <input
              type="date"
              className="ml-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-950"
              value={day}
              onChange={(event) => router.push(`/rop/shift/${event.target.value}`)}
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-bold text-slate-800"
            onClick={() => void copyLink()}
          >
            <Copy size={16} />
            {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            onClick={() => void refresh()}
            disabled={refreshStatus.state === "loading" || loadStatus.state === "loading"}
          >
            <RefreshCcw size={16} />
            {refreshStatus.state === "loading" ? "Собираю…" : "Обновить из Bitrix"}
          </button>
        </div>
      </header>

      {dayPills.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {dayPills.map((item) => (
            <Link
              key={item}
              href={`/rop/shift/${item}`}
              className={`rounded-full px-3 py-1 text-xs font-bold ${item === day ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {item}
            </Link>
          ))}
        </div>
      ) : null}

      {loadStatus.state === "error" ? <p className="mb-4 text-sm font-semibold text-rose-700">{loadStatus.message}</p> : null}
      {refreshStatus.state === "error" ? <p className="mb-4 text-sm font-semibold text-rose-700">{refreshStatus.message}</p> : null}
      {refreshStatus.state === "ok" ? <p className="mb-4 text-sm font-semibold text-emerald-700">{refreshStatus.message}</p> : null}
      {refreshStatus.state === "loading" ? <p className="mb-4 text-sm font-semibold text-slate-600">{refreshStatus.message}</p> : null}

      {loadStatus.state === "loading" && !report ? <p className="text-sm text-slate-600">{loadStatus.message}</p> : null}

      {!report && emptyHint && loadStatus.state !== "loading" ? (
        <section className="card p-5">
          <p className="text-sm leading-6 text-slate-700">{emptyHint}</p>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="card mb-6 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{report.cutLabel}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{report.dayLabel}</h2>
            <p className="mt-2 text-sm text-slate-600">
              На смене: {report.onShiftNames.join(", ") || "в графике никого не отметили"}.
            </p>
            {team ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatChip label="Лиды / уник." value={`${number(team.created)} → ${number(team.unique)}`} />
                <StatChip label="Дубли" value={number(team.dupes)} />
                <StatChip label="Чаты" value={number(team.dialogs)} />
                <StatChip label="Клиент последний" value={number(team.waitingOnUs)} />
              </div>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
              Дубли по телефону/email с мая. UTM {team ? `${team.withUtm} / без ${team.withoutUtm}` : "—"}. Источник: график + Bitrix Open Lines, Москва.
            </p>
          </section>

          <div className="table-scroll card mb-6 p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Менеджер</th>
                  <th className="px-2 py-3 text-right">Лиды</th>
                  <th className="px-2 py-3 text-right">Уник.</th>
                  <th className="px-2 py-3 text-right">Чаты</th>
                  <th className="px-2 py-3 text-right">Ответ</th>
                  <th className="px-2 py-3 text-right">≤5 мин</th>
                  <th className="px-4 py-3">Одна фраза</th>
                </tr>
              </thead>
              <tbody>
                {report.managers.map((row) => (
                  <tr key={row.bitrixUserId} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-semibold">
                      <a href={`#m-${row.bitrixUserId}`} className="hover:underline">{row.scheduleName || row.name}</a>
                    </td>
                    <td className="px-2 py-3 text-right">{row.leadsCreated}</td>
                    <td className="px-2 py-3 text-right">{row.leadUnique}</td>
                    <td className="px-2 py-3 text-right">{row.dialogs}</td>
                    <td className="px-2 py-3 text-right">{fmtMin(row.medianReplyMin)}</td>
                    <td className="px-2 py-3 text-right">{fmtPct(row.shareUnder5)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.headline.replace(`${row.firstName}: `, "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="grid gap-4">
            {report.managers.map((row) => (
              <ManagerCard key={row.bitrixUserId} row={row} day={day} />
            ))}
          </section>

          {report.offShift.length ? (
            <section className="mt-8 grid gap-4">
              <h2 className="text-lg font-black text-slate-950">Вне графика, но была работа</h2>
              {report.offShift.map((row) => (
                <ManagerCard key={row.bitrixUserId} row={row} day={day} />
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
