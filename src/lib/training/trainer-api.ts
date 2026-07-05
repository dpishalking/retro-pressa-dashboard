const TRAINER_API_URL = (process.env.TRAINER_API_URL ?? "http://localhost:3100").replace(/\/$/, "");
const TRAINER_ADMIN_API_KEY = process.env.TRAINER_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? "";
const TRAINER_SERVICE_TAG = process.env.TRAINER_SERVICE_TAG ?? "retro-pressa";

export type TrainerBotLink = {
  botLink: string;
  inviteToken: string;
  managerName: string;
};

export async function ensureTrainerBotLink(user: {
  id: string;
  name: string;
}): Promise<TrainerBotLink | null> {
  try {
    const url = new URL(`${TRAINER_API_URL}/trainer/managers/${encodeURIComponent(user.id)}/practice`);
    url.searchParams.set("name", user.name);
    url.searchParams.set("service", TRAINER_SERVICE_TAG);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn("Trainer bot link fetch failed", { status: res.status, userId: user.id });
      return null;
    }

    const data = (await res.json()) as {
      botLink: string;
      inviteToken: string;
      manager: { fullName: string };
    };

    return {
      botLink: data.botLink,
      inviteToken: data.inviteToken,
      managerName: data.manager.fullName,
    };
  } catch (error) {
    console.warn("Trainer bot link fetch error", { userId: user.id, error: String(error) });
    return null;
  }
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
