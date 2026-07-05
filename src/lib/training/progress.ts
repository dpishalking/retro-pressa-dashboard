import type {
  ProductTrainingModule,
  QuizQuestion,
  TrainingOverview,
  TrainingStageOverview,
  TrainingStatus,
  TrainingTrackModule,
  TrackModuleProgress,
  TrackStageId,
  UserTrainingProgress
} from "@/types/training";
import { TRAINING_STAGES } from "@/lib/training/stages";

function stageStatus(completed: number, inProgress: number, total: number): TrainingStatus {
  if (total === 0 || completed >= total) return completed > 0 && completed >= total ? "completed" : "not_started";
  if (completed >= total) return "completed";
  if (completed > 0 || inProgress > 0) return "in_progress";
  return "not_started";
}

function trackStageStats(
  modules: TrainingTrackModule[],
  progress: UserTrainingProgress,
  stageId: TrackStageId
): Pick<TrainingStageOverview, "totalModules" | "completedModules" | "inProgressModules" | "percent" | "status"> {
  const stageModules = modules.filter((item) => item.stageId === stageId);
  const total = stageModules.length;
  let completed = 0;
  let inProgress = 0;

  for (const module of stageModules) {
    const item = progress.modules?.find((entry) => entry.moduleId === module.id && entry.stageId === stageId);
    if (item?.status === "completed") completed += 1;
    else if (item?.status === "in_progress") inProgress += 1;
  }

  const percent = total ? Math.round((completed / total) * 100) : 0;
  return {
    totalModules: total,
    completedModules: completed,
    inProgressModules: inProgress,
    percent,
    status: stageStatus(completed, inProgress, total)
  };
}

export function buildTrainingOverview(
  products: ProductTrainingModule[],
  crmModules: TrainingTrackModule[],
  practiceModules: TrainingTrackModule[],
  progress: UserTrainingProgress
): TrainingOverview {
  const completedProducts = progress.products.filter((item) => item.status === "completed").length;
  const inProgressProducts = progress.products.filter((item) => item.status === "in_progress").length;
  const totalProducts = products.length;
  const notStartedProducts = totalProducts - completedProducts - inProgressProducts;
  const productsPercent = totalProducts ? Math.round((completedProducts / totalProducts) * 100) : 0;
  const passedTests = progress.attempts.filter((attempt) => attempt.passed).length;
  const remainingProductIds = products
    .filter((product) => {
      const item = progress.products.find((entry) => entry.productId === product.id);
      return !item || item.status !== "completed";
    })
    .map((product) => product.id);

  const crmStats = trackStageStats(crmModules, progress, "crm");
  const practiceStats = trackStageStats(practiceModules, progress, "practice");

  const stages: TrainingStageOverview[] = TRAINING_STAGES.map((stage) => {
    if (stage.id === "products") {
      return {
        id: stage.id,
        title: stage.title,
        description: stage.description,
        href: stage.href,
        totalModules: totalProducts,
        completedModules: completedProducts,
        inProgressModules: inProgressProducts,
        percent: productsPercent,
        status: stageStatus(completedProducts, inProgressProducts, totalProducts)
      };
    }
    if (stage.id === "crm") {
      return { id: stage.id, title: stage.title, description: stage.description, href: stage.href, ...crmStats };
    }
    return { id: stage.id, title: stage.title, description: stage.description, href: stage.href, ...practiceStats };
  });

  const totalUnits =
    totalProducts + crmStats.totalModules + practiceStats.totalModules;
  const completedUnits =
    completedProducts + crmStats.completedModules + practiceStats.completedModules;
  const totalStagesPercent = totalUnits ? Math.round((completedUnits / totalUnits) * 100) : 0;

  return {
    totalProducts,
    completedProducts,
    inProgressProducts,
    notStartedProducts,
    overallPercent: productsPercent,
    passedTests,
    remainingProductIds,
    stages,
    totalStagesPercent
  };
}

export function getTrackModuleProgress(
  progress: UserTrainingProgress,
  stageId: TrackStageId,
  moduleId: string
): TrackModuleProgress | undefined {
  return progress.modules?.find((item) => item.moduleId === moduleId && item.stageId === stageId);
}

export function resolveTrackModuleStatus(
  progress: UserTrainingProgress,
  stageId: TrackStageId,
  moduleId: string
): TrainingStatus {
  return getTrackModuleProgress(progress, stageId, moduleId)?.status ?? "not_started";
}

export type QuizScorable = {
  id: string;
  passingScore: number;
  questions: QuizQuestion[];
};
