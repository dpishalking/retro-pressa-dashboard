import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { htmlToPdfBuffer } from "@/lib/shift-feedback/html-to-pdf";
import { pdfFileName, renderManagerPdfHtml } from "@/lib/shift-feedback/render-html";
import { readShiftFeedback } from "@/lib/shift-feedback/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function requireRopSession(cookieHeader: string | null) {
  const session = readSessionCookie(cookieHeader);
  if (!session) {
    return { error: NextResponse.json({ error: "Нужна авторизация" }, { status: 401 }) };
  }
  if (session.accessLevel !== "admin" && session.accessLevel !== "rop") {
    return { error: NextResponse.json({ error: "Раздел только для РОП и админа" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireRopSession(request.headers.get("cookie"));
    if (auth.error) return auth.error;

    const day = request.nextUrl.searchParams.get("day");
    const managerId = request.nextUrl.searchParams.get("manager")?.trim();
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !managerId) {
      return NextResponse.json({ error: "Нужны day=YYYY-MM-DD и manager" }, { status: 400 });
    }

    const report = await readShiftFeedback(day);
    if (!report) {
      return NextResponse.json({ error: "Среза за этот день ещё нет" }, { status: 404 });
    }

    const page = [...report.managers, ...report.offShift].find((row) => row.bitrixUserId === managerId);
    if (!page) {
      return NextResponse.json({ error: "Этого менеджера нет в срезе смены" }, { status: 404 });
    }

    const html = renderManagerPdfHtml(report, page);
    const filename = pdfFileName(report.day, page.name);
    const pdf = htmlToPdfBuffer(html);
    if (pdf) {
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="smena-${day}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`
        }
      });
    }

    return NextResponse.redirect(new URL(`/rop/shift/${day}/pdf/${encodeURIComponent(managerId)}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
