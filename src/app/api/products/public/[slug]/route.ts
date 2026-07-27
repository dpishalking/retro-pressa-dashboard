import { NextResponse } from "next/server";
import { isValidSlug } from "@/lib/products/slug";
import { publicViewPath, readProductManifest } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const manifest = await readProductManifest(slug);
  if (!manifest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    issue: {
      slug: manifest.slug,
      title: manifest.title,
      pageCount: manifest.pageCount,
      pageWidth: manifest.pageWidth,
      pageHeight: manifest.pageHeight,
      pages: manifest.pages.map((page) => ({ page: page.page, src: page.src }))
    },
    viewPath: publicViewPath(manifest.slug)
  });
}
