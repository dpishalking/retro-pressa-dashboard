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

const CONTENT_FIELDS = [
  "title",
  "shortDescription",
  "coverImage",
  "passingScore",
  "sortOrder",
  "description",
  "targetAudience",
  "clientProblems",
  "emotions",
  "purchaseReasons",
  "objections",
  "presentationGuide"
];

function mergeMaterials(seedMaterials = [], liveMaterials = []) {
  const liveById = new Map(liveMaterials.map((item) => [item.id, item]));
  const merged = [];

  for (const seedMaterial of seedMaterials) {
    const liveMaterial = liveById.get(seedMaterial.id);
    if (!liveMaterial) {
      merged.push({ ...seedMaterial });
      continue;
    }

    const next = { ...liveMaterial, ...seedMaterial };

    if (next.type === "video") {
      const source = next.embedUrl?.trim() || next.url?.trim() || "";
      const normalizedEmbed = normalizeVideoEmbedUrl(source);
      if (normalizedEmbed) {
        next.embedUrl = normalizedEmbed;
      }
    }

    merged.push(next);
    liveById.delete(seedMaterial.id);
  }

  for (const leftover of liveById.values()) {
    if (leftover.sectionKey === "gallery") continue;
    if (leftover.type === "video") {
      const source = leftover.embedUrl?.trim() || leftover.url?.trim() || "";
      const normalizedEmbed = normalizeVideoEmbedUrl(source);
      if (normalizedEmbed) {
        leftover.embedUrl = normalizedEmbed;
      }
    }
    merged.push(leftover);
  }

  return merged.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function syncProductFromSeed(seedProduct, liveProduct) {
  let productChanged = false;

  for (const field of CONTENT_FIELDS) {
    if (seedProduct[field] === undefined || liveProduct[field] === seedProduct[field]) continue;
    liveProduct[field] = seedProduct[field];
    productChanged = true;
  }

  if (Array.isArray(seedProduct.questions)) {
    const nextQuestions = JSON.stringify(seedProduct.questions);
    const currentQuestions = JSON.stringify(liveProduct.questions ?? []);
    if (nextQuestions !== currentQuestions) {
      liveProduct.questions = seedProduct.questions;
      productChanged = true;
    }
  }

  const nextMaterials = mergeMaterials(seedProduct.materials ?? [], liveProduct.materials ?? []);
  const currentMaterials = JSON.stringify(liveProduct.materials ?? []);
  if (JSON.stringify(nextMaterials) !== currentMaterials) {
    liveProduct.materials = nextMaterials;
    productChanged = true;
  }

  return productChanged;
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

for (const seedProduct of seed.products ?? []) {
  const liveProduct = live.products?.find((item) => item.id === seedProduct.id);
  if (!liveProduct) continue;

  if (syncProductFromSeed(seedProduct, liveProduct)) {
    changed = true;
    console.log(`Synced product content for ${seedProduct.id}`);
  }
}

if (changed) {
  live.updatedAt = new Date().toISOString();
  fs.writeFileSync(livePath, `${JSON.stringify(live, null, 2)}\n`, "utf8");
  console.log(`Updated ${livePath}`);
} else {
  console.log("Training catalog already in sync with seed");
}

for (const product of live.products ?? []) {
  const video = product.materials?.find((item) => item.type === "video");
  console.log(`${product.id}: ${video?.embedUrl ?? video?.url ?? "(no video)"}`);
}
