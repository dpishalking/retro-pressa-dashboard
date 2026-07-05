import { NextResponse } from "next/server";
import {
  getOrCreateUserProgress,
  getTrainingOverview,
  listAllManagerProgress,
  markModuleStarted,
  markProductStarted
} from "@/lib/training/store";
import type { TrackStageId } from "@/types/training";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const all = searchParams.get("all");

  if (all === "true") {
    const rows = await listAllManagerProgress();
    return NextResponse.json({ rows });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const [progress, overview] = await Promise.all([
    getOrCreateUserProgress(userId),
    getTrainingOverview(userId)
  ]);

  return NextResponse.json({ progress, overview });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string;
    productId?: string;
    moduleId?: string;
    stageId?: TrackStageId;
    action?: string;
  };

  if (!body.userId || body.action !== "start") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.moduleId && body.stageId && (body.stageId === "crm" || body.stageId === "practice")) {
    const progress = await markModuleStarted(body.userId, body.stageId, body.moduleId);
    const overview = await getTrainingOverview(body.userId);
    return NextResponse.json({ progress, overview });
  }

  if (!body.productId) {
    return NextResponse.json({ error: "productId or moduleId required" }, { status: 400 });
  }

  const progress = await markProductStarted(body.userId, body.productId);
  const overview = await getTrainingOverview(body.userId);
  return NextResponse.json({ progress, overview });
}
