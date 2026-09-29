import { NextResponse } from "next/server";
import { buildQueueText, buildReportText } from "@/lib/smartdesk/telegram-report";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const command = body && typeof body === "object" ? (body as { command?: string }).command : "";
  if (command !== "queue" && command !== "report") {
    return NextResponse.json({ error: "Unknown command" }, { status: 400 });
  }

  try {
    const text = command === "queue" ? await buildQueueText() : await buildReportText();
    return NextResponse.json({ text });
  } catch (error) {
    console.error("SmartDesk export failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "SmartDesk unavailable" }, { status: 502 });
  }
}
