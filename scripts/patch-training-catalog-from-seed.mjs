import fs from "node:fs";

function extractYouTubeId(url) {
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

function normalizeVideoEmbedUrl(input) {
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

const seedPath = process.argv[2];
const livePath = process.argv[3];

if (!seedPath || !livePath) {
  console.error("Usage: node patch-training-catalog-from-seed.mjs <seed.json> <live.json>");
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
let changed = false;

for (const liveProduct of live.products ?? []) {
  for (const liveMaterial of liveProduct.materials ?? []) {
    if (liveMaterial.type !== "video") continue;

    const source = liveMaterial.embedUrl?.trim() || liveMaterial.url?.trim() || "";
    const normalizedEmbed = normalizeVideoEmbedUrl(source);
    if (!normalizedEmbed) continue;

    if (liveMaterial.embedUrl !== normalizedEmbed) {
      liveMaterial.embedUrl = normalizedEmbed;
      changed = true;
      console.log(`Normalized embed for ${liveMaterial.id} in ${liveProduct.id}`);
    }
  }
}

for (const seedProduct of seed.products ?? []) {
  const liveProduct = live.products?.find((item) => item.id === seedProduct.id);
  if (!liveProduct) continue;

  for (const seedMaterial of seedProduct.materials ?? []) {
    if (seedMaterial.type !== "video" || !seedMaterial.embedUrl) continue;

    const liveMaterial = liveProduct.materials?.find((item) => item.id === seedMaterial.id);
    if (!liveMaterial) continue;

    const nextUrl = seedMaterial.url ?? liveMaterial.url;
    const nextEmbed = seedMaterial.embedUrl;
    const nextContent = seedMaterial.content ?? liveMaterial.content;

    if (
      liveMaterial.url === nextUrl &&
      liveMaterial.embedUrl === nextEmbed &&
      liveMaterial.content === nextContent
    ) {
      continue;
    }

    liveMaterial.url = nextUrl;
    liveMaterial.embedUrl = nextEmbed;
    liveMaterial.content = nextContent;
    changed = true;
    console.log(`Synced video ${seedMaterial.id} in ${seedProduct.id}`);
  }
}

if (changed) {
  live.updatedAt = new Date().toISOString();
  fs.writeFileSync(livePath, `${JSON.stringify(live, null, 2)}\n`, "utf8");
  console.log(`Updated ${livePath}`);
} else {
  console.log("Video materials already in sync with seed");
}

for (const product of live.products ?? []) {
  const video = product.materials?.find((item) => item.type === "video");
  console.log(`${product.id}: ${video?.embedUrl ?? video?.url ?? "(no video)"}`);
}
