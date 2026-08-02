"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Plus,
  RefreshCcw,
  Settings2,
  Trophy,
  X
} from "lucide-react";
import { OfficeHubBackLink } from "@/components/office-hub";
import { readJsonResponse } from "@/lib/api-response";
import { eur, number, pct } from "@/lib/format";
import {
  periodStatusLabel,
  resourceStatusLabel,
  resourceTypeLabel,
  resultStatusLabel,
  reviewStatusLabel,
  updateCategoryLabel
} from "@/lib/motivation/labels";
import type {
  MotivationPagePayload,
  MotivationResultStatus,
  MonthlyUpdateCategory,
  SalesResourceType
} from "@/types/motivation";

type ActionStatus = { state: "idle" | "loading" | "ok" | "error"; message: string };

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
    </div>
  );
}

function statusTone(status: MotivationResultStatus | string): string {
  switch (status) {
    case "completed":
    case "rewarded":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending_confirmation":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

const resourceTabs: Array<{ id: "all" | SalesResourceType; label: string }> = [
  { id: "all", label: "Все" },
  { id: "landing", label: "Лендинги" },
  { id: "quiz", label: "Квизы" },
  { id: "script", label: "Скрипты" },
  { id: "presentation", label: "Презентации" },
  { id: "calculator", label: "Калькуляторы" },
  { id: "training", label: "Обучение" },
  { id: "other", label: "Другие инструменты" }
];

export function MotivationScreen() {
  const [payload, setPayload] = useState<MotivationPagePayload | null>(null);
  const [periodId, setPeriodId] = useState<string>("");
  const [viewAsManagerId, setViewAsManagerId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const [resourceTab, setResourceTab] = useState<"all" | SalesResourceType>("all");
  const [sortKey, setSortKey] = useState<
    "place" | "reviewLeadRatio" | "averageItemsPerOrder" | "leadsCount" | "earnedBonuses"
  >("place");
  const [loadStatus, setLoadStatus] = useState<ActionStatus>({ state: "loading", message: "Загружаю..." });
  const [reviewStatus, setReviewStatus] = useState<ActionStatus>({ state: "idle", message: "" });
  const [adminStatus, setAdminStatus] = useState<ActionStatus>({ state: "idle", message: "" });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [reviewForm, setReviewForm] = useState({
    customerName: "",
    orderId: "",
    orderUrl: "",
    reviewDate: new Date().toISOString().slice(0, 10),
    reviewText: "",
    screenshotUrl: "",
    chatMessageUrl: "",
    managerComment: ""
  });
  const [ruleForm, setRuleForm] = useState({
    title: "",
    description: "",
    rewardAmount: 50,
    targetValue: 2.5,
    ruleType: "numeric_target" as const
  });
  const [updateForm, setUpdateForm] = useState({
    category: "important" as MonthlyUpdateCategory,
    title: "",
    shortDescription: "",
    fullDescription: "",
    buttonLabel: "Открыть",
    buttonUrl: ""
  });
  const [resourceForm, setResourceForm] = useState({
    title: "",
    type: "landing" as SalesResourceType,
    description: "",
    usageInstructions: "",
    salesStage: "",
    url: "",
    owner: ""
  });
  const [adjustForm, setAdjustForm] = useState({
    managerId: "",
    metricName: "averageItemsPerOrder",
    newValue: 0,
    reason: ""
  });

  async function load(nextPeriodId = periodId, nextViewAs = viewAsManagerId) {
    setLoadStatus({ state: "loading", message: "Загружаю мотивацию..." });
    try {
      const params = new URLSearchParams();
      if (nextPeriodId) params.set("periodId", nextPeriodId);
      if (nextViewAs) params.set("viewAsManagerId", nextViewAs);
      const response = await fetch(`/api/motivation?${params.toString()}`, { cache: "no-store" });
      const data = await readJsonResponse<MotivationPagePayload & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Ошибка загрузки");
      setPayload(data);
      if (!nextPeriodId && data.period?.id) setPeriodId(data.period.id);
      setLoadStatus({ state: "ok", message: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка загрузки";
      setLoadStatus({ state: "error", message });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedLeaderboard = useMemo(() => {
    if (!payload) return [];
    const rows = [...payload.leaderboard];
    rows.sort((a, b) => {
      if (sortKey === "place") return a.place - b.place;
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
    return rows;
  }, [payload, sortKey]);

  const filteredResources = useMemo(() => {
    if (!payload) return [];
    const activeFirst = [...payload.resources].sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return a.displayOrder - b.displayOrder;
    });
    if (resourceTab === "all") return activeFirst;
    return activeFirst.filter((r) => r.type === resourceTab);
  }, [payload, resourceTab]);

  async function submitReview() {
    if (!payload?.period) return;
    setReviewStatus({ state: "loading", message: "Отправляю отзыв..." });
    try {
      const response = await fetch("/api/motivation/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", periodId: payload.period.id, ...reviewForm })
      });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось отправить");
      setShowReviewModal(false);
      setReviewStatus({ state: "ok", message: "Отзыв отправлен на проверку" });
      await load(payload.period.id, viewAsManagerId);
    } catch (error) {
      setReviewStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка отправки"
      });
    }
  }

  async function moderate(reviewId: string, action: "approve" | "reject" | "clarify") {
    setReviewStatus({ state: "loading", message: "Сохраняю решение..." });
    try {
      const response = await fetch("/api/motivation/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewId,
          reason: rejectReason[reviewId] || ""
        })
      });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить");
      setReviewStatus({ state: "ok", message: "Статус отзыва обновлён" });
      await load(periodId, viewAsManagerId);
    } catch (error) {
      setReviewStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка модерации"
      });
    }
  }

  async function adminAction(body: Record<string, unknown>) {
    setAdminStatus({ state: "loading", message: "Сохраняю..." });
    try {
      const response = await fetch("/api/motivation/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await readJsonResponse<{ error?: string; payload?: MotivationPagePayload }>(response);
      if (!response.ok) throw new Error(data.error || "Ошибка сохранения");
      setAdminStatus({ state: "ok", message: "Сохранено" });
      if (data.payload) setPayload(data.payload);
      else await load(periodId, viewAsManagerId);
    } catch (error) {
      setAdminStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка"
      });
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  }

  if (loadStatus.state === "loading" && !payload) {
    return (
      <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
        <OfficeHubBackLink />
        <p className="mt-6 text-sm text-slate-600">Загружаю мотивацию...</p>
      </main>
    );
  }

  if (loadStatus.state === "error" && !payload) {
    return (
      <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
        <OfficeHubBackLink />
        <section className="card mt-6 p-6">
          <h1 className="text-2xl font-black">Не удалось загрузить раздел</h1>
          <p className="mt-2 text-sm text-rose-700">{loadStatus.message}</p>
          <button type="button" className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void load()}>
            Повторить
          </button>
        </section>
      </main>
    );
  }

  if (!payload) return null;

  if (!payload.period) {
    return (
      <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
        <OfficeHubBackLink />
        <section className="card mt-6 p-6">
          <h1 className="text-3xl font-black">Мотивация команды</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Условия мотивации на этот месяц пока не опубликованы. Здесь появятся новые цели, бонусы и обновления отдела продаж.
          </p>
        </section>
      </main>
    );
  }

  const summary = payload.summary;
  const period = payload.period;

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <OfficeHubBackLink />
        <div className="flex flex-wrap items-center gap-2">
          {payload.canEdit ? (
            <button
              type="button"
              onClick={() => setShowAdmin((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <Settings2 size={16} />
              Настроить мотивацию
            </button>
          ) : null}
          {payload.canEdit ? (
            <button
              type="button"
              onClick={() => void adminAction({ action: "recalculate", periodId: period.id, viewAsManagerId })}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={adminStatus.state === "loading"}
            >
              <RefreshCcw size={16} />
              {adminStatus.state === "loading" ? "Пересчитываю..." : "Пересчитать показатели"}
            </button>
          ) : null}
        </div>
      </div>

      <header className="mb-6">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-orange-600">Мотивация</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">Мотивация команды</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Все дополнительные бонусы, цели и обновления отдела продаж в одном месте.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">
              Месяц
              <select
                className="ml-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold"
                value={period.id}
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  void load(e.target.value, viewAsManagerId);
                }}
              >
                {payload.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone(period.status)}`}>
              {periodStatusLabel(period.status)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeTab === "overview" ? "bg-slate-900 text-white" : "bg-white border border-[var(--line)]"}`}
          >
            Обзор
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeTab === "history" ? "bg-slate-900 text-white" : "bg-white border border-[var(--line)]"}`}
          >
            История
          </button>
        </div>
      </header>

      {payload.notifications.length > 0 ? (
        <section className="mb-4 space-y-2">
          {payload.notifications.slice(0, 3).map((n) => (
            <div key={n.id} className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              <strong>{n.title}.</strong> {n.message}
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="card p-5">
          <SectionHead title="История мотивации" subtitle="Условия, показатели и начисленные бонусы по прошлым месяцам." />
          {payload.history.length === 0 ? (
            <p className="text-sm text-slate-600">История пока пуста.</p>
          ) : (
            <div className="space-y-4">
              {payload.history.map((item) => (
                <article key={item.period.id} className="rounded-xl border border-[var(--line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-black">{item.period.title}</h3>
                    <span className="text-xs font-bold uppercase text-slate-500">{periodStatusLabel(item.period.status)}</span>
                  </div>
                  {item.summary ? (
                    <p className="mt-2 text-sm text-slate-700">
                      Бонус: {eur(item.summary.preliminaryBonus)} · место: {item.summary.placeInTeam ?? "—"} · отзывы:{" "}
                      {item.summary.approvedReviews}
                    </p>
                  ) : null}
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {item.results.map((r) => (
                      <li key={r.id}>
                        {resultStatusLabel(r.status)} · {number(r.currentValue, 2)} · {eur(r.rewardAmount)}
                        {r.comment ? ` · ${r.comment}` : ""}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {summary ? (
            <section className="card mb-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-2xl font-black text-orange-700">
                    {summary.manager.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={summary.manager.photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                    ) : (
                      summary.manager.name.slice(0, 1)
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">{summary.manager.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      План: {summary.metrics.salesPlan != null ? eur(summary.metrics.salesPlan) : "—"} · Факт:{" "}
                      {eur(summary.metrics.salesAmount)} · Лиды: {summary.metrics.leadsCount} · Оплаты:{" "}
                      {summary.metrics.paidOrdersCount}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Ваш дополнительный бонус</p>
                  <p className="mt-1 text-3xl font-black">{eur(summary.preliminaryBonus)}</p>
                  {summary.potentialBonus > 0 ? (
                    <p className="mt-2 text-sm text-slate-300">
                      Вы можете дополнительно заработать ещё {eur(summary.potentialBonus)} в этом месяце.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Среднее кол-во наименований</p>
                  <p className="mt-1 text-xl font-black">{number(summary.metrics.averageItemsPerOrder, 1)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Хороших отзывов</p>
                  <p className="mt-1 text-xl font-black">{summary.approvedReviews}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Место в рейтинге отзывов</p>
                  <p className="mt-1 text-xl font-black">{summary.reviewRank ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Место в команде</p>
                  <p className="mt-1 text-xl font-black">{summary.placeInTeam ?? "—"}</p>
                </div>
              </div>
              {summary.reviewsToNextBonus != null && summary.reviewsToNextBonus > 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  До следующего бонуса: ещё {summary.reviewsToNextBonus} подтверждённых отзыва.
                </p>
              ) : null}
            </section>
          ) : (
            <section className="card mb-4 p-5">
              <p className="text-sm text-slate-600">
                Личная сводка недоступна: аккаунт не связан с менеджером мотивации. РОП может привязать логин в настройках.
              </p>
            </section>
          )}

          <section className="card mb-4 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionHead title="Бонусы текущего месяца" subtitle="Прогресс по каждому условию и предварительная сумма." />
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white"
              >
                <Plus size={16} />
                Добавить отзыв клиента
              </button>
            </div>
            {payload.bonusCards.length === 0 ? (
              <p className="text-sm text-slate-600">
                Условия мотивации на этот месяц пока не опубликованы. Здесь появятся новые цели, бонусы и обновления отдела продаж.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {payload.bonusCards.map(({ rule, result, leaderName, leaderValue, gapToLeader }) => {
                  const status = result?.status ?? "not_started";
                  return (
                    <article key={rule.id} className={`rounded-2xl border p-4 ${statusTone(status)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">{rule.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{rule.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black">{eur(rule.rewardAmount)}</p>
                          <p className="mt-1 text-xs font-bold uppercase">{resultStatusLabel(status)}</p>
                        </div>
                      </div>
                      {result ? (
                        <div className="mt-4">
                          {rule.calculationConfig.metricKey === "average_items_per_order" ? (
                            <>
                              <p className="text-sm font-semibold text-slate-800">
                                Сейчас: {number(result.currentValue, 1)} из {number(result.targetValue ?? 0, 1)}
                              </p>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                                <div
                                  className="h-full rounded-full bg-slate-900"
                                  style={{ width: `${Math.min(100, result.progressPercent)}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-slate-800">
                                Ваш показатель: {number(result.currentValue, 1)}%
                                {result.rank ? ` · место ${result.rank}` : ""}
                              </p>
                              {leaderName && leaderValue != null ? (
                                <p className="mt-1 text-sm text-slate-700">
                                  Лидер: {leaderName} ({number(leaderValue, 1)}%)
                                  {gapToLeader != null && gapToLeader > 0
                                    ? `. До лидера — ${number(gapToLeader, 1)} процентного пункта.`
                                    : result.rank === 1
                                      ? ". Вы лидируете."
                                      : ""}
                                </p>
                              ) : null}
                            </>
                          )}
                          {result.hint ? <p className="mt-3 text-sm text-slate-700">{result.hint}</p> : null}
                          {result.rewardAmount > 0 ? (
                            <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-800">
                              <CheckCircle2 size={16} />
                              Предварительный бонус — {eur(result.rewardAmount)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <details className="mt-3 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold">Правила расчёта</summary>
                        <p className="mt-2 leading-6">
                          {rule.calculationConfig.notes || rule.description}
                          {rule.calculationConfig.uniqueLineItems !== false
                            ? " Учитываются уникальные наименования в заказе."
                            : " Учитывается сумма количеств позиций."}
                        </p>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
            {reviewStatus.message ? (
              <p className={`mt-3 text-sm ${reviewStatus.state === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                {reviewStatus.message}
              </p>
            ) : null}
          </section>

          <section className="card mb-4 p-5">
            <SectionHead title="Рейтинг команды" subtitle="Соотношение отзывов к лидам и прогресс по ценности заказа." />
            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ["place", "Место"],
                  ["reviewLeadRatio", "Отзывы/лиды"],
                  ["averageItemsPerOrder", "Среднее наименований"],
                  ["leadsCount", "Лиды"],
                  ["earnedBonuses", "Бонусы"]
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortKey(key)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${sortKey === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="table-scroll">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Место</th>
                    <th className="px-2 py-2">Менеджер</th>
                    {payload.canSeeFullLeaderboard ? <th className="px-2 py-2">Лиды</th> : null}
                    <th className="px-2 py-2">Отзывы</th>
                    <th className="px-2 py-2">Отзывы/лиды</th>
                    {payload.canSeeFullLeaderboard ? <th className="px-2 py-2">Конверсия</th> : null}
                    <th className="px-2 py-2">Среднее наим.</th>
                    {payload.canSeeFullLeaderboard ? <th className="px-2 py-2">Бонусы</th> : null}
                    <th className="px-2 py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((row) => (
                    <tr
                      key={row.managerId}
                      className={`border-t border-[var(--line)] ${row.isCurrentUser ? "bg-orange-50" : ""} ${row.place <= 3 ? "font-semibold" : ""}`}
                    >
                      <td className="px-2 py-3">
                        {row.place <= 3 ? <Trophy size={14} className="mr-1 inline text-amber-500" /> : null}
                        {row.place}
                      </td>
                      <td className="px-2 py-3">{row.managerName}{row.isCurrentUser ? " (вы)" : ""}</td>
                      {payload.canSeeFullLeaderboard ? <td className="px-2 py-3">{row.leadsCount}</td> : null}
                      <td className="px-2 py-3">{row.approvedReviews}</td>
                      <td className="px-2 py-3">{number(row.reviewLeadRatio, 1)}%</td>
                      {payload.canSeeFullLeaderboard ? <td className="px-2 py-3">{pct(row.conversionToPaid)}</td> : null}
                      <td className="px-2 py-3">{number(row.averageItemsPerOrder, 1)}</td>
                      {payload.canSeeFullLeaderboard ? <td className="px-2 py-3">{eur(row.earnedBonuses)}</td> : null}
                      <td className="px-2 py-3">{row.qualifiesForReviewContest ? "Участвует" : "Не в рейтинге"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!payload.canSeeFullLeaderboard ? (
              <p className="mt-3 text-xs text-slate-500">
                Финансовые показатели других менеджеров скрыты. Полную таблицу видит руководитель.
              </p>
            ) : null}
          </section>

          {(payload.myReviews.length > 0 || payload.pendingReviews.length > 0) && (
            <section className="card mb-4 p-5">
              <SectionHead title="Отзывы клиентов" subtitle="История отправок и очередь проверки для руководителя." />
              {payload.myReviews.length > 0 ? (
                <div className="mb-4 space-y-2">
                  {payload.myReviews.map((review) => (
                    <div key={review.id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{review.customerName}</strong>
                        <span className="text-xs font-bold uppercase">{reviewStatusLabel(review.status)}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{review.reviewText}</p>
                      {review.rejectionReason ? (
                        <p className="mt-1 text-rose-700">Причина: {review.rejectionReason}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {payload.canEdit && payload.pendingReviews.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase text-slate-500">На проверке</h3>
                  {payload.pendingReviews.map((review) => (
                    <div key={review.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                      <p className="font-semibold">
                        {review.customerName} · заказ {review.orderId}
                      </p>
                      <p className="mt-1">{review.reviewText}</p>
                      <input
                        className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                        placeholder="Причина отклонения (обязательна при отклонении)"
                        value={rejectReason[review.id] || ""}
                        onChange={(e) => setRejectReason((prev) => ({ ...prev, [review.id]: e.target.value }))}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => void moderate(review.id, "approve")}>
                          Подтвердить
                        </button>
                        <button type="button" className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => void moderate(review.id, "reject")}>
                          Отклонить
                        </button>
                        <button type="button" className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white" onClick={() => void moderate(review.id, "clarify")}>
                          Запросить уточнение
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          <section className="card mb-4 p-5">
            <SectionHead title="Что нового в этом месяце" subtitle="Инструменты, продукты, лендинги и важные изменения отдела продаж." />
            {payload.updates.length === 0 ? (
              <p className="text-sm text-slate-600">Пока нет опубликованных обновлений.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {payload.updates.map((update) => (
                  <article key={update.id} className="rounded-2xl border border-[var(--line)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase text-slate-600">
                        {updateCategoryLabel(update.category)}
                      </span>
                      {update.isPinned || (update.publishedAt && Date.now() - Date.parse(update.publishedAt) < 7 * 86400000) ? (
                        <span className="text-xs font-bold uppercase text-orange-600">Новое</span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-black">{update.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{update.shortDescription}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{update.fullDescription}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {update.buttonUrl ? (
                        <a
                          href={update.buttonUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                        >
                          {update.buttonLabel || "Открыть"} <ExternalLink size={14} />
                        </a>
                      ) : null}
                      {update.secondaryButtonUrl ? (
                        <button
                          type="button"
                          onClick={() => void copyText(update.secondaryButtonUrl)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-bold"
                        >
                          {update.secondaryButtonLabel || "Скопировать ссылку"} <Copy size={14} />
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card mb-4 p-5">
            <SectionHead title="Актуальные инструменты и лендинги" subtitle="Каталог материалов для ежедневной работы менеджера." />
            <div className="mb-4 flex flex-wrap gap-2">
              {resourceTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setResourceTab(tab.id)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${resourceTab === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {filteredResources.length === 0 ? (
              <p className="text-sm text-slate-600">Нет инструментов в этой категории.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredResources.map((resource) => (
                  <article key={resource.id} className="rounded-2xl border border-[var(--line)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-slate-500">{resourceTypeLabel(resource.type)}</span>
                      <span className="text-xs font-bold uppercase text-slate-500">{resourceStatusLabel(resource.status)}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-black">{resource.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{resource.description}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      <strong>Использовать:</strong> {resource.usageInstructions}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Этап: {resource.salesStage || "—"} · ответственный: {resource.owner || "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resource.url ? (
                        <>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                          >
                            Открыть <ExternalLink size={14} />
                          </a>
                          <button
                            type="button"
                            onClick={() => void copyText(resource.url)}
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-bold"
                          >
                            Скопировать ссылку <Copy size={14} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-rose-700">Ссылка на инструмент недоступна</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showAdmin && payload.canEdit ? (
        <section className="card mt-4 p-5">
          <SectionHead title="Управление мотивацией" subtitle="Периоды, правила, обновления, инструменты и ручные корректировки." />
          {payload.canEdit ? (
            <div className="mb-4">
              <label className="text-sm text-slate-600">
                Смотреть как менеджер
                <select
                  className="ml-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  value={viewAsManagerId}
                  onChange={(e) => {
                    setViewAsManagerId(e.target.value);
                    void load(periodId, e.target.value);
                  }}
                >
                  <option value="">Авто</option>
                  {payload.managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] p-4">
              <h3 className="font-black">Период</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                  onClick={() =>
                    void adminAction({
                      action: "create_period",
                      month: period.month === 12 ? 1 : period.month + 1,
                      year: period.month === 12 ? period.year + 1 : period.year,
                      copyFromPeriodId: period.id
                    })
                  }
                >
                  Создать следующий месяц (копия)
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold"
                  onClick={() => void adminAction({ action: "set_period_status", periodId: period.id, status: "active" })}
                >
                  Опубликовать
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold"
                  onClick={() => void adminAction({ action: "set_period_status", periodId: period.id, status: "closed" })}
                >
                  Закрыть месяц
                </button>
              </div>
              {payload.isClosedForEditing ? (
                <p className="mt-2 text-xs text-amber-700">Период закрыт для обычного редактирования.</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-[var(--line)] p-4">
              <h3 className="font-black">Новое условие</h3>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Название"
                value={ruleForm.title}
                onChange={(e) => setRuleForm((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Описание"
                value={ruleForm.description}
                onChange={(e) => setRuleForm((p) => ({ ...p, description: e.target.value }))}
              />
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={ruleForm.rewardAmount}
                  onChange={(e) => setRuleForm((p) => ({ ...p, rewardAmount: Number(e.target.value) }))}
                />
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={ruleForm.targetValue}
                  onChange={(e) => setRuleForm((p) => ({ ...p, targetValue: Number(e.target.value) }))}
                />
              </div>
              <button
                type="button"
                className="mt-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white"
                onClick={() =>
                  void adminAction({
                    action: "upsert_rule",
                    rule: {
                      periodId: period.id,
                      title: ruleForm.title,
                      description: ruleForm.description,
                      rewardAmount: ruleForm.rewardAmount,
                      targetValue: ruleForm.targetValue,
                      ruleType: ruleForm.ruleType,
                      calculationConfig: {
                        metricKey: "average_items_per_order",
                        targetAverageItems: ruleForm.targetValue,
                        uniqueLineItems: true
                      }
                    }
                  })
                }
              >
                Добавить условие
              </button>
            </div>

            <div className="rounded-xl border border-[var(--line)] p-4">
              <h3 className="font-black">Публикация обновления</h3>
              <select
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                value={updateForm.category}
                onChange={(e) => setUpdateForm((p) => ({ ...p, category: e.target.value as MonthlyUpdateCategory }))}
              >
                {(
                  [
                    "new_tool",
                    "new_landing",
                    "new_product",
                    "price_change",
                    "new_script",
                    "new_promo",
                    "process_update",
                    "training",
                    "important"
                  ] as MonthlyUpdateCategory[]
                ).map((c) => (
                  <option key={c} value={c}>
                    {updateCategoryLabel(c)}
                  </option>
                ))}
              </select>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Заголовок"
                value={updateForm.title}
                onChange={(e) => setUpdateForm((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Короткое описание"
                value={updateForm.shortDescription}
                onChange={(e) => setUpdateForm((p) => ({ ...p, shortDescription: e.target.value }))}
              />
              <input
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Ссылка"
                value={updateForm.buttonUrl}
                onChange={(e) => setUpdateForm((p) => ({ ...p, buttonUrl: e.target.value }))}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                onClick={() =>
                  void adminAction({
                    action: "upsert_update",
                    update: {
                      periodId: period.id,
                      ...updateForm,
                      fullDescription: updateForm.fullDescription || updateForm.shortDescription,
                      status: "published",
                      isPinned: false,
                      priority: 60
                    }
                  })
                }
              >
                Опубликовать
              </button>
            </div>

            <div className="rounded-xl border border-[var(--line)] p-4">
              <h3 className="font-black">Инструмент / лендинг</h3>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Название"
                value={resourceForm.title}
                onChange={(e) => setResourceForm((p) => ({ ...p, title: e.target.value }))}
              />
              <select
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                value={resourceForm.type}
                onChange={(e) => setResourceForm((p) => ({ ...p, type: e.target.value as SalesResourceType }))}
              >
                {resourceTabs.filter((t) => t.id !== "all").map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="URL"
                value={resourceForm.url}
                onChange={(e) => setResourceForm((p) => ({ ...p, url: e.target.value }))}
              />
              <textarea
                className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Описание"
                value={resourceForm.description}
                onChange={(e) => setResourceForm((p) => ({ ...p, description: e.target.value }))}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                onClick={() =>
                  void adminAction({
                    action: "upsert_resource",
                    resource: { ...resourceForm, status: "active" }
                  })
                }
              >
                Добавить инструмент
              </button>
            </div>

            <div className="rounded-xl border border-[var(--line)] p-4 lg:col-span-2">
              <h3 className="font-black">Ручная корректировка показателя</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <select
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={adjustForm.managerId}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, managerId: e.target.value }))}
                >
                  <option value="">Менеджер</option>
                  {payload.managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={adjustForm.metricName}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, metricName: e.target.value }))}
                >
                  <option value="averageItemsPerOrder">Среднее наименований</option>
                  <option value="leadsCount">Лиды</option>
                  <option value="paidOrdersCount">Оплаченные заказы</option>
                  <option value="totalUniqueLineItems">Всего наименований</option>
                  <option value="salesAmount">Сумма оплат</option>
                  <option value="conversionToPaid">Конверсия</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={adjustForm.newValue}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, newValue: Number(e.target.value) }))}
                />
                <input
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  placeholder="Причина"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"
                onClick={() =>
                  void adminAction({
                    action: "adjust_metric",
                    periodId: period.id,
                    ...adjustForm
                  })
                }
              >
                Сохранить корректировку
              </button>
              {payload.adjustments.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {payload.adjustments.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      {a.createdAt.slice(0, 16)} · {a.metricName}: {String(a.oldValue)} → {String(a.newValue)} · {a.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-xl border border-[var(--line)] p-4 lg:col-span-2">
              <h3 className="font-black">Подтвердить победителя по отзывам</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {payload.managers.map((m) => {
                  const reviewRule = payload.rules.find((r) => r.calculationConfig.metricKey === "review_lead_ratio");
                  if (!reviewRule) return null;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold"
                      onClick={() =>
                        void adminAction({
                          action: "confirm_winner",
                          periodId: period.id,
                          ruleId: reviewRule.id,
                          managerId: m.id
                        })
                      }
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {adminStatus.message ? (
            <p className={`mt-3 text-sm ${adminStatus.state === "error" ? "text-rose-700" : "text-emerald-700"}`}>
              {adminStatus.message}
            </p>
          ) : null}
        </section>
      ) : null}

      {showReviewModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black">Добавить отзыв клиента</h3>
              <button type="button" onClick={() => setShowReviewModal(false)} aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>
            {(
              [
                ["customerName", "Клиент"],
                ["orderId", "Номер заказа"],
                ["orderUrl", "Ссылка на заказ"],
                ["reviewDate", "Дата отзыва"],
                ["screenshotUrl", "Ссылка на скриншот"],
                ["chatMessageUrl", "Ссылка на сообщение в чате"],
                ["managerComment", "Комментарий менеджера"]
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mb-2 block text-sm">
                {label}
                <input
                  type={key === "reviewDate" ? "date" : "text"}
                  className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2"
                  value={reviewForm[key]}
                  onChange={(e) => setReviewForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="mb-2 block text-sm">
              Текст отзыва
              <textarea
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2"
                rows={4}
                value={reviewForm.reviewText}
                onChange={(e) => setReviewForm((p) => ({ ...p, reviewText: e.target.value }))}
              />
            </label>
            <button
              type="button"
              disabled={reviewStatus.state === "loading"}
              onClick={() => void submitReview()}
              className="mt-2 w-full rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white"
            >
              {reviewStatus.state === "loading" ? "Отправляю..." : "Отправить на проверку"}
            </button>
            {reviewStatus.state === "error" ? <p className="mt-2 text-sm text-rose-700">{reviewStatus.message}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
