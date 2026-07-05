import type { QuizAttemptAnswer, QuizQuestion, QuizSubmission, UserQuizAttempt } from "@/types/training";
import type { QuizScorable } from "@/lib/training/progress";
import { generateId } from "@/lib/training/id";

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeQuestion(
  question: QuizQuestion,
  submission: QuizSubmission["answers"][number]
): QuizAttemptAnswer {
  const correctIds = question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id);
  const selected = submission.selectedAnswerIds ?? [];

  if (question.type === "text") {
    const expected = question.answers.find((answer) => answer.isCorrect)?.text ?? "";
    const userText = submission.textAnswer ?? "";
    const isCorrect = expected
      ? normalizeText(userText).includes(normalizeText(expected)) || normalizeText(expected).includes(normalizeText(userText))
      : userText.trim().length >= 10;

    return {
      questionId: question.id,
      textAnswer: userText,
      isCorrect
    };
  }

  if (question.type === "single") {
    const isCorrect = selected.length === 1 && correctIds.length === 1 && selected[0] === correctIds[0];
    return {
      questionId: question.id,
      selectedAnswerIds: selected,
      isCorrect
    };
  }

  const selectedSet = new Set(selected);
  const correctSet = new Set(correctIds);
  const isCorrect =
    selectedSet.size === correctSet.size && [...correctSet].every((id) => selectedSet.has(id));

  return {
    questionId: question.id,
    selectedAnswerIds: selected,
    isCorrect
  };
}

export function scoreQuizSubmission(host: QuizScorable, submission: QuizSubmission) {
  const gradedAnswers = host.questions.map((question) => {
    const answer = submission.answers.find((item) => item.questionId === question.id);
    return gradeQuestion(question, answer ?? { questionId: question.id });
  });

  const correctCount = gradedAnswers.filter((answer) => answer.isCorrect).length;
  const totalCount = host.questions.length || 1;
  const scorePercent = Math.round((correctCount / totalCount) * 100);
  const passed = scorePercent >= host.passingScore;

  const attempt: UserQuizAttempt = {
    id: generateId("attempt"),
    userId: submission.userId,
    productId: submission.productId,
    moduleId: submission.moduleId,
    stageId: submission.stageId,
    answers: gradedAnswers,
    scorePercent,
    passed,
    attemptedAt: new Date().toISOString()
  };

  return { attempt, gradedAnswers };
}

export function getStatusLabel(status: "not_started" | "in_progress" | "completed") {
  switch (status) {
    case "completed":
      return "Пройден";
    case "in_progress":
      return "В процессе";
    default:
      return "Не начат";
  }
}

export function getStatusClass(status: "not_started" | "in_progress" | "completed") {
  switch (status) {
    case "completed":
      return "status-green";
    case "in_progress":
      return "status-orange";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
