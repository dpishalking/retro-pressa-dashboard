import { NextResponse } from "next/server";
import { rejectUnlessCronOrStaff } from "@/lib/auth/cron-auth";
import { syncManagerQaSample } from "@/lib/manager-qa-sample/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Weekly manager-dialog sample for a manual QA checklist. Sunday 20:00 Moscow. */
export async function POST(request: Request) {
  const denied = rejectUnlessCronOrStaff(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      spreadsheetId?: string;
      weekOf?: string;
      dryRun?: boolean;
    };
    const result = await syncManagerQaSample({
      spreadsheetId: body.spreadsheetId,
      weekOf: body.weekOf,
      dryRun: body.dryRun === true
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать выборку диалогов";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
