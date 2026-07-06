import fs from "node:fs";

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
  console.log(`${product.id}: ${video?.embedUrl ?? "(no embed)"}`);
}
