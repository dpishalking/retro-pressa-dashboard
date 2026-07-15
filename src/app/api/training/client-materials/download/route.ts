import { NextResponse } from "next/server";
import {
  buildClientMaterialFilename,
  getClientMaterial,
  readLocalClientMaterial
} from "@/lib/training/client-materials";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function contentTypeForFilename(filename: string) {
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function attachmentHeaders(filename: string, contentType?: string) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": contentType ?? contentTypeForFilename(filename),
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  };
}

export async function GET(request: Request) {
  const materialId = new URL(request.url).searchParams.get("id") ?? "";
  const material = getClientMaterial(materialId);

  if (!material) {
    return NextResponse.json({ error: "Материал не найден." }, { status: 404 });
  }

  const source = material.downloadUrl ?? material.url;
  const filename = buildClientMaterialFilename(material);

  if (material.type === "video" && !material.downloadUrl) {
    return NextResponse.json({ error: "Видео доступно только по ссылке." }, { status: 400 });
  }

  try {
    if (/^https?:\/\//.test(source)) {
      const response = await fetch(source);
      if (!response.ok) {
        return NextResponse.json({ error: "Не удалось скачать внешний файл." }, { status: 502 });
      }

      return new Response(response.body, {
        headers: attachmentHeaders(filename, response.headers.get("content-type") ?? undefined)
      });
    }

    const file = await readLocalClientMaterial(source);
    return new Response(file, { headers: attachmentHeaders(filename) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось скачать материал.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
