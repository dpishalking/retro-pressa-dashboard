import { NextResponse } from "next/server";
import { collectManagerQuestion, looksLikeQuestion } from "@/lib/training/manager-questions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Приём вопросов от Telegram-бота. Публичный маршрут (бот без сессии),
 * поэтому защищён общим токеном MANAGER_QUESTIONS_BOT_TOKEN.
 */
export async function POST(request: Request) {
  const expectedToken = process.env.MANAGER_QUESTIONS_BOT_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json(
      { error: "Сбор вопросов не настроен: отсутствует MANAGER_QUESTIONS_BOT_TOKEN." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-bot-token")?.trim();
  if (!provided || provided !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      authorName?: string;
      authorId?: string;
      chatId?: string;
      messageId?: string;
    };

    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "Поле text обязательно." }, { status: 400 });
    }

    if (!looksLikeQuestion(text)) {
      return NextResponse.json({ collected: false, reason: "not_a_question" });
    }

    const result = await collectManagerQuestion({
      source: "telegram",
      text,
      authorName: body.authorName,
      authorId: body.authorId,
      chatId: body.chatId,
      messageId: body.messageId
    });

    return NextResponse.json({
      collected: true,
      deduplicated: result.deduplicated,
      question: result.question
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Не удалось сохранить вопрос: ${message}` }, { status: 500 });
  }
}
