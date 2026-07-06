import { NextResponse } from "next/server";
import { readTrainingAdminSession } from "@/lib/training/admin-auth";
import { readRawTrainingCatalog } from "@/lib/training/store";
import { normalizeProductMaterials, normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const session = readTrainingAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const trainingDir = process.env.TRAINING_DATA_DIR?.trim()
    ? path.resolve(process.env.TRAINING_DATA_DIR.trim())
    : path.join(process.cwd(), "data", "training");

  const catalog = await readRawTrainingCatalog();
  const products =
    catalog?.products.map((product) => ({
      id: product.id,
      title: product.title,
      updatedAt: product.updatedAt,
      shortDescriptionPreview: product.shortDescription.slice(0, 120),
      videos: normalizeProductMaterials(product.materials)
        .filter((material) => material.type === "video")
        .map((material) => ({
          id: material.id,
          title: material.title,
          url: material.url ?? null,
          embedUrl: material.embedUrl ?? null,
          resolvedEmbedUrl: normalizeVideoEmbedUrl(material.embedUrl ?? material.url) || null
        }))
    })) ?? [];

  return NextResponse.json({
    trainingDir,
    catalogPath: path.join(trainingDir, "products.json"),
    catalogUpdatedAt: catalog?.updatedAt ?? null,
    productCount: products.length,
    products
  });
}
