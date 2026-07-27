import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { readSessionCookie } from "@/lib/auth/session";
import { convertPdfToIssuePages } from "@/lib/products/convert-pdf";
import { isValidSlug, slugifyTitle } from "@/lib/products/slug";
import { deleteProductIssue, issueExists, listProductIssues, publicViewPath, readProductManifest } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Large PDF + rasterization can take a while. */
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function requireProductsAccess(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return { error: unauthorized() as NextResponse };
  if (!canAccessRoute(session.accessLevel, "/products")) return { error: forbidden() as NextResponse };
  return { session };
}

export async function GET(request: Request) {
  const auth = requireProductsAccess(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim();
  if (slug) {
    const manifest = await readProductManifest(slug);
    if (!manifest) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ issue: manifest, viewPath: publicViewPath(manifest.slug) });
  }

  const issues = await listProductIssues();
  return NextResponse.json({ issues });
}

export async function POST(request: Request) {
  const auth = requireProductsAccess(request);
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать форму загрузки" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const slugRaw = String(form.get("slug") ?? "").trim();
  const file = form.get("file");

  if (!title) {
    return NextResponse.json({ error: "Укажите название выпуска" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Прикрепите PDF-файл" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Пустой файл" }, { status: 400 });
  }
  if (file.size > 120 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF больше 120 МБ" }, { status: 400 });
  }

  const slug = slugRaw ? slugRaw.toLowerCase() : slugifyTitle(title);
  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { error: "Slug: только латиница, цифры и дефис (2–64 символа)" },
      { status: 400 }
    );
  }

  if (await issueExists(slug)) {
    return NextResponse.json({ error: `Выпуск со slug «${slug}» уже есть` }, { status: 409 });
  }

  const pdfBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const { manifest } = await convertPdfToIssuePages({ slug, title, pdfBuffer });
    return NextResponse.json({
      ok: true,
      issue: manifest,
      viewPath: publicViewPath(manifest.slug)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка конвертации PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireProductsAccess(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase();
  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json({ error: "Некорректный slug" }, { status: 400 });
  }

  const removed = await deleteProductIssue(slug);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
