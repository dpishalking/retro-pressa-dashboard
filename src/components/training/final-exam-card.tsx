"use client";

import Link from "next/link";
import { Lock, Trophy } from "lucide-react";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import type { ProductTrainingModule, TrainingStatus } from "@/types/training";

export function FinalExamCard({
  exam,
  status,
  bestScorePercent,
  attemptCount,
  remainingTitles,
  onStart
}: {
  exam: ProductTrainingModule;
  status: TrainingStatus;
  bestScorePercent?: number;
  attemptCount: number;
  remainingTitles: string[];
  onStart?: () => void;
}) {
  const locked = remainingTitles.length > 0;

  return (
    <section className={`card mb-6 p-6 ${locked ? "" : "border-amber-300 bg-amber-50/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-3 ${locked ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
            {locked ? <Lock size={22} /> : <Trophy size={22} />}
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-950">{exam.title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{exam.shortDescription}</p>
            <p className="mt-2 text-sm text-slate-500">
              Вопросов: {exam.questions.length} · проходной балл {exam.passingScore}%
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(status)}`}>
            {getStatusLabel(status)}
          </span>
          {attemptCount > 0 ? (
            <span className="text-xs font-semibold text-slate-500">
              Лучший результат: {bestScorePercent ?? 0}% · попыток {attemptCount}
            </span>
          ) : null}
          {locked ? (
            <span className="text-xs font-semibold text-slate-500">Осталось продуктов: {remainingTitles.length}</span>
          ) : (
            <Link
              href={`/training/products/${exam.id}`}
              onClick={onStart}
              className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700"
            >
              {status === "completed" ? "Пройти ещё раз" : "Пройти финальный тест"}
            </Link>
          )}
        </div>
      </div>
      {locked ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Финальный тест откроется, когда будут сданы все продукты. Не хватает: {remainingTitles.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
