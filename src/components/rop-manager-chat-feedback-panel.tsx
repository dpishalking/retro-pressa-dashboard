"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/api-response";
import type { ManagerChatFeedback, RopChatFeedbackReport } from "@/lib/rop-chat-feedback/types";

function todayRiga(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

type FeedbackPayload = {
  ok?: boolean;
  day?: string;
  report?: RopChatFeedbackReport | null;
  days?: string[];
  emptyHint?: string | null;
  error?: string;
};

type LoadStatus = { state: "idle" | "loading" | "error" | "ok"; message: string };

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ManagerCard({ row }: { row: ManagerChatFeedback }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-950">{row.name}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{row.headline}</p>
        </div>
        <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {row.dialogs} чатов · {row.messages} сообщ.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="С ценой" value={`${row.stats.withPrice}/${row.dialogs}`} />
        <StatChip label="К оформлению" value={`${row.stats.withClose}/${row.dialogs}`} />
        <StatChip label="Ждут ответа" value={String(row.stats.waitingOnUs)} />
        <StatChip label="Медленный 1-й ответ" value={String(row.stats.slowFirst)} />
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
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Что поправить</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {row.better.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">На сегодня</p>
        <p className="mt-1 text-sm leading-6 text-slate-800">{row.tryToday}</p>
      </div>

      {row.focusLeads.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Кого дожать</p>
          <ul className="mt-2 space-y-2">
            {row.focusLeads.map((lead) => (
              <li key={lead.id} className="text-sm leading-6 text-slate-700">
                <a
                  href={lead.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-700 hover:underline"
                >
                  {lead.title}
                </a>
                <span className="text-slate-500"> — {lead.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export function RopManagerChatFeedbackPanel() {
  const [day, setDay] = useState(todayRiga());
  const [report, setReport] = useState<RopChatFeedbackReport | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>({ state: "idle", message: "" });
  const [buildStatus, setBuildStatus] = useState<LoadStatus>({ state: "idle", message: "" });

  const load = useCallback(async (targetDay: string) => {
    setStatus({ state: "loading", message: "Загружаю ОС…" });
    try {
      const response = await fetch(`/api/conversations/manager-feedback?day=${targetDay}`, {
        cache: "no-store"
      });
      const data = await readJsonResponse<FeedbackPayload>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить ОС");
      setReport(data.report ?? null);
      setDays(data.days ?? []);
      setEmptyHint(data.emptyHint ?? null);
      setStatus({ state: "ok", message: "" });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить ОС"
      });
    }
  }, []);

  useEffect(() => {
    void load(day);
  }, [day, load]);

  const rebuild = async () => {
    setBuildStatus({ state: "loading", message: "Собираю чаты из Bitrix… это может занять 1–2 минуты" });
    try {
      const response = await fetch("/api/conversations/manager-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day })
      });
      const data = await readJsonResponse<FeedbackPayload>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось собрать ОС");
      setReport(data.report ?? null);
      setDays(data.days ?? []);
      setEmptyHint(data.emptyHint ?? null);
      setBuildStatus({
        state: "ok",
        message: `Готово: ${data.report?.managers.length ?? 0} менеджеров за ${day}`
      });
      setStatus({ state: "ok", message: "" });
    } catch (error) {
      setBuildStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось собрать ОС"
      });
    }
  };

  return (
    <section className="space-y-5">
      <header className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">ОС по чатам менеджеров</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Простая обратная связь за день</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              По каждому менеджеру: что получилось, что поправить, кого дожать. Без сложных терминов.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-600">
              День
              <input
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={() => void rebuild()}
              disabled={buildStatus.state === "loading"}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <RefreshCcw size={16} className={buildStatus.state === "loading" ? "animate-spin" : ""} />
              {buildStatus.state === "loading" ? "Собираю…" : "Собрать ОС"}
            </button>
          </div>
        </div>
        {report?.teamHeadline ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
            {report.teamHeadline}
          </p>
        ) : null}
        {buildStatus.message ? (
          <p
            className={`mt-3 text-sm ${
              buildStatus.state === "error"
                ? "text-red-700"
                : buildStatus.state === "ok"
                  ? "text-emerald-700"
                  : "text-slate-600"
            }`}
          >
            {buildStatus.message}
          </p>
        ) : null}
        {status.state === "error" ? <p className="mt-3 text-sm text-red-700">{status.message}</p> : null}
        {days.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {days.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDay(item)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  item === day ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {status.state === "loading" && !report ? (
        <p className="text-sm text-slate-600">Загружаю сохранённую ОС…</p>
      ) : null}

      {emptyHint && !report ? (
        <div className="card p-6">
          <p className="text-sm leading-6 text-slate-700">{emptyHint}</p>
          <button
            type="button"
            onClick={() => void rebuild()}
            disabled={buildStatus.state === "loading"}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            Собрать ОС за {day}
          </button>
        </div>
      ) : null}

      {report?.managers.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {report.managers.map((row) => (
            <ManagerCard key={row.bitrixUserId} row={row} />
          ))}
        </div>
      ) : null}

      {report && !report.managers.length ? (
        <div className="card p-6">
          <p className="text-sm text-slate-700">За этот день не нашлось живых чатов у менеджеров.</p>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        Источник: открытые линии Bitrix. Личный кабинет менеджера с разбором «вчера» —{" "}
        <Link href="/me" className="font-semibold text-blue-700 hover:underline">
          /me
        </Link>
        .
      </p>
    </section>
  );
}
