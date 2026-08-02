import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { MotivationAccessError, requireMotivationManager, requireMotivationSession } from "@/lib/motivation/access";
import { getMotivationPagePayload, moderateReview, submitReview } from "@/lib/motivation/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireMotivationSession(readSessionCookie(request.headers.get("cookie")));
    const { searchParams } = new URL(request.url);
    const payload = await getMotivationPagePayload({
      session,
      periodId: searchParams.get("periodId")
    });
    return NextResponse.json(
      {
        myReviews: payload.myReviews,
        pendingReviews: payload.pendingReviews
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof MotivationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Не удалось загрузить отзывы";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = requireMotivationSession(readSessionCookie(request.headers.get("cookie")));
    const body = (await request.json()) as {
      action?: "submit" | "approve" | "reject" | "clarify";
      periodId?: string;
      reviewId?: string;
      customerName?: string;
      orderId?: string;
      orderUrl?: string;
      reviewDate?: string;
      reviewText?: string;
      screenshotUrl?: string;
      chatMessageUrl?: string;
      managerComment?: string;
      reason?: string;
    };

    if (body.action === "submit") {
      if (!body.periodId || !body.customerName || !body.orderId || !body.reviewDate || !body.reviewText) {
        return NextResponse.json({ error: "Заполните обязательные поля отзыва" }, { status: 400 });
      }
      const review = await submitReview({
        session,
        periodId: body.periodId,
        customerName: body.customerName,
        orderId: body.orderId,
        orderUrl: body.orderUrl,
        reviewDate: body.reviewDate,
        reviewText: body.reviewText,
        screenshotUrl: body.screenshotUrl,
        chatMessageUrl: body.chatMessageUrl,
        managerComment: body.managerComment
      });
      return NextResponse.json({ review });
    }

    requireMotivationManager(session);
    if (!body.reviewId || !body.action) {
      return NextResponse.json({ error: "Некорректный запрос модерации" }, { status: 400 });
    }
    if (body.action !== "approve" && body.action !== "reject" && body.action !== "clarify") {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const review = await moderateReview({
      session,
      reviewId: body.reviewId,
      action: body.action,
      reason: body.reason
    });
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof MotivationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Не удалось обработать отзыв";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
