"use client";

import { useEffect, useMemo, useState } from "react";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";

type LoadState = "loading" | "ok" | "error";

export function useCeoSnapshot(initialPeriod = "") {
  const [period, setPeriod] = useState(initialPeriod);
  const [country, setCountry] = useState("");
  const [managerId, setManagerId] = useState("");
  const [productId, setProductId] = useState("");
  const [snapshot, setSnapshot] = useState<CeoControlCenterSnapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");
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
    setState("loading");
    setError("");
    fetch(`/api/analytics/ceo-snapshot${query ? `?${query}` : ""}`)
      .then(async (response) => {
        const json = (await response.json()) as CeoControlCenterSnapshot & { error?: string };
        if (!response.ok) throw new Error(json.error || "Ошибка загрузки");
        if (cancelled) return;
        setSnapshot(json);
        setPeriod((current) => current || json.period);
        setState("ok");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState("error");
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
