/**
 * Shared Bitrix REST helpers (webhook). Used by sales-foundation staging.
 */

export type BitrixListResponse<T> = {
  result?: T[] | { items?: T[] };
  next?: number;
  error?: string;
  error_description?: string;
};

export type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

function normalizeWebhookUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error?: string, description?: string) {
  return `${error ?? ""} ${description ?? ""}`.toLowerCase().includes("too many requests");
}

export function arrayResult<T>(result?: T[] | { items?: T[] }) {
  return Array.isArray(result) ? result : result?.items ?? [];
}

export function requireBitrixWebhook(): string {
  const webhook = process.env.BITRIX_WEBHOOK_URL?.trim();
  if (!webhook) throw new Error("BITRIX_WEBHOOK_URL is not configured");
  return normalizeWebhookUrl(webhook);
}

export async function bitrixList<T>(
  method: string,
  body: Record<string, unknown>,
  start = 0,
  attempt = 0
): Promise<BitrixListResponse<T>> {
  const webhook = requireBitrixWebhook();
  const response = await fetch(`${webhook}${method}.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, start }),
    cache: "no-store"
  });
  const data = (await response.json()) as BitrixListResponse<T>;
  if (!response.ok || data.error) {
    if (attempt < 3 && isRateLimitError(data.error, data.error_description)) {
      await sleep(1200 * (attempt + 1));
      return bitrixList<T>(method, body, start, attempt + 1);
    }
    throw new Error(data.error_description || data.error || `Bitrix request failed: ${method}`);
  }
  return data;
}

export async function bitrixResult<T>(
  method: string,
  body: Record<string, unknown> = {},
  attempt = 0
): Promise<T> {
  const webhook = requireBitrixWebhook();
  const response = await fetch(`${webhook}${method}.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const data = (await response.json()) as BitrixResponse<T>;
  if (!response.ok || data.error) {
    if (attempt < 3 && isRateLimitError(data.error, data.error_description)) {
      await sleep(1200 * (attempt + 1));
      return bitrixResult<T>(method, body, attempt + 1);
    }
    throw new Error(data.error_description || data.error || `Bitrix request failed: ${method}`);
  }
  if (data.result === undefined) throw new Error(`Bitrix empty result: ${method}`);
  return data.result;
}

export async function bitrixBatch<T>(
  cmd: Record<string, string>,
  attempt = 0
): Promise<Record<string, T>> {
  const webhook = requireBitrixWebhook();
  const response = await fetch(`${webhook}batch.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ halt: 0, cmd }),
    cache: "no-store"
  });
  const data = (await response.json()) as {
    result?: { result?: Record<string, T>; result_error?: Array<{ error?: string; error_description?: string }> };
    error?: string;
    error_description?: string;
  };
  if (!response.ok || data.error) {
    if (attempt < 3 && isRateLimitError(data.error, data.error_description)) {
      await sleep(1200 * (attempt + 1));
      return bitrixBatch<T>(cmd, attempt + 1);
    }
    throw new Error(data.error_description || data.error || "Bitrix batch failed");
  }
  return data.result?.result ?? {};
}

export async function bitrixListAll<T>(
  method: string,
  body: Record<string, unknown>,
  limit = 50
): Promise<T[]> {
  const rows: T[] = [];
  let start = 0;
  for (;;) {
    const page = await bitrixList<T>(method, { ...body, limit }, start);
    const chunk = arrayResult(page.result);
    rows.push(...chunk);
    if (page.next == null || chunk.length === 0) break;
    start = page.next;
    await sleep(150);
  }
  return rows;
}

export function chunkIds<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
