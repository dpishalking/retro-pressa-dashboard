import { NextResponse } from "next/server";
import { readTrainingAdminSession } from "@/lib/training/admin-auth";
import { readClientReviewCatalog, saveClientReviewCatalog } from "@/lib/training/client-review-videos";
import type { TrainingClientReviewCatalog } from "@/types/training";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {})
    }
  });
}

export async function GET() {
  const catalog = await readClientReviewCatalog();
  return noStoreJson({ catalog });
}

export async function PUT(request: Request) {
  const session = readTrainingAdminSession(request);
  if (!session) {
    return noStoreJson({ error: "Только администратор может редактировать отзывы." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Partial<TrainingClientReviewCatalog>;
    const catalog = await saveClientReviewCatalog(body);
    return noStoreJson({ catalog });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return noStoreJson({ error: `Не удалось сохранить отзывы: ${message}` }, { status: 500 });
  }
}
