"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import type { QuizSubmission, TrackStageId, TrainingTrackModule } from "@/types/training";

type AnswerState = {
  selectedAnswerIds: string[];
  textAnswer: string;
};

function TrackQuizFormContent({ stageId, moduleId }: { stageId: TrackStageId; moduleId: string }) {
  const router = useRouter();
  const { user } = useTrainingUser();
  const [module, setModule] = useState<TrainingTrackModule | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/training/modules/${stageId}/${moduleId}`)
      .then((response) => response.json())
      .then((data: { module: TrainingTrackModule }) => {
        setModule(data.module);
        const initial: Record<string, AnswerState> = {};
        data.module.questions.forEach((question) => {
          initial[question.id] = { selectedAnswerIds: [], textAnswer: "" };
        });
        setAnswers(initial);
      })
      .finally(() => setLoading(false));
  }, [moduleId, stageId]);

  const toggleAnswer = (
    questionId: string,
    answerId: string,
    type: TrainingTrackModule["questions"][number]["type"]
  ) => {
    setAnswers((current) => {
      const existing = current[questionId] ?? { selectedAnswerIds: [], textAnswer: "" };
      if (type === "single") {
        return { ...current, [questionId]: { ...existing, selectedAnswerIds: [answerId] } };
      }
      const selected = new Set(existing.selectedAnswerIds);
      if (selected.has(answerId)) selected.delete(answerId);
      else selected.add(answerId);
      return { ...current, [questionId]: { ...existing, selectedAnswerIds: [...selected] } };
    });
  };

  const submit = async () => {
    if (!user || !module) return;
    setSubmitting(true);
    setError("");

    const payload: QuizSubmission = {
      moduleId: module.id,
      stageId,
      userId: user.id,
      answers: module.questions.map((question) => ({
        questionId: question.id,
        selectedAnswerIds: answers[question.id]?.selectedAnswerIds,
        textAnswer: answers[question.id]?.textAnswer
      }))
    };

    const response = await fetch("/api/training/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Не удалось отправить тест");
      return;
    }

    router.push(`/training/${stageId}/${module.id}/quiz/results?attemptId=${data.attempt.id}`);
  };

  if (loading || !module) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка теста...</div>;
  }

  if (!module.questions.length) {
    return (
      <div className="card p-8">
        <p className="text-sm text-slate-600">Для этого модуля пока нет вопросов.</p>
        <Link href={`/training/${stageId}/${module.id}`} className="mt-4 inline-block text-sm font-bold text-blue-600">
          Вернуться к материалам
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="text-2xl font-black text-slate-950">{module.title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Ответьте на все вопросы. Для прохождения нужно набрать минимум {module.passingScore}%.
        </p>
      </section>

      {module.questions
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((question, index) => (
          <section key={question.id} className="card p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Вопрос {index + 1}</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">{question.text}</h3>

            {question.type === "text" ? (
              <textarea
                className="mt-4 min-h-28 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-slate-800"
                placeholder="Введите развёрнутый ответ"
                value={answers[question.id]?.textAnswer ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: { ...(current[question.id] ?? { selectedAnswerIds: [] }), textAnswer: event.target.value }
                  }))
                }
              />
            ) : (
              <div className="mt-4 space-y-2">
                {question.answers.map((answer) => {
                  const selected = answers[question.id]?.selectedAnswerIds.includes(answer.id);
                  return (
                    <label
                      key={answer.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                        selected ? "border-blue-500 bg-blue-50" : "border-[var(--line)] hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type={question.type === "single" ? "radio" : "checkbox"}
                        name={question.id}
                        checked={selected}
                        onChange={() => toggleAnswer(question.id, answer.id, question.type)}
                      />
                      <span className="text-slate-800">{answer.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        ))}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      <section className="card p-6">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Отправка..." : "Завершить тест"}
        </button>
      </section>
    </div>
  );
}

export function TrackQuizForm({ stageId, moduleId }: { stageId: TrackStageId; moduleId: string }) {
  return (
    <TrainingLayout
      title="Тест модуля"
      backHref={`/training/${stageId}/${moduleId}`}
      backLabel="К материалам модуля"
    >
      <TrackQuizFormContent stageId={stageId} moduleId={moduleId} />
    </TrainingLayout>
  );
}
