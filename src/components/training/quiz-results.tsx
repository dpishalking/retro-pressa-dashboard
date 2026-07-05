"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import type { ProductTrainingModule, QuizAttemptAnswer, QuizQuestion, UserQuizAttempt } from "@/types/training";

type ResultData = {
  attempt: UserQuizAttempt;
  product: ProductTrainingModule;
  questions: { question: QuizQuestion; userAnswer: QuizAttemptAnswer }[];
};

function answerLabel(question: QuizQuestion, userAnswer?: QuizAttemptAnswer) {
  if (!userAnswer) return "—";
  if (question.type === "text") return userAnswer.textAnswer || "—";

  const selected = question.answers.filter((answer) => userAnswer.selectedAnswerIds?.includes(answer.id));
  return selected.map((answer) => answer.text).join(", ") || "—";
}

function correctLabel(question: QuizQuestion) {
  if (question.type === "text") {
    return question.answers.find((answer) => answer.isCorrect)?.text ?? "Развёрнутый ответ";
  }
  return question.answers
    .filter((answer) => answer.isCorrect)
    .map((answer) => answer.text)
    .join(", ");
}

function isResultData(payload: unknown): payload is ResultData {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Partial<ResultData>;
  return Boolean(value.attempt && value.product && Array.isArray(value.questions));
}

function QuizResultsContent({ productId, attemptId }: { productId: string; attemptId: string }) {
  const { user, loading: userLoading } = useTrainingUser();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setLoading(false);
      setError("Сессия не найдена. Войдите в аккаунт и откройте результаты снова.");
      return;
    }

    if (!attemptId) {
      setLoading(false);
      setError("Не указан номер попытки.");
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/training/quiz?userId=${encodeURIComponent(user.id)}&attemptId=${encodeURIComponent(attemptId)}`, {
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = (await response.json()) as ResultData & { error?: string };
        if (!response.ok || !isResultData(payload)) {
          throw new Error(payload.error ?? "Не удалось загрузить результаты теста");
        }
        setData(payload);
      })
      .catch((loadError) => {
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить результаты теста");
      })
      .finally(() => setLoading(false));
  }, [attemptId, user, userLoading]);

  if (loading || userLoading) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка результатов...</div>;
  }

  if (error || !data) {
    return (
      <div className="card space-y-4 p-8">
        <p className="text-sm font-semibold text-red-600">{error ?? "Результаты не найдены."}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/training/products/${productId}/quiz`}
            className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Пройти тест снова
          </Link>
          <Link
            href="/training/products"
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            К списку продуктов
          </Link>
        </div>
      </div>
    );
  }

  const correctCount = data.attempt.answers.filter((answer) => answer.isCorrect).length;

  return (
    <div className="space-y-4">
      <section className={`card p-6 ${data.attempt.passed ? "border-emerald-200" : "border-amber-200"}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Результат теста</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">{data.attempt.scorePercent}%</h2>
        <p className="mt-2 text-sm text-slate-600">
          Правильных ответов: {correctCount} из {data.questions.length}. Проходной балл: {data.product.passingScore}%.
        </p>
        <span
          className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            data.attempt.passed ? "status-green" : "status-red"
          }`}
        >
          {data.attempt.passed ? "Тест пройден" : "Тест не пройден"}
        </span>
      </section>

      <section className="space-y-3">
        {data.questions.map(({ question, userAnswer }, index) => (
          <article key={question.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Вопрос {index + 1}</p>
                <h3 className="mt-1 text-base font-black text-slate-950">{question.text}</h3>
              </div>
              {userAnswer?.isCorrect ? (
                <CheckCircle2 className="shrink-0 text-emerald-600" size={20} />
              ) : (
                <XCircle className="shrink-0 text-red-500" size={20} />
              )}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ваш ответ</p>
                <p className="mt-1 text-sm text-slate-800">{answerLabel(question, userAnswer)}</p>
              </div>
              {!userAnswer?.isCorrect ? (
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Правильный ответ</p>
                  <p className="mt-1 text-sm text-emerald-900">{correctLabel(question)}</p>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={`/training/products/${productId}/quiz`}
          className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Пройти ещё раз
        </Link>
        <Link
          href="/training/products"
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
        >
          К списку продуктов
        </Link>
      </section>
    </div>
  );
}

export function QuizResults({ productId, attemptId }: { productId: string; attemptId: string }) {
  return (
    <TrainingLayout
      title="Результаты теста"
      backHref={`/training/products/${productId}`}
      backLabel="К материалам продукта"
    >
      <QuizResultsContent productId={productId} attemptId={attemptId} />
    </TrainingLayout>
  );
}
