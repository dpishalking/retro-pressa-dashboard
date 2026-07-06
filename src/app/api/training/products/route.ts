import { NextResponse } from "next/server";
import { readTrainingAdminSession } from "@/lib/training/admin-auth";
import { createProduct, listProducts, generateId } from "@/lib/training/store";
import { normalizeProductMaterials } from "@/lib/training/video-embed";
import type { ProductTrainingModule } from "@/types/training";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {})
    }
  });
}

export async function GET() {
  const products = await listProducts();
  return noStoreJson({ products });
}

export async function POST(request: Request) {
  const session = readTrainingAdminSession(request);
  if (!session) {
    return noStoreJson({ error: "Только администратор может создавать продукты." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Partial<ProductTrainingModule>;

    if (!body.title?.trim()) {
      return noStoreJson({ error: "Title is required" }, { status: 400 });
    }

    const product = await createProduct({
      id: body.id?.trim() || generateId("product"),
      title: body.title.trim(),
      shortDescription: body.shortDescription?.trim() ?? "",
      coverImage: body.coverImage?.trim() ?? "https://picsum.photos/seed/new-product/800/500",
      passingScore: body.passingScore ?? 80,
      description: body.description?.trim() ?? "",
      targetAudience: body.targetAudience?.trim() ?? "",
      clientProblems: body.clientProblems?.trim() ?? "",
      emotions: body.emotions?.trim() ?? "",
      purchaseReasons: body.purchaseReasons?.trim() ?? "",
      objections: body.objections?.trim() ?? "",
      presentationGuide: body.presentationGuide?.trim() ?? "",
      presentationUrl: body.presentationUrl?.trim() || undefined,
      materials: normalizeProductMaterials(body.materials ?? []),
      questions: body.questions ?? [],
      sortOrder: body.sortOrder ?? 999
    });

    return noStoreJson({ product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return noStoreJson({ error: `Не удалось создать продукт: ${message}` }, { status: 500 });
  }
}
