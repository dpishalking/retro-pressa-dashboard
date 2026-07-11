import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { promoteManagerQuestionToKnowledgeBase } from "@/lib/training/manager-questions";
import { isTrainingSupervisor } from "@/lib/training/supervisor-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!isTrainingSupervisor(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      questionId?: string;
      answer?: string;
      category?: string;
    };

    if (!body.questionId?.trim()) {
      return NextResponse.json({ error: "Поле questionId обязательно." }, { status: 400 });
    }

    const result = await promoteManagerQuestionToKnowledgeBase({
      questionId: body.questionId.trim(),
      answer: body.answer ?? "",
      category: body.category
    });

    return NextResponse.json({
      question: result.question,
      entry: result.entry
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Question not found" ? 404 : message === "Answer is required" ? 400 : 500;
    return NextResponse.json({ error: `Не удалось добавить в базу знаний: ${message}` }, { status });
  }
}
