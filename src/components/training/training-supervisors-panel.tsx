"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import type { ManagerTrainingReport, TrainingStatus } from "@/types/training";

function formatWhen(value?: string) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy, HH:mm", { locale: ru });
}

function StageSummaryCard({
  title,
  completed,
  total,
  percent
}: {
  title: string;
  completed: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{percent}%</p>
      <p className="mt-1 text-sm text-slate-600">
        {completed} / {total} модулей
      </p>
    </div>
  );
}

function ModuleTable({
  title,
  rows
}: {
  title: string;
  rows: {
    title: string;
    status: TrainingStatus;
    bestScorePercent?: number;
    attemptCount: number;
    lastAttemptAt?: string;
    startedAt?: string;
    completedAt?: string;
  }[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-base font-black text-slate-950">{title}</h3>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Модуль</th>
              <th>Статус</th>
              <th>Лучший балл</th>
              <th>Попытки</th>
              <th>Активность</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-slate-600">
                  Нет данных. Стажёр должен открыть бота по персональной ссылке из этапа «Практика» (не через обычный /start).
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.title}>
                  <td className="max-w-xs whitespace-normal font-semibold text-slate-900">{row.title}</td>
                  <td>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(row.status)}`}>
                      {getStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>{row.bestScorePercent !== undefined ? `${row.bestScorePercent}%` : "—"}</td>
                  <td>{row.attemptCount ?? "—"}</td>
                  <td>{formatWhen(row.lastAttemptAt ?? row.completedAt ?? row.startedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBotLinkHint(report: ManagerTrainingReport): string {
  const status = report.botLinkStatus;
  if (!status) {
    return "Ролевок пока нет. Стажёр должен зайти в бота по персональной ссылке «Открыть тренажёр в Telegram» на этапе «Практика» — иначе результаты не привяжутся к аккаунту.";
  }
  if (status.sessionsFetchError?.includes("TRAINER_ADMIN_API_KEY")) {
    return "Кабинет не может запросить ролевки: на сервере не настроен TRAINER_ADMIN_API_KEY.";
  }
  if (status.sessionsFetchStatus === 401) {
    return "Кабинет не может запросить ролевки: неверный ключ доступа к trainer-backend (TRAINER_ADMIN_API_KEY).";
  }
  if (status.sessionCount > 0 && report.botScenarios.length === 0) {
    return `На trainer-backend найдено ${status.sessionCount} ролевок, но кабинет их не получил. Обновите страницу или сообщите администратору.`;
  }
  if (status.linkedTelegramUsers === 0) {
    return "Telegram не привязан к этому аккаунту. Стажёр должен открыть бота по персональной ссылке с этапа «Практика» и дождаться сообщения «Аккаунт привязан».";
  }
  if (status.sessionCount === 0) {
    return "Telegram привязан, но ролевок на сервере пока нет. Стажёр должен пройти ролевку в боте после привязки.";
  }
  return "Ролевок пока нет. Стажёр должен зайти в бота по персональной ссылке «Открыть тренажёр в Telegram» на этапе «Практика».";
}

function ManagerDetail({ report }: { report: ManagerTrainingReport }) {
  const productsStage = report.overview.stages.find((stage) => stage.id === "products");
  const crmStage = report.overview.stages.find((stage) => stage.id === "crm");
  const practiceStage = report.overview.stages.find((stage) => stage.id === "practice");
  const completedBotScenarios = report.botScenarios.filter((item) => item.status === "completed").length;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{report.user.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Логин: {report.user.login} · {report.user.active ? "активен" : "отключён"}
            </p>
            <p className="mt-2 text-sm text-slate-500">Последняя активность: {formatWhen(report.lastActivityAt)}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-6 py-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Общий прогресс</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{report.overview.totalStagesPercent}%</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StageSummaryCard
          title="Этап 1. Продукт"
          completed={productsStage?.completedModules ?? 0}
          total={productsStage?.totalModules ?? 0}
          percent={productsStage?.percent ?? 0}
        />
        <StageSummaryCard
          title="CRM + Архив изданий"
          completed={crmStage?.completedModules ?? 0}
          total={crmStage?.totalModules ?? 0}
          percent={crmStage?.percent ?? 0}
        />
        <StageSummaryCard
          title="Этап 3. Практика"
          completed={practiceStage?.completedModules ?? 0}
          total={practiceStage?.totalModules ?? 0}
          percent={practiceStage?.percent ?? 0}
        />
        <StageSummaryCard
          title="Тренировочный бот"
          completed={completedBotScenarios}
          total={report.botScenarios.length}
          percent={report.botScenarios.length ? Math.round((completedBotScenarios / report.botScenarios.length) * 100) : 0}
        />
      </section>

      <ModuleTable
        title="Продукты"
        rows={report.products.map((item) => ({
          title: item.title,
          status: item.status,
          bestScorePercent: item.bestScorePercent,
          attemptCount: item.attemptCount,
          lastAttemptAt: item.lastAttemptAt
        }))}
      />

      <ModuleTable
        title="CRM / Bitrix24"
        rows={report.crmModules.map((item) => ({
          title: item.title,
          status: item.status,
          bestScorePercent: item.bestScorePercent,
          attemptCount: item.attemptCount,
          lastAttemptAt: item.lastAttemptAt
        }))}
      />

      <ModuleTable
        title="Тренировочный бот в Telegram"
        rows={report.botScenarios.map((item) => ({
          title: item.title,
          status: item.status,
          bestScorePercent: item.bestScorePercent,
          attemptCount: item.attemptCount,
          lastAttemptAt: item.lastAttemptAt ?? item.completedAt ?? item.startedAt
        }))}
      />
      {report.botScenarios.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {formatBotLinkHint(report)}
        </p>
      ) : null}
    </div>
  );
}

export function TrainingSupervisorsPanel() {
  const [reports, setReports] = useState<ManagerTrainingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/training/supervisors/reports")
      .then((response) => response.json())
      .then((data: { reports?: ManagerTrainingReport[]; error?: string }) => {
        if (!Array.isArray(data.reports)) {
          throw new Error(data.error ?? "Не удалось загрузить статистику");
        }
        setReports(data.reports);
        setSelectedUserId((current) => current ?? data.reports?.[0]?.user.id ?? null);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки");
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedReport = useMemo(
    () => reports.find((report) => report.user.id === selectedUserId) ?? null,
    [reports, selectedUserId]
  );

  if (loading) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка статистики стажёров...</div>;
  }

  if (error) {
    return <div className="card p-8 text-sm text-red-700">{error}</div>;
  }

  if (reports.length === 0) {
    return (
      <div className="card p-8 text-sm text-slate-600">
        Пока нет менеджеров с уровнем доступа «Менеджер».{" "}
        <Link href="/admin/users" className="font-bold text-violet-700 hover:text-violet-900">
          Создайте аккаунты в разделе «Менеджеры»
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      <aside className="card h-fit overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-sm font-black text-slate-950">Стажёры</h2>
        </div>
        <ul>
          {reports.map((report) => {
            const active = report.user.id === selectedUserId;
            return (
              <li key={report.user.id} className="border-b border-[var(--line)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedUserId(report.user.id)}
                  className={`flex w-full flex-col items-start px-4 py-3 text-left transition ${
                    active ? "bg-violet-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="font-bold text-slate-950">{report.user.name}</span>
                  <span className="text-xs text-slate-500">{report.user.login}</span>
                  <span className="mt-2 text-xs font-semibold text-violet-700">{report.overview.totalStagesPercent}% готово</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div>{selectedReport ? <ManagerDetail report={selectedReport} /> : null}</div>
    </div>
  );
}
