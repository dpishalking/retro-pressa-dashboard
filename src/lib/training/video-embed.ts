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

function extractStartSeconds(url: URL) {
  const raw = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (!raw) return null;

  if (/^\d+$/.test(raw)) return Number(raw);

  const secondsMatch = raw.match(/^(\d+)s?$/i);
  if (secondsMatch) return Number(secondsMatch[1]);

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
      const start = extractStartSeconds(url);
      const base = `https://www.youtube.com/embed/${videoId}`;
      return start != null ? `${base}?start=${start}` : base;
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
