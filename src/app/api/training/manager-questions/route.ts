import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { isTrainingSupervisor } from "@/lib/training/supervisor-auth";
import { readManagerQuestions, summarizeManagerQuestions, updateManagerQuestion } from "@/lib/training/manager-questions";
import type { ManagerQuestionStatus } from "@/types/training";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {})
    }
  });
}

const VALID_STATUSES: ManagerQuestionStatus[] = ["new", "clustered", "answered", "ignored"];

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!isTrainingSupervisor(session)) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 });
  }

  const store = await readManagerQuestions();

  if (new URL(request.url).searchParams.get("view") === "summary") {
    const summary = summarizeManagerQuestions(store);
    return noStoreJson({ summary });
  }

  const questions = [...store.questions].sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });

  return noStoreJson({ questions });
}

export async function PATCH(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!isTrainingSupervisor(session)) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      status?: ManagerQuestionStatus;
      category?: string;
    };

    if (!body.id?.trim()) {
      return noStoreJson({ error: "Поле id обязательно." }, { status: 400 });
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return noStoreJson({ error: "Некорректный статус." }, { status: 400 });
    }

    const question = await updateManagerQuestion(body.id.trim(), {
      status: body.status,
      category: body.category
    });

    if (!question) {
      return noStoreJson({ error: "Вопрос не найден." }, { status: 404 });
    }

    return noStoreJson({ question });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return noStoreJson({ error: `Не удалось обновить вопрос: ${message}` }, { status: 500 });
  }
}
