function extractYouTubeId(url: URL) {
  if (url.hostname === "youtu.be") {
    return url.pathname.replace(/^\//, "").split("/")[0] || null;
  }

  if (url.hostname.includes("youtube.com")) {
    const fromQuery = url.searchParams.get("v");
    if (fromQuery) return fromQuery;

    const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];

    const shortsMatch = url.pathname.match(/\/shorts\/([^/?]+)/);
    if (shortsMatch) return shortsMatch[1];
  }

  return null;
}

export function normalizeVideoEmbedUrl(input?: string | null) {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return "";

  if (trimmed.includes("/embed/")) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function normalizeProductMaterials<T extends { type: string; url?: string; embedUrl?: string }>(
  materials: T[]
): T[] {
  return materials.map((material) => {
    if (material.type !== "video") return material;

    const source = material.embedUrl?.trim() || material.url?.trim() || "";
    const embedUrl = normalizeVideoEmbedUrl(source);

    return {
      ...material,
      url: material.url?.trim() || source || undefined,
      embedUrl: embedUrl || undefined
    };
  });
}
