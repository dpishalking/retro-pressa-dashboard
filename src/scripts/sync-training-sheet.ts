import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchParsedTrainingSheetProducts } from "@/lib/training/fetch-training-sheet";

async function main() {
  const products = await fetchParsedTrainingSheetProducts();
  const outputPath = path.join(process.cwd(), "data", "training", "sheet-products.json");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        version: 1,
        products,
        syncedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Saved ${products.length} products to ${outputPath}`);
  for (const product of products) {
    console.log(`- ${product.id}: ${product.title}${product.description ? "" : " (empty description)"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
