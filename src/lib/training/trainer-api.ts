const TRAINER_API_URL = (
  process.env.TRAINER_API_URL ??
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:3100" : "http://localhost:3100")
).replace(/\/$/, "");
const TRAINER_ADMIN_API_KEY = process.env.TRAINER_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? "";
const TRAINER_SERVICE_TAG = process.env.TRAINER_SERVICE_TAG ?? "retro-pressa";
const TRAINER_BOT_USERNAME = (process.env.TRAINER_BOT_USERNAME ?? "dushnila12_bot").replace(/^@/, "");

export type TrainerBotLink = {
  botLink: string;
  inviteToken: string;
  managerName: string;
};

type TrainerLinksResponse = {
  botLink: string;
  inviteToken: string;
  manager: { fullName: string };
};

function mapLinks(data: TrainerLinksResponse, fallbackName: string): TrainerBotLink {
  return {
    botLink: data.botLink,
    inviteToken: data.inviteToken,
    managerName: data.manager?.fullName ?? fallbackName,
  };
}

async function fetchPracticeLink(user: { id: string; name: string }): Promise<TrainerBotLink | null> {
  const url = new URL(`${TRAINER_API_URL}/trainer/managers/${encodeURIComponent(user.id)}/practice`);
  url.searchParams.set("name", user.name);
  url.searchParams.set("service", TRAINER_SERVICE_TAG);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.warn("Trainer practice link fetch failed", { status: res.status, userId: user.id });
    return null;
  }

  return mapLinks((await res.json()) as TrainerLinksResponse, user.name);
}

async function createManagerLink(user: { id: string; name: string }): Promise<TrainerBotLink | null> {
  if (!TRAINER_ADMIN_API_KEY) return null;

  const res = await fetch(`${TRAINER_API_URL}/trainer/managers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": TRAINER_ADMIN_API_KEY,
    },
    body: JSON.stringify({
      externalId: user.id,
      fullName: user.name,
      serviceTag: TRAINER_SERVICE_TAG,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.warn("Trainer manager create failed", { status: res.status, userId: user.id });
    return null;
  }

  return mapLinks((await res.json()) as TrainerLinksResponse, user.name);
}

export async function ensureTrainerBotLink(user: {
  id: string;
  name: string;
}): Promise<TrainerBotLink | null> {
  try {
    const created = await createManagerLink(user);
    if (created) return created;

    return await fetchPracticeLink(user);
  } catch (error) {
    console.warn("Trainer bot link fetch error", { userId: user.id, error: String(error) });
    return null;
  }
}

export function buildFallbackBotLink(): string {
  return `https://t.me/${TRAINER_BOT_USERNAME}`;
}

export async function registerTrainerManager(user: {
  id: string;
  name: string;
}): Promise<void> {
  if (!TRAINER_ADMIN_API_KEY) {
    console.warn("TRAINER_ADMIN_API_KEY not set — skip trainer manager registration");
    return;
  }

  try {
    const res = await fetch(`${TRAINER_API_URL}/trainer/managers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": TRAINER_ADMIN_API_KEY,
      },
      body: JSON.stringify({
        externalId: user.id,
        fullName: user.name,
        serviceTag: TRAINER_SERVICE_TAG,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn("Trainer manager registration failed", { status: res.status, userId: user.id });
    }
  } catch (error) {
    console.warn("Trainer manager registration error", { userId: user.id, error: String(error) });
  }
}
