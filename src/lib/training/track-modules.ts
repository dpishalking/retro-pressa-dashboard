import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTrackModulesSeed } from "@/data/training-tracks-seed";
import type { TrackStageId, TrainingTrackModule } from "@/types/training";

const trainingDir = path.join(process.cwd(), "data", "training");

function modulesPath(stageId: TrackStageId) {
  return path.join(trainingDir, `${stageId}-modules.json`);
}

type ModulesCatalog = {
  version: 1;
  modules: TrainingTrackModule[];
};

async function readCatalog(stageId: TrackStageId): Promise<TrainingTrackModule[]> {
  try {
    const raw = await readFile(modulesPath(stageId), "utf8");
    const parsed = JSON.parse(raw) as Partial<ModulesCatalog>;
    if (parsed?.version === 1 && Array.isArray(parsed.modules)) {
      return [...parsed.modules].sort((a, b) => a.sortOrder - b.sortOrder);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn(`Failed to read ${stageId} modules, using seed:`, message);
    }
  }

  const seed = createTrackModulesSeed(stageId);
  await writeCatalog(stageId, seed);
  return seed;
}

async function writeCatalog(stageId: TrackStageId, modules: TrainingTrackModule[]) {
  await mkdir(trainingDir, { recursive: true });
  const payload: ModulesCatalog = { version: 1, modules };
  await writeFile(modulesPath(stageId), JSON.stringify(payload, null, 2), "utf8");
}

export async function listTrackModules(stageId: TrackStageId): Promise<TrainingTrackModule[]> {
  return readCatalog(stageId);
}

export async function getTrackModule(stageId: TrackStageId, moduleId: string): Promise<TrainingTrackModule | null> {
  const modules = await listTrackModules(stageId);
  return modules.find((item) => item.id === moduleId) ?? null;
}

export async function findTrackModule(moduleId: string): Promise<TrainingTrackModule | null> {
  for (const stageId of ["crm", "practice"] as const) {
    const module = await getTrackModule(stageId, moduleId);
    if (module) return module;
  }
  return null;
}
