import { NextResponse } from "next/server";
import { syncGoogleTraffic } from "@/lib/google/traffic-connector";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const payload = await syncGoogleTraffic();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Sheets sync error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
