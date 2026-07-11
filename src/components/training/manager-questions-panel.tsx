"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BookOpen, EyeOff, Link2, RefreshCw, Save, X } from "lucide-react";
import { readJsonResponse } from "@/lib/api-response";
import type { ManagerQuestion, ManagerQuestionsSummary, ManagerQuestionStatus } from "@/types/training";

type LoadStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };
type ActionStatus = { questionId: string; state: "loading" | "ok" | "error"; message: string } | null;

function formatWhen(value?: string) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy, HH:mm", { locale: ru });
}

function statusLabel(status: ManagerQuestionStatus) {
  switch (status) {
    case "new":
      return "Новый";
    case "clustered":
      return "В работе";
    case "answered":
      return "В базе знаний";
    case "ignored":
      return "Игнор";
  }
}

function statusClass(status: ManagerQuestionStatus) {
  switch (status) {
    case "new":
      return "bg-amber-50 text-amber-700";
    case "clustered":
      return "bg-blue-50 text-blue-700";
    case "answered":
      return "bg-emerald-50 text-emerald-700";
    case "ignored":
      return "bg-slate-100 text-slate-600";
  }
}

function SummaryCard({ title, value, hint }: { title: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-sm text-slate-600">{hint}</p> : null}
    </div>
  );
}

