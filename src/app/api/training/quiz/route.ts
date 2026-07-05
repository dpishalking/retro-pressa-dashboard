import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { getQuizAttempt, submitQuiz } from "@/lib/training/store";
import { resolveProgressTargetUserId } from "@/lib/training/progress-auth";
import type { QuizSubmission } from "@/types/training";

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  const access = resolveProgressTargetUserId(session, session?.id);
  if ("error" in access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as QuizSubmission;

  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const hasProduct = Boolean(body.productId);
  const hasModule = Boolean(body.moduleId && body.stageId);
  if (!hasProduct && !hasModule) {
    return NextResponse.json({ error: "productId or moduleId+stageId required" }, { status: 400 });
  }

  try {
    const result = await submitQuiz({ ...body, userId: access.userId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submit failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  const { searchParams } = new URL(request.url);
  const attemptId = searchParams.get("attemptId");
  const access = resolveProgressTargetUserId(session, searchParams.get("userId"));

  if ("error" in access) {
    if (access.error === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (access.error === "missing") {
      return NextResponse.json({ error: "userId and attemptId are required" }, { status: 400 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!attemptId) {
    return NextResponse.json({ error: "userId and attemptId are required" }, { status: 400 });
  }

  const result = await getQuizAttempt(access.userId, attemptId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
