import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { SavedScenario, ScenarioLibrary } from "./types";
import { getSeedScenarioLibrary } from "./scenario-seed";

const libraryPath = path.join(process.cwd(), "data", "scenarios", "library.json");

export async function readScenarioLibrary(): Promise<ScenarioLibrary> {
  try {
    const raw = await readFile(libraryPath, "utf8");
    const parsed = JSON.parse(raw) as ScenarioLibrary;
    if (!Array.isArray(parsed.scenarios)) return getSeedScenarioLibrary();
    return parsed;
  } catch {
    return getSeedScenarioLibrary();
  }
}

export async function writeScenarioLibrary(library: ScenarioLibrary): Promise<ScenarioLibrary> {
  await mkdir(path.dirname(libraryPath), { recursive: true });
  await writeFile(libraryPath, `${JSON.stringify(library, null, 2)}\n`, "utf8");
  return library;
}

export async function getScenarioById(id: string): Promise<SavedScenario | null> {
  const library = await readScenarioLibrary();
  return library.scenarios.find((scenario) => scenario.id === id) ?? null;
}

export async function upsertScenario(scenario: SavedScenario): Promise<ScenarioLibrary> {
  const library = await readScenarioLibrary();
  const index = library.scenarios.findIndex((item) => item.id === scenario.id);
  const next = { ...scenario, updatedAt: new Date().toISOString() };
  if (index >= 0) library.scenarios[index] = next;
  else library.scenarios.push({ ...next, createdAt: next.createdAt ?? next.updatedAt });
  return writeScenarioLibrary(library);
}
