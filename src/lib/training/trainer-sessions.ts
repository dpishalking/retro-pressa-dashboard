import type { TrainingStatus } from "@/types/training";
import { fetchManagerBotSessions, fetchLmsLinkStatus, registerTrainerManager, type TrainerBotSession } from "@/lib/training/trainer-api";

function mapTrainerStatus(status: string, hasCompleted: boolean): TrainingStatus {
  if (hasCompleted || status === "completed") return "completed";
  if (status === "active") return "in_progress";
  return "not_started";
}

export type BotScenarioReportRow = {
  id: string;
  title: string;
  status: TrainingStatus;
  bestScorePercent?: number;
  attemptCount: number;
  startedAt?: string;
  completedAt?: string;
  lastAttemptAt?: string;
};

export function buildBotScenarioRowsFromTrainerSessions(sessions: TrainerBotSession[]): BotScenarioReportRow[] {
  const grouped = new Map<string, TrainerBotSession[]>();

  for (const session of sessions) {
    const bucket = grouped.get(session.scenarioId) ?? [];
    bucket.push(session);
    grouped.set(session.scenarioId, bucket);
  }

  return Array.from(grouped.entries())
    .map(([scenarioId, attempts]) => {
      const sorted = [...attempts].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      const latest = sorted[0];
      const completedAttempts = attempts.filter((item) => item.status === "completed");
      const bestScorePercent = completedAttempts.reduce<number | undefined>((best, item) => {
        if (item.score == null) return best;
        if (best == null) return item.score;
        return Math.max(best, item.score);
      }, undefined);
      const earliestStarted = sorted[sorted.length - 1]?.startedAt;
      const latestCompleted = completedAttempts
        .map((item) => item.completedAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => right.localeCompare(left))[0];

      return {
        id: scenarioId,
        title: latest.scenarioName,
        status: mapTrainerStatus(latest.status, completedAttempts.length > 0),
        bestScorePercent,
        attemptCount: attempts.length,
        startedAt: earliestStarted,
        completedAt: latestCompleted,
        lastAttemptAt: latest.startedAt
      };
    })
    .sort((left, right) => (right.lastAttemptAt ?? "").localeCompare(left.lastAttemptAt ?? ""));
}

export async function loadManagerBotScenarioRows(
  externalId: string,
  userName?: string
): Promise<{
  rows: BotScenarioReportRow[];
  linkStatus?: {
    managerRegistered: boolean;
    linkedTelegramUsers: number;
    sessionCount: number;
    sessionsFetchStatus?: number;
    sessionsFetchError?: string;
  };
}> {
  if (userName) {
    await registerTrainerManager({ id: externalId, name: userName });
  }
  const [sessionsResult, lmsStatus] = await Promise.all([
    fetchManagerBotSessions(externalId),
    fetchLmsLinkStatus(externalId),
  ]);

  return {
    rows: buildBotScenarioRowsFromTrainerSessions(sessionsResult.sessions),
    linkStatus: {
      managerRegistered: lmsStatus?.managerRegistered ?? false,
      linkedTelegramUsers: lmsStatus?.linkedTelegramUsers ?? 0,
      sessionCount: lmsStatus?.sessionCount ?? 0,
      sessionsFetchStatus: sessionsResult.status || lmsStatus?.status,
      sessionsFetchError: sessionsResult.error ?? lmsStatus?.error,
    },
  };
}
