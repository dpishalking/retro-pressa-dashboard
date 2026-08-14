"use client";

import { useEffect, useMemo, useState } from "react";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";

type LoadState = "loading" | "ok" | "error";

const CLIENT_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  query: string;
  snapshot: CeoControlCenterSnapshot;
  fetchedAt: number;
};

let memoryCache: CacheEntry | null = null;
const inflight = new Map<string, Promise<CeoControlCenterSnapshot>>();

function filterParams(query: string): { period: string; country: string; managerId: string; productId: string } {
  const params = new URLSearchParams(query);
  return {
    period: params.get("period") || "",
    country: params.get("country") || "",
    managerId: params.get("managerId") || "",
    productId: params.get("productId") || ""
  };
}

function queriesEquivalent(requestQuery: string, cached: CacheEntry): boolean {
  if (requestQuery === cached.query) return true;
  const req = filterParams(requestQuery);
  const cachedParams = filterParams(cached.query);
  const sameSlice =
    req.country === cachedParams.country &&
    req.managerId === cachedParams.managerId &&
    req.productId === cachedParams.productId;
  const reqPeriod = req.period || cached.snapshot.period;
  const cachedPeriod = cachedParams.period || cached.snapshot.period;
  return sameSlice && Boolean(reqPeriod) && reqPeriod === cachedPeriod;
}

function readCache(query: string, allowStale: boolean): CacheEntry | null {
  if (!memoryCache) return null;
  if (!queriesEquivalent(query, memoryCache)) return null;
  if (!allowStale && Date.now() - memoryCache.fetchedAt > CLIENT_TTL_MS) return null;
  return memoryCache;
}

function writeCache(query: string, snapshot: CeoControlCenterSnapshot) {
  memoryCache = { query, snapshot, fetchedAt: Date.now() };
}

function fetchCeoSnapshot(query: string): Promise<CeoControlCenterSnapshot> {
  const pending = inflight.get(query);
  if (pending) return pending;

  const request = fetch(`/api/analytics/ceo-snapshot${query ? `?${query}` : ""}`)
    .then(async (response) => {
      const json = (await response.json()) as CeoControlCenterSnapshot & { error?: string };
      if (!response.ok) throw new Error(json.error || "Ошибка загрузки");
      writeCache(query, json);
      return json;
    })
    .finally(() => {
      inflight.delete(query);
    });

  inflight.set(query, request);
  return request;
}

export function useCeoSnapshot(initialPeriod = "") {
  const seed = memoryCache;
  const [period, setPeriod] = useState(initialPeriod || seed?.snapshot.period || "");
  const [country, setCountry] = useState("");
  const [managerId, setManagerId] = useState("");
  const [productId, setProductId] = useState("");
  const [snapshot, setSnapshot] = useState<CeoControlCenterSnapshot | null>(seed?.snapshot ?? null);
  const [state, setState] = useState<LoadState>(seed ? "ok" : "loading");
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (country) params.set("country", country);
    if (managerId) params.set("managerId", managerId);
    if (productId) params.set("productId", productId);
    return params.toString();
  }, [period, country, managerId, productId]);

  useEffect(() => {
    let cancelled = false;
    const fresh = readCache(query, false);
    if (fresh) {
      setSnapshot(fresh.snapshot);
      setPeriod((current) => current || fresh.snapshot.period);
      setState("ok");
      setError("");
      return;
    }

    const stale = readCache(query, true);
    if (stale) {
      setSnapshot(stale.snapshot);
      setPeriod((current) => current || stale.snapshot.period);
      setState("ok");
    } else {
      setState("loading");
    }
    setError("");

    fetchCeoSnapshot(query)
      .then((json) => {
        if (cancelled) return;
        setSnapshot(json);
        setPeriod((current) => current || json.period);
        setState("ok");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState((current) => (current === "ok" ? "ok" : "error"));
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return {
    period,
    setPeriod,
    country,
    setCountry,
    managerId,
    setManagerId,
    productId,
    setProductId,
    snapshot,
    state,
    error
  };
}
