import { NextResponse } from "next/server";
import { createProduct, listProducts, generateId } from "@/lib/training/store";
import type { ProductTrainingModule } from "@/types/training";

export async function GET() {
  const products = await listProducts();
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ProductTrainingModule>;

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
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
    materials: body.materials ?? [],
    questions: body.questions ?? [],
    sortOrder: body.sortOrder ?? 999
  });

  return NextResponse.json({ product }, { status: 201 });
}
