import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import {
  getManagerQuestionsTelegramWebhookInfo,
  managerQuestionsWebhookUrl,
  registerManagerQuestionsTelegramWebhook,
  readTelegramBotToken
} from "@/lib/training/telegram-manager-questions";
import { isTrainingSupervisor } from "@/lib/training/supervisor-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveAppBaseUrl(request: Request): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "http://127.0.0.1:4174";
}

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!isTrainingSupervisor(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!readTelegramBotToken()) {
    return NextResponse.json(
      { error: "Не настроен TELEGRAM_MANAGER_QUESTIONS_BOT_TOKEN." },
      { status: 503 }
    );
  }

  try {
    const info = await getManagerQuestionsTelegramWebhookInfo();
    const expectedUrl = managerQuestionsWebhookUrl(resolveAppBaseUrl(request));
    return NextResponse.json({
      expectedUrl,
      webhook: info,
      connected: info.url === expectedUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!isTrainingSupervisor(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!readTelegramBotToken()) {
    return NextResponse.json(
      { error: "Не настроен TELEGRAM_MANAGER_QUESTIONS_BOT_TOKEN." },
      { status: 503 }
    );
  }

  try {
    const baseUrl = resolveAppBaseUrl(request);
    if (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) {
      return NextResponse.json(
        {
          error:
            "Webhook нельзя зарегистрировать на localhost. Укажите NEXT_PUBLIC_APP_URL=https://rp-bi.site или зарегистрируйте webhook на проде."
        },
        { status: 400 }
      );
    }

    const result = await registerManagerQuestionsTelegramWebhook(baseUrl);
    const info = await getManagerQuestionsTelegramWebhookInfo();
    return NextResponse.json({
      ok: true,
      ...result,
      webhook: info
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Не удалось зарегистрировать webhook: ${message}` }, { status: 500 });
  }
}
