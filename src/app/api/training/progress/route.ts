import { NextResponse } from "next/server";
import {
  getOrCreateUserProgress,
  getTrainingOverview,
  listAllManagerProgress,
  markBotScenarioCompleted,
  markBotScenarioStarted,
  markModuleStarted,
  markProductStarted
} from "@/lib/training/store";
import { isTrainingSupervisor } from "@/lib/training/supervisor-auth";
import { readSessionCookie } from "@/lib/auth/session";
import type { TrackStageId } from "@/types/training";

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const all = searchParams.get("all");

  if (all === "true") {
    if (!isTrainingSupervisor(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await listAllManagerProgress();
    return NextResponse.json({ rows });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (session?.id !== userId && !isTrainingSupervisor(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [progress, overview] = await Promise.all([
    getOrCreateUserProgress(userId),
    getTrainingOverview(userId)
  ]);

  return NextResponse.json({ progress, overview });
}

export async function POST(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  const body = (await request.json()) as {
    userId?: string;
    productId?: string;
    moduleId?: string;
    scenarioId?: string;
    stageId?: TrackStageId;
    action?: string;
  };

  if (!body.userId || !body.action) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (session?.id !== body.userId && !isTrainingSupervisor(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "start_bot_scenario" && body.scenarioId) {
    const progress = await markBotScenarioStarted(body.userId, body.scenarioId);
    const overview = await getTrainingOverview(body.userId);
    return NextResponse.json({ progress, overview });
  }

  if (body.action === "complete_bot_scenario" && body.scenarioId) {
    const progress = await markBotScenarioCompleted(body.userId, body.scenarioId);
    const overview = await getTrainingOverview(body.userId);
    return NextResponse.json({ progress, overview });
  }

  if (body.action !== "start") {
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
