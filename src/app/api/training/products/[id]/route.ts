import { NextResponse } from "next/server";
import { readTrainingAdminSession } from "@/lib/training/admin-auth";
import { deleteProduct, getProduct, updateProduct } from "@/lib/training/store";
import { normalizeProductMaterials } from "@/lib/training/video-embed";
import type { ProductTrainingModule } from "@/types/training";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {})
    }
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const raw = new URL(request.url).searchParams.get("raw") === "1";
  const product = await getProduct(id, { raw });
  if (!product) return noStoreJson({ error: "Not found" }, { status: 404 });
  return noStoreJson({ product });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = readTrainingAdminSession(request);
  if (!session) {
    return noStoreJson({ error: "Только администратор может редактировать продукты." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Partial<ProductTrainingModule>;
    const product = await updateProduct(id, {
      ...body,
      materials: body.materials ? normalizeProductMaterials(body.materials) : undefined
    });

    if (!product) return noStoreJson({ error: "Not found" }, { status: 404 });
    return noStoreJson({ product, savedAt: product.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to update training product", { id, message });
    return noStoreJson({ error: `Не удалось сохранить продукт: ${message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = readTrainingAdminSession(request);
  if (!session) {
    return noStoreJson({ error: "Только администратор может удалять продукты." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteProduct(id);
    if (!deleted) return noStoreJson({ error: "Not found" }, { status: 404 });
    return noStoreJson({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return noStoreJson({ error: `Не удалось удалить продукт: ${message}` }, { status: 500 });
  }
}
