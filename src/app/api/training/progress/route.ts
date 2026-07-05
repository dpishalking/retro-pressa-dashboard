import { NextResponse } from "next/server";
import {
  getOrCreateUserProgress,
  getTrainingOverview,
  listAllManagerProgress,
  markProductStarted
} from "@/lib/training/store";

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
  const body = (await request.json()) as { userId?: string; productId?: string; action?: string };

  if (!body.userId || !body.productId || body.action !== "start") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const progress = await markProductStarted(body.userId, body.productId);
  const overview = await getTrainingOverview(body.userId);
  return NextResponse.json({ progress, overview });
}
