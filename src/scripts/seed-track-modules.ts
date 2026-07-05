import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTrackModulesSeed } from "@/data/training-tracks-seed";

async function main() {
  const dir = path.join(process.cwd(), "data", "training");
  await mkdir(dir, { recursive: true });

  for (const stage of ["crm", "practice"] as const) {
    const modules = createTrackModulesSeed(stage);
    const filePath = path.join(dir, `${stage}-modules.json`);
    await writeFile(filePath, JSON.stringify({ version: 1, modules }, null, 2), "utf8");
    console.log(`Wrote ${filePath} (${modules.length} modules)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
