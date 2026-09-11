import { FINAL_EXAM_PRODUCT_ID, isFinalExamProduct } from "@/lib/training/final-exam";
import { buildTrainingOverview, getTrackModuleProgress } from "@/lib/training/progress";
import {
  getOrCreateUserProgress,
  listProducts,
  resolveProductStatus
} from "@/lib/training/store";
import { listTrackModules } from "@/lib/training/track-modules";
import type { AppUserPublic } from "@/types/auth";
import type { ManagerTrainingReport, UserQuizAttempt } from "@/types/training";

function latestFinalExamAttempt(attempts: UserQuizAttempt[]) {
  return attempts
    .filter((item) => item.productId === FINAL_EXAM_PRODUCT_ID)
    .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt))[0];
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

  const overview = buildTrainingOverview(products, crmModules, progress, practiceModules);
  const giftProducts = products.filter((product) => !isFinalExamProduct(product));
  const finalExamProduct = products.find((product) => isFinalExamProduct(product)) ?? null;
  const latestExamAttempt = latestFinalExamAttempt(progress.attempts);
  const examProgress = progress.products.find((entry) => entry.productId === FINAL_EXAM_PRODUCT_ID);

  const productRows = giftProducts.map((product) => {
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

  const lastActivityAt = pickLatestTimestamp([
    ...progress.products.map((item) => item.lastAttemptAt ?? item.completedAt ?? item.startedAt),
    ...progress.modules.map((item) => item.lastAttemptAt ?? item.completedAt ?? item.startedAt),
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
    finalExam: finalExamProduct
      ? {
          title: finalExamProduct.title,
          status: resolveProductStatus(progress, finalExamProduct.id),
          attemptCount: Math.max(examProgress?.attemptCount ?? 0, latestExamAttempt ? 1 : 0),
          lastAttemptAt: examProgress?.lastAttemptAt ?? latestExamAttempt?.attemptedAt,
          scorePercent: latestExamAttempt?.scorePercent,
          passed: latestExamAttempt?.passed ?? false,
          answers: finalExamProduct.questions.map((question) => {
            const userAnswer = latestExamAttempt?.answers.find((answer) => answer.questionId === question.id);
            const textAnswer = userAnswer?.textAnswer?.trim() ?? "";
            return {
              questionId: question.id,
              question: question.text,
              textAnswer,
              filled: textAnswer.length > 0
            };
          })
        }
      : null,
    products: productRows,
    crmModules: crmRows,
    practiceModules: [],
    botScenarios: [],
    lastActivityAt
  };
}

export async function listManagerTrainingReports(): Promise<ManagerTrainingReport[]> {
  const { listTraineeUsers } = await import("@/lib/auth/store");
  const trainees = await listTraineeUsers();
  return Promise.all(trainees.map((trainee) => buildManagerTrainingReport(trainee)));
}
