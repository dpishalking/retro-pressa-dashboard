import { PRACTICE_BOT_SCENARIOS } from "@/lib/training/practice-bot";
import { buildTrainingOverview, getTrackModuleProgress } from "@/lib/training/progress";
import {
  getOrCreateUserProgress,
  listProducts,
  resolveProductStatus
} from "@/lib/training/store";
import { listTrackModules } from "@/lib/training/track-modules";
import type { AppUserPublic } from "@/types/auth";
import type { ManagerTrainingReport, TrainingStatus, UserTrainingProgress } from "@/types/training";

function resolveBotScenarioStatus(progress: UserTrainingProgress, scenarioId: string): TrainingStatus {
  return progress.botScenarios?.find((item) => item.scenarioId === scenarioId)?.status ?? "not_started";
}

function pickLatestTimestamp(values: Array<string | undefined>): string | undefined {
  const filtered = values.filter(Boolean) as string[];
  if (filtered.length === 0) return undefined;
  return filtered.sort((left, right) => right.localeCompare(left))[0];
}

export async function buildManagerTrainingReport(user: AppUserPublic): Promise<ManagerTrainingReport> {
  const [products, crmModules, practiceModules, progress] = await Promise.all([
    listProducts(),
    listTrackModules("crm"),
    listTrackModules("practice"),
    getOrCreateUserProgress(user.id, user.name)
  ]);

  const overview = buildTrainingOverview(products, crmModules, practiceModules, progress);

  const productRows = products.map((product) => {
    const item = progress.products.find((entry) => entry.productId === product.id);
    return {
      id: product.id,
      title: product.title,
      status: resolveProductStatus(progress, product.id),
      bestScorePercent: item?.bestScorePercent,
      attemptCount: item?.attemptCount ?? 0,
      lastAttemptAt: item?.lastAttemptAt
    };
  });

  const crmRows = crmModules.map((module) => {
    const item = getTrackModuleProgress(progress, "crm", module.id);
    return {
      id: module.id,
      title: module.title,
      status: item?.status ?? "not_started",
      bestScorePercent: item?.bestScorePercent,
      attemptCount: item?.attemptCount ?? 0,
      lastAttemptAt: item?.lastAttemptAt
    };
  });

  const practiceRows = practiceModules.map((module) => {
    const item = getTrackModuleProgress(progress, "practice", module.id);
    return {
      id: module.id,
      title: module.title,
      status: item?.status ?? "not_started",
      bestScorePercent: item?.bestScorePercent,
      attemptCount: item?.attemptCount ?? 0,
      lastAttemptAt: item?.lastAttemptAt
    };
  });

  const botRows = PRACTICE_BOT_SCENARIOS.map((scenario) => {
    const item = progress.botScenarios?.find((entry) => entry.scenarioId === scenario.id);
    return {
      id: scenario.id,
      title: scenario.title,
      status: resolveBotScenarioStatus(progress, scenario.id),
      startedAt: item?.startedAt,
      completedAt: item?.completedAt
    };
  });

  const lastActivityAt = pickLatestTimestamp([
    ...progress.products.map((item) => item.lastAttemptAt ?? item.completedAt ?? item.startedAt),
    ...progress.modules.map((item) => item.lastAttemptAt ?? item.completedAt ?? item.startedAt),
    ...(progress.botScenarios ?? []).map((item) => item.completedAt ?? item.startedAt),
    ...progress.attempts.map((item) => item.attemptedAt)
  ]);

  return {
    user: {
      id: user.id,
      login: user.login,
      name: user.name,
      active: user.active
    },
    overview,
    products: productRows,
    crmModules: crmRows,
    practiceModules: practiceRows,
    botScenarios: botRows,
    lastActivityAt
  };
}

export async function listManagerTrainingReports(): Promise<ManagerTrainingReport[]> {
  const { listTraineeUsers } = await import("@/lib/auth/store");
  const trainees = await listTraineeUsers();
  return Promise.all(trainees.map((trainee) => buildManagerTrainingReport(trainee)));
}
