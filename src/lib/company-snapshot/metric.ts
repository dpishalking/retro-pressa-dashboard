import type { SnapshotMetric, SnapshotSourceId } from "./types";

export function metric(
  value: number,
  source: SnapshotSourceId,
  updatedAt: string | null = null,
  available = true
): SnapshotMetric {
  return { value, source, updatedAt, available };
}

export function unavailableMetric(source: SnapshotSourceId): SnapshotMetric {
  return { value: 0, source, updatedAt: null, available: false };
}
