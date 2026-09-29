import { NextResponse } from "next/server";
import { buildQueueText, buildReportText, type ReportPart } from "@/lib/smartdesk/telegram-report";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const command = body && typeof body === "object" ? (body as { command?: string }).command : "";
  const part: ReportPart | null =
    command === "managers" || command === "inboxes" || command === "report" ? (command === "report" ? "summary" : command) : null;
  if (command !== "queue" && !part) {
    return NextResponse.json({ error: "Unknown command" }, { status: 400 });
  }

  try {
    const text = command === "queue" ? await buildQueueText() : await buildReportText(Date.now(), part ?? "summary");
    return NextResponse.json({ text });
  } catch (error) {
    console.error("SmartDesk export failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "SmartDesk unavailable" }, { status: 502 });
  }
}
