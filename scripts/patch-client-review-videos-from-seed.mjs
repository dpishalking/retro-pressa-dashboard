import fs from "node:fs";

function normalizeVideoEmbedUrl(input) {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.includes("/embed/")) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : trimmed;
    }
    if (url.hostname.includes("youtube.com")) {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery) return `https://www.youtube.com/embed/${fromQuery}`;
      const shortsMatch = url.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function mergeVideos(seedVideos = [], liveVideos = []) {
  const liveById = new Map(liveVideos.map((item) => [item.id, item]));
  const merged = [];

  for (const seedVideo of seedVideos) {
    const liveVideo = liveById.get(seedVideo.id);
    const next = { ...(liveVideo ?? {}), ...seedVideo };
    const source = next.embedUrl?.trim() || next.url?.trim() || "";
    const embedUrl = normalizeVideoEmbedUrl(source);
    if (embedUrl) next.embedUrl = embedUrl;
    if (next.url?.trim() || source) next.url = next.url?.trim() || source;
    merged.push(next);
    liveById.delete(seedVideo.id);
  }

  for (const leftover of liveById.values()) {
    merged.push(leftover);
  }

  return merged.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

const seedPath = process.argv[2];
const livePath = process.argv[3];

if (!seedPath || !livePath) {
  console.error("Usage: node patch-client-review-videos-from-seed.mjs <seed.json> <live.json>");
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
const nextVideos = mergeVideos(seed.videos ?? [], live.videos ?? []);
const currentVideos = JSON.stringify(live.videos ?? []);
let changed = false;

if (JSON.stringify(nextVideos) !== currentVideos) {
  live.videos = nextVideos;
  changed = true;
}

if (seed.sectionTitle && live.sectionTitle !== seed.sectionTitle) {
  live.sectionTitle = seed.sectionTitle;
  changed = true;
}

if (changed) {
  fs.writeFileSync(livePath, `${JSON.stringify(live, null, 2)}\n`, "utf8");
  console.log(`Updated ${livePath}`);
} else {
  console.log("Client review videos already in sync with seed");
}
