import { describe, expect, it } from "vitest";
import { buildBotScenarioRowsFromTrainerSessions } from "@/lib/training/trainer-sessions";
import type { TrainerBotSession } from "@/lib/training/trainer-api";

describe("buildBotScenarioRowsFromTrainerSessions", () => {
  it("groups attempts by scenario and keeps the best score", () => {
    const sessions: TrainerBotSession[] = [
      {
        id: "s1",
        scenarioId: "dad-60",
        scenarioName: "Подарок папе на 60-летие",
        difficulty: "medium",
        mode: "mode_a",
        status: "completed",
        score: 0,
        result: "incomplete",
        hintsUsed: 0,
        startedAt: "2026-07-05T14:45:00.000Z",
        completedAt: "2026-07-05T14:50:00.000Z",
        mistakes: ["Игнорирование запроса клиента"]
      },
      {
        id: "s2",
        scenarioId: "dad-60",
        scenarioName: "Подарок папе на 60-летие",
        difficulty: "medium",
        mode: "mode_a",
        status: "completed",
        score: 42,
        result: "sale",
        hintsUsed: 1,
        startedAt: "2026-07-06T10:00:00.000Z",
        completedAt: "2026-07-06T10:10:00.000Z",
        mistakes: []
      }
    ];

    const rows = buildBotScenarioRowsFromTrainerSessions(sessions);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "dad-60",
      title: "Подарок папе на 60-летие",
      status: "completed",
      bestScorePercent: 42,
      attemptCount: 2
    });
  });
});
