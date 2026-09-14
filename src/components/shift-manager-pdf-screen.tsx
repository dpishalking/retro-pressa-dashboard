"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/api-response";
import type { ShiftFeedbackReport, ShiftManagerPage } from "@/lib/shift-feedback/types";

type Payload = {
  ok?: boolean;
  report?: ShiftFeedbackReport | null;
  error?: string;
};

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

export function ShiftManagerPdfScreen({ day, managerId }: { day: string; managerId: string }) {
  const [page, setPage] = useState<ShiftManagerPage | null>(null);
  const [report, setReport] = useState<ShiftFeedbackReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/rop/shift-feedback?day=${encodeURIComponent(day)}`, { cache: "no-store" });
        const data = await readJsonResponse<Payload>(response);
        if (!response.ok || data.error) throw new Error(data.error || "Не удалось загрузить срез");
        const found = [...(data.report?.managers ?? []), ...(data.report?.offShift ?? [])].find(
          (row) => row.bitrixUserId === managerId
        );
        if (!found || !data.report) throw new Error("Этого менеджера нет в срезе смены");
        if (cancelled) return;
        setReport(data.report);
        setPage(found);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось открыть отчёт");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day, managerId]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <p className="text-sm font-semibold text-rose-700">{error}</p>
        <Link href={`/rop/shift/${day}`} className="mt-4 inline-block text-sm font-bold text-blue-700">
          К смене
        </Link>
      </main>
    );
  }

  if (!page || !report) {
    return <main className="p-8 text-sm text-slate-600">Готовлю отчёт…</main>;
  }

  return (
    <main className="mx-auto max-w-[780px] bg-white px-8 py-8 text-slate-950">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          disabled={pdfBusy}
          onClick={async () => {
            setPdfBusy(true);
            try {
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
                link.href = url;
                link.download = decodeURIComponent(utfName || `smena-${day}.pdf`);
                link.click();
                URL.revokeObjectURL(url);
                return;
              }
              window.print();
            } finally {
              setPdfBusy(false);
            }
          }}
        >
          {pdfBusy ? "Собираю PDF…" : "Скачать PDF"}
        </button>
        <Link href={`/rop/shift/${day}`} className="text-sm font-semibold text-slate-600 hover:text-slate-950">
          К смене {day}
        </Link>
      </div>
      <p className="text-[11px] text-slate-500">Обратная связь за смену · {report.dayLabel} · {report.shiftHours}</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">{page.name}</h1>
      <p className="mt-2 text-base font-semibold leading-6">{page.headline}</p>
      <p className="mt-1 text-xs text-slate-500">{report.cutLabel}</p>

      <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-slate-200 pt-3">
        <div>
          <p className="text-xl font-black">{page.leadsCreated} → {page.leadUnique}</p>
          <p className="text-[11px] text-slate-500">Взял лидов / уникальные</p>
        </div>
        <div>
          <p className="text-xl font-black">{fmtMin(page.medianReplyMin)}</p>
          <p className="text-[11px] text-slate-500">Медиана ответа</p>
        </div>
        <div>
          <p className="text-xl font-black">{fmtPct(page.shareUnder5)}</p>
          <p className="text-[11px] text-slate-500">Ответы до 5 минут</p>
        </div>
        <div>
          <p className="text-xl font-black">{page.dialogs}</p>
          <p className="text-[11px] text-slate-500">Чатов в работе</p>
        </div>
        <div>
          <p className="text-xl font-black">{page.avgManagerMessages == null ? "—" : String(page.avgManagerMessages).replace(".", ",")}</p>
          <p className="text-[11px] text-slate-500">Сообщений на чат</p>
        </div>
        <div>
          <p className="text-xl font-black">{page.waitingOnUs}</p>
          <p className="text-[11px] text-slate-500">Клиент написал последним</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Дубли {page.leadDupes} · с UTM {page.withUtm} / без {page.withoutUtm} · позже часа {fmtPct(page.shareOver60)}
      </p>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Получилось</h2>
      {page.good.length ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">
          {page.good.map((item) => <li key={item}>{item}</li>)}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-slate-500">За этот срез сильных ходов в переписке не видно.</p>
      )}

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Усилить</h2>
      {page.better.length ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">
          {page.better.map((item) => <li key={item}>{item}</li>)}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Держать темп: цена, один совет, вопрос на оформление.</p>
      )}

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Три лида на утро</h2>
      {page.focusLeads.length ? (
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-3">Лид</th>
              <th className="py-1 pr-3">Почему</th>
              <th className="py-1">Что написать</th>
            </tr>
          </thead>
          <tbody>
            {page.focusLeads.map((lead) => (
              <tr key={lead.id} className="border-t border-slate-200">
                <td className="py-2 pr-3">{lead.title}</td>
                <td className="py-2 pr-3">{lead.note}</td>
                <td className="py-2">{lead.nextStep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Живых хвостов с номером лида за срез не видно.</p>
      )}

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Все лиды</h2>
      {page.leads?.length ? (
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-3">Лид</th>
              <th className="py-1">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {page.leads.map((lead) => (
              <tr key={lead.id} className="border-t border-slate-200">
                <td className="py-2 pr-3">
                  <a className="font-semibold underline" href={lead.url} target="_blank" rel="noreferrer">
                    {lead.title}
                  </a>
                  <span className="mt-0.5 block text-[11px] text-slate-500">#{lead.id}</span>
                </td>
                <td className="py-2">{lead.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Лидов с номером карточки за срез не видно.</p>
      )}
    </main>
  );
}
