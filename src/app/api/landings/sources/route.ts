import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { readSessionCookie } from "@/lib/auth/session";
import { addContractorBook, listContractorBooks } from "@/lib/landings/contractor-books-store";
import { isContractorLandingTabTitle, parseContractorSpreadsheetId } from "@/lib/landings/contractor-books";
import { listSpreadsheetTabs } from "@/lib/google/sheets-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function requireMarketing(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessRoute(session.accessLevel, "/marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  const books = await listContractorBooks();
  return NextResponse.json({ ok: true, books }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = requireMarketing(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { url?: string; title?: string };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const spreadsheetId = parseContractorSpreadsheetId(url);
    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: "Вставьте ссылку на Google Таблицу подрядчика" }, { status: 400 });
    }

    const tabs = await listSpreadsheetTabs(spreadsheetId);
    const landingCount = tabs.filter((tab) => isContractorLandingTabTitle(tab.title)).length;
    if (landingCount === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "В этой таблице нет вкладок-лендингов. Нужен тот же формат, что у ALX: вкладка = URL лендинга (https://…)."
        },
        { status: 400 }
      );
    }

    const existing = (await listContractorBooks()).find((book) => book.spreadsheetId === spreadsheetId);
    const book =
      existing ??
      (await addContractorBook({
        url,
        title: typeof body.title === "string" ? body.title : ""
      }));

    return NextResponse.json({ ok: true, book, landingCount, alreadyConnected: Boolean(existing) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подключить таблицу";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
