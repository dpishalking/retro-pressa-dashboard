import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type InstagramCheck = {
  stamp: string;
  alerted: boolean;
  checkedAt: string;
};

export type AlertState = {
  bootstrapped: boolean;
  helloSent: boolean;
  notifiedIds: string[];
  instagramBootstrapped: boolean;
  instagramChecks: Record<string, InstagramCheck>;
};

const MAX_IDS = 400;

export function emptyAlertState(): AlertState {
  return {
    bootstrapped: false,
    helloSent: false,
    notifiedIds: [],
    instagramBootstrapped: false,
    instagramChecks: {}
  };
}

export function stateFilePath(): string {
  return (
    process.env.LANDING_LEAD_ALERT_STATE_FILE?.trim() ||
    path.join(process.cwd(), "data", "landing-lead-alerts", "state.json")
  );
}

export function rememberIds(current: string[], extra: string[]): string[] {
  return [...new Set([...current, ...extra])].slice(-MAX_IDS);
}

export async function loadAlertState(file = stateFilePath()): Promise<AlertState> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as Partial<AlertState>;
    const checks: AlertState["instagramChecks"] = {};
    if (raw.instagramChecks && typeof raw.instagramChecks === "object") {
      for (const [id, value] of Object.entries(raw.instagramChecks)) {
        if (!value || typeof value !== "object") continue;
        checks[id] = {
          stamp: String(value.stamp || ""),
          alerted: value.alerted === true,
          checkedAt: String(value.checkedAt || "")
        };
      }
    }
    return {
      bootstrapped: raw.bootstrapped === true,
      helloSent: raw.helloSent === true,
      notifiedIds: Array.isArray(raw.notifiedIds) ? raw.notifiedIds.map(String) : [],
      instagramBootstrapped: raw.instagramBootstrapped === true,
      instagramChecks: checks
    };
  } catch {
    return emptyAlertState();
  }
}

export async function saveAlertState(state: AlertState, file = stateFilePath()): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2));
}
