import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { createTrainingCatalogSeed } from "@/data/training-seed";

async function main() {
  const catalog = createTrainingCatalogSeed();
  const outputPath = path.join(process.cwd(), "data", "training", "products.json");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(catalog, null, 2), "utf8");

  console.log(`Saved ${catalog.products.length} products to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
