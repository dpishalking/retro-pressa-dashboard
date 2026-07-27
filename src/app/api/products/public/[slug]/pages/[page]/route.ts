import { NextResponse } from "next/server";
import { isValidSlug } from "@/lib/products/slug";
import { readIssuePageFile, readProductManifest } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; page: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: rawSlug, page: rawPage } = await context.params;
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  const pageToken = decodeURIComponent(rawPage).trim();

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pageMatch = pageToken.match(/^(\d{1,2})$/) || pageToken.match(/^page-(\d{2})$/i);
  if (!pageMatch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pageNum = Number(pageMatch[1]);
  if (!Number.isFinite(pageNum) || pageNum < 1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const manifest = await readProductManifest(slug);
  if (!manifest || pageNum > manifest.pageCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const file = `page-${String(pageNum).padStart(2, "0")}.webp`;
  const buffer = await readIssuePageFile(slug, file);
  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
