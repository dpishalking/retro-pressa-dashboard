import { NextResponse } from "next/server";
import { listTrackModules } from "@/lib/training/track-modules";
import type { TrackStageId } from "@/types/training";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage") as TrackStageId | null;

  if (stage !== "crm" && stage !== "practice") {
    return NextResponse.json({ error: "stage must be crm or practice" }, { status: 400 });
  }

  const modules = await listTrackModules(stage);
  return NextResponse.json({ modules });
}
