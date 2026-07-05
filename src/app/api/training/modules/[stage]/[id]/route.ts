import { NextResponse } from "next/server";
import { getTrackModule } from "@/lib/training/track-modules";
import type { TrackStageId } from "@/types/training";

type Params = { params: Promise<{ stage: string; id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { stage, id } = await params;
  if (stage !== "crm" && stage !== "practice") {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const module = await getTrackModule(stage as TrackStageId, id);
  if (!module) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ module });
}
