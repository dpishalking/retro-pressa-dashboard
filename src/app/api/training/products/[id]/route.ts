import { NextResponse } from "next/server";
import { deleteProduct, getProduct, updateProduct } from "@/lib/training/store";
import { normalizeProductMaterials } from "@/lib/training/video-embed";
import type { ProductTrainingModule } from "@/types/training";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const raw = new URL(request.url).searchParams.get("raw") === "1";
  const product = await getProduct(id, { raw });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<ProductTrainingModule>;
  const product = await updateProduct(id, {
    ...body,
    materials: body.materials ? normalizeProductMaterials(body.materials) : undefined
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteProduct(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
