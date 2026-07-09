import type { SavedScenario, ScenarioLibrary } from "./types";

const seedScenarios: SavedScenario[] = [
  {
    id: "avg-check-growth",
    name: "Рост среднего чека",
    description: "Upsell и рост среднего чека на 7%",
    changes: [{ driverId: "avgCheck", deltaPercent: 0.07 }],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  },
  {
    id: "conversion-boost",
    name: "Рост конверсии",
    description: "Конверсия в продажу +2 п.п.",
    changes: [{ driverId: "salesConversion", deltaPoints: 0.02 }],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  },
  {
    id: "marketing-scale",
    name: "Масштабирование маркетинга",
    description: "Рекламный бюджет +15%",
    changes: [{ driverId: "adBudget", deltaPercent: 0.15 }],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  },
  {
    id: "black-friday",
    name: "Черная пятница",
    description: "Скидка и рост конверсии",
    changes: [
      { driverId: "discountRate", deltaPoints: 0.05 },
      { driverId: "salesConversion", deltaPoints: 0.04 },
      { driverId: "adBudget", deltaPercent: 0.25 }
    ],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  }
];

export function getSeedScenarioLibrary(): ScenarioLibrary {
  return { version: 1, scenarios: seedScenarios };
}

export function getSeedScenarioById(id: string): SavedScenario | null {
  return seedScenarios.find((scenario) => scenario.id === id) ?? null;
}