function PromoteForm({
  question,
  saving,
  error,
  onCancel,
  onSave
}: {
  question: ManagerQuestion;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (answer: string, category: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState(question.category ?? "");

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <p className="text-sm font-bold text-slate-900">Добавить в базу знаний</p>
      <label className="mt-3 block">
        <span className="text-xs font-bold text-slate-700">Категория</span>
        <input
          type="text"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="CRM, Продукт, Доставка..."
          className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-bold text-slate-700">Ответ для менеджеров</span>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={4}
          placeholder="Проверенный ответ, который увидят менеджеры в базе знаний"
          className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave(answer, category)}
          disabled={saving || !answer.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? "Сохранение..." : "Сохранить в базу"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <X size={14} />
          Отмена
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

type WebhookStatus = {
  expectedUrl?: string;
  connected?: boolean;
  webhook?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
  error?: string;
};

function TelegramWebhookCard() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/training/manager-questions/setup-webhook", { cache: "no-store" });
      const data = await readJsonResponse<WebhookStatus>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось проверить webhook");
      }
      setStatus(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось проверить webhook");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    setConnecting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/training/manager-questions/setup-webhook", { method: "POST" });
      const data = await readJsonResponse<{ ok?: boolean; url?: string; error?: string }>(response);
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Не удалось подключить webhook");
      }
      setMessage(`Webhook зарегистрирован: ${data.url ?? "ok"}`);
      await load();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Не удалось подключить webhook");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-black text-slate-950">Telegram-бот</h3>
          <p className="mt-1 text-sm text-slate-600">
            Подключите webhook, добавьте бота в чат менеджеров и отключите privacy mode в BotFather.
          </p>
          {status?.expectedUrl ? (
            <p className="mt-2 break-all text-xs text-slate-500">{status.expectedUrl}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Проверить
          </button>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            <Link2 size={14} />
            {connecting ? "Подключение..." : "Подключить webhook"}
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        {status?.connected ? (
          <p className="font-semibold text-emerald-700">Webhook подключён.</p>
        ) : (
          <p className="font-semibold text-amber-700">Webhook ещё не подключён.</p>
        )}
        {status?.webhook?.url ? <p className="mt-1 break-all">Текущий URL: {status.webhook.url}</p> : null}
        {status?.webhook?.last_error_message ? (
          <p className="mt-1 text-red-600">Ошибка Telegram: {status.webhook.last_error_message}</p>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

export function ManagerQuestionsPanel() {
  const [summary, setSummary] = useState<ManagerQuestionsSummary | null>(null);
  const [questions, setQuestions] = useState<ManagerQuestion[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>({ state: "idle", message: "" });
  const [actionStatus, setActionStatus] = useState<ActionStatus>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadStatus({ state: "loading", message: "" });
    try {
      const [summaryResponse, questionsResponse] = await Promise.all([
        fetch("/api/training/manager-questions?view=summary", { cache: "no-store" }),
        fetch("/api/training/manager-questions", { cache: "no-store" })
      ]);

      const summaryData = await readJsonResponse<{ summary?: ManagerQuestionsSummary; error?: string }>(summaryResponse);
      const questionsData = await readJsonResponse<{ questions?: ManagerQuestion[]; error?: string }>(questionsResponse);

      if (!summaryResponse.ok || !summaryData.summary) {
        throw new Error(summaryData.error ?? "Не удалось загрузить сводку");
      }
      if (!questionsResponse.ok || !questionsData.questions) {
        throw new Error(questionsData.error ?? "Не удалось загрузить бэклог");
      }

      setSummary(summaryData.summary);
      setQuestions(questionsData.questions);
      setLoadStatus({ state: "ok", message: "" });
    } catch (error) {
      setLoadStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить вопросы менеджеров"
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchQuestion = async (id: string, patch: { status?: ManagerQuestionStatus; category?: string }) => {
    setActionStatus({ questionId: id, state: "loading", message: "" });
    try {
      const response = await fetch("/api/training/manager-questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch })
      });
      const data = await readJsonResponse<{ question?: ManagerQuestion; error?: string }>(response);
      if (!response.ok || !data.question) {
        throw new Error(data.error ?? "Не удалось обновить вопрос");
      }
      setQuestions((current) => current.map((item) => (item.id === id ? data.question! : item)));
      await load();
      setActionStatus({ questionId: id, state: "ok", message: "" });
    } catch (error) {
      setActionStatus({
        questionId: id,
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось обновить вопрос"
      });
    }
  };

  const promoteQuestion = async (id: string, answer: string, category: string) => {
    setActionStatus({ questionId: id, state: "loading", message: "" });
    try {
      const response = await fetch("/api/training/manager-questions/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, answer, category: category || undefined })
      });
      const data = await readJsonResponse<{ question?: ManagerQuestion; error?: string }>(response);
      if (!response.ok || !data.question) {
        throw new Error(data.error ?? "Не удалось добавить в базу знаний");
      }
      setPromotingId(null);
      await load();
      setActionStatus({ questionId: id, state: "ok", message: "Добавлено в базу знаний." });
    } catch (error) {
      setActionStatus({
        questionId: id,
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось добавить в базу знаний"
      });
    }
  };

  if (loadStatus.state === "loading" && !summary) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка вопросов менеджеров...</div>;
  }

  if (loadStatus.state === "error" && !summary) {
    return (
      <div className="card p-8">
        <p className="text-sm text-red-600">{loadStatus.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Вопросы менеджеров</h2>
            <p className="mt-1 text-sm text-slate-600">
              Сводка для контроля и бэклог перед добавлением в базу знаний.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loadStatus.state === "loading"}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loadStatus.state === "loading" ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>
      </section>

      <TelegramWebhookCard />

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard title="Уникальных вопросов" value={summary.total} />
          <SummaryCard title="Всего повторов" value={summary.totalOccurrences} />
          <SummaryCard title="Новых за неделю" value={summary.newThisWeek} />
          <SummaryCard title="Без ответа" value={summary.unanswered} />
          <SummaryCard title="В базе знаний" value={summary.answeredByKnowledgeBase} />
        </section>
      ) : null}

      {summary && summary.categories.length > 0 ? (
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h3 className="text-base font-black text-slate-950">Категории</h3>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>Вопросов</th>
                  <th>Повторов</th>
                </tr>
              </thead>
              <tbody>
                {summary.categories.map((row) => (
                  <tr key={row.category}>
                    <td className="font-semibold text-slate-900">{row.category}</td>
                    <td>{row.count}</td>
                    <td>{row.occurrences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h3 className="text-base font-black text-slate-950">Бэклог</h3>
          <p className="mt-1 text-sm text-slate-600">Отсортировано по частоте повторов.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Вопрос</th>
                <th>Повторы</th>
                <th>Автор</th>
                <th>Статус</th>
                <th>Последний раз</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-600">
                    Пока нет собранных вопросов. Подключите webhook и добавьте бота в чат менеджеров.
                  </td>
                </tr>
              ) : (
                questions.map((question) => {
                  const isPromoting = promotingId === question.id;
                  const isLoading = actionStatus?.questionId === question.id && actionStatus.state === "loading";
                  const actionError =
                    actionStatus?.questionId === question.id && actionStatus.state === "error"
                      ? actionStatus.message
                      : null;

                  return (
                    <tr key={question.id}>
                      <td className="max-w-md whitespace-normal">
                        <p className="font-semibold text-slate-900">{question.text}</p>
                        {question.category ? (
                          <p className="mt-1 text-xs text-slate-500">{question.category}</p>
                        ) : null}
                        {isPromoting ? (
                          <PromoteForm
                            question={question}
                            saving={isLoading}
                            error={actionError}
                            onCancel={() => {
                              setPromotingId(null);
                              setActionStatus(null);
                            }}
                            onSave={(answer, category) => void promoteQuestion(question.id, answer, category)}
                          />
                        ) : null}
                      </td>
                      <td>{question.occurrences}</td>
                      <td>{question.authorName ?? "—"}</td>
                      <td>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusClass(question.status)}`}
                        >
                          {statusLabel(question.status)}
                        </span>
                      </td>
                      <td>{formatWhen(question.lastSeenAt)}</td>
                      <td>
                        {question.status !== "answered" && !isPromoting ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPromotingId(question.id);
                                setActionStatus(null);
                              }}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                            >
                              <BookOpen size={12} />
                              В базу знаний
                            </button>
                            {question.status === "new" ? (
                              <button
                                type="button"
                                onClick={() => void patchQuestion(question.id, { status: "clustered" })}
                                disabled={isLoading}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                              >
                                В работу
                              </button>
                            ) : null}
                            {question.status !== "ignored" ? (
                              <button
                                type="button"
                                onClick={() => void patchQuestion(question.id, { status: "ignored" })}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                              >
                                <EyeOff size={12} />
                                Игнор
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
