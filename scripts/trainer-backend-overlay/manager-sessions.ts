import { getDb } from "../db/client.js";
import { getManagerByExternalId } from "./manager-service.js";

export type ManagerSessionRow = {
  id: string;
  scenarioId: string;
  scenarioName: string;
  difficulty: string | null;
  mode: string;
  status: string;
  score: number | null;
  result: string | null;
  hintsUsed: number;
  startedAt: string;
  completedAt: string | null;
  mistakes: string[];
};

function parseMistakes(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function getManagerTrainingSessions(externalId: string): ManagerSessionRow[] {
  const manager = getManagerByExternalId(externalId);
  if (!manager) return [];

  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT s.id, s.scenario_id, s.mode, s.status, s.score, s.result, s.hints_used, s.started_at, s.completed_at,
             sc.name as scenario_name, sc.difficulty,
             e.mistakes_json
      FROM training_managers m
      JOIN training_invites i ON i.token = m.invite_token
      JOIN training_users u ON u.team_id = i.team_id
      JOIN training_sessions s ON s.user_id = u.id
      JOIN training_scenarios sc ON sc.id = s.scenario_id
      LEFT JOIN training_evaluations e ON e.session_id = s.id
      WHERE m.external_id = ?
      ORDER BY s.started_at DESC
      LIMIT 100
    `
    )
    .all(externalId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    scenarioId: String(row.scenario_id),
    scenarioName: String(row.scenario_name),
    difficulty: row.difficulty ? String(row.difficulty) : null,
    mode: String(row.mode),
    status: String(row.status),
    score: row.score == null ? null : Number(row.score),
    result: row.result ? String(row.result) : null,
    hintsUsed: Number(row.hints_used ?? 0),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    mistakes: parseMistakes(row.mistakes_json),
  }));
}
