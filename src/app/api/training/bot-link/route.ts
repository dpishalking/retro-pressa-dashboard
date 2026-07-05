import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/store";
import { buildFallbackBotLink, ensureTrainerBotLink } from "@/lib/training/trainer-api";

const TRAINER_API_URL = (
  process.env.TRAINER_API_URL ??
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:3100" : "http://localhost:3100")
).replace(/\/$/, "");

function trainerErrorMessage(): string {
  if (TRAINER_API_URL.includes("localhost") || TRAINER_API_URL.includes("127.0.0.1")) {
    return "Сервис тренажёра не запущен на сервере. Администратору нужно задеплоить gift-ai backend (порт 3100).";
  }
  return `Не удалось связаться с API тренажёра (${TRAINER_API_URL}). Проверьте TRAINER_API_URL и доступность сервиса.`;
}

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserById(session.id);
  if (!user?.active) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const link = await ensureTrainerBotLink({ id: user.id, name: user.name });
  if (!link) {
    return NextResponse.json(
      {
        error: trainerErrorMessage(),
        fallbackBotLink: buildFallbackBotLink(),
      },
      { status: 503 },
    );
  }

  return NextResponse.json(link);
}
