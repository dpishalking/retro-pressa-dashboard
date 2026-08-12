import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import {
  loadCeoSnapshot,
  type LoadCeoSnapshotOptions
} from "@/lib/analytics-os/load-ceo-snapshot";

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  value: CeoControlCenterSnapshot;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CeoControlCenterSnapshot>>();

function cacheKey(options: LoadCeoSnapshotOptions): string {
  return JSON.stringify({
    period: options.period || "",
    country: options.country || "",
    managerId: options.managerId || "",
    productId: options.productId || ""
  });
}

export async function getCachedCeoSnapshot(
  options: LoadCeoSnapshotOptions
): Promise<CeoControlCenterSnapshot> {
  const key = cacheKey(options);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const request = loadCeoSnapshot(options)
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
      return value;
    })
    .catch((error) => {
      if (cached) return cached.value;
      throw error;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, request);
  return request;
}
