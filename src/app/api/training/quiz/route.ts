import { NextResponse } from "next/server";
import { getQuizAttempt, submitQuiz } from "@/lib/training/store";
import type { QuizSubmission } from "@/types/training";

export async function POST(request: Request) {
  const body = (await request.json()) as QuizSubmission;

  if (!body.productId || !body.userId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await submitQuiz(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submit failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const attemptId = searchParams.get("attemptId");

  if (!userId || !attemptId) {
    return NextResponse.json({ error: "userId and attemptId are required" }, { status: 400 });
  }

  const result = await getQuizAttempt(userId, attemptId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
