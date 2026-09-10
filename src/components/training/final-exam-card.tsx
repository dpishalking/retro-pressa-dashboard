"use client";

import Link from "next/link";
import { ArrowRight, Lock, Trophy } from "lucide-react";
import { FINAL_EXAM_PRODUCT_ID, isOpenEndedQuiz } from "@/lib/training/final-exam";
import { getStatusClass, getStatusLabel } from "@/lib/training/quiz-scoring";
import type { ProductTrainingModule, TrainingStatus } from "@/types/training";

export function FinalExamStageCard({
  exam,
  index,
  status,
  bestScorePercent,
  remainingStageTitles
}: {
  exam: ProductTrainingModule;
  index: number;
  status: TrainingStatus;
  bestScorePercent?: number;
  remainingStageTitles: string[];
}) {
  const locked = remainingStageTitles.length > 0;
  const openEnded = isOpenEndedQuiz(exam);

  const body = (
    <article
      className={`card flex h-full flex-col p-6 ${
        locked ? "" : "border-amber-300 bg-amber-50/40 transition hover:-translate-y-0.5 hover:shadow-lg"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black ${
            locked ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"
          }`}
        >
          {locked ? <Lock size={18} /> : index}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusClass(status)}`}>
          {locked ? "Закрыт" : getStatusLabel(status)}
        </span>
      </div>
      <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
        {locked ? null : <Trophy size={18} className="text-amber-600" />}
        {exam.title}
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Вопросов</p>
          <p className="mt-1 text-lg font-black text-slate-950">{exam.questions.length}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {bestScorePercent === undefined
              ? openEnded
                ? "Формат"
                : "Проходной балл"
              : "Лучший результат"}
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {bestScorePercent === undefined
              ? openEnded
                ? "Своими словами"
                : `${exam.passingScore}%`
              : `${bestScorePercent}%`}
          </p>
        </div>
      </div>
      {locked ? (
        <p className="mt-5 text-sm leading-6 text-slate-600">
          Откроется, когда будут пройдены остальные этапы. Осталось: {remainingStageTitles.join(", ")}.
        </p>
      ) : (
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-amber-700">
          {status === "completed" ? "Пройти ещё раз" : "Пройти финальный тест"}
          <ArrowRight size={16} />
        </p>
      )}
    </article>
  );

  if (locked) return body;

  return (
    <Link href={`/training/products/${FINAL_EXAM_PRODUCT_ID}/quiz`} className="block h-full">
      {body}
    </Link>
  );
}
