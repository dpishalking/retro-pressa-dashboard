import type { AccessLevel } from "@/types/auth";
import type { ProductTrainingModule, TrainingOverview, TrainingStageOverview } from "@/types/training";

/** Итоговый тест по линейке: живёт в каталоге продуктов, но не является подарком. */
export const FINAL_EXAM_PRODUCT_ID = "final-exam";

export function isFinalExamProduct(product: Pick<ProductTrainingModule, "id"> | string) {
  const id = typeof product === "string" ? product : product.id;
  return id === FINAL_EXAM_PRODUCT_ID;
}

export function splitFinalExam(products: ProductTrainingModule[]) {
  return {
    gifts: products.filter((product) => !isFinalExamProduct(product)),
    finalExam: products.find((product) => isFinalExamProduct(product)) ?? null
  };
}

export function remainingStagesForFinalExam(stages: TrainingStageOverview[]) {
  return stages
    .filter((stage) => stage.id === "products" || stage.id === "crm")
    .filter((stage) => stage.status !== "completed")
    .map((stage) => stage.title);
}

export function canBypassFinalExamLock(accessLevel?: AccessLevel | null) {
  return accessLevel === "admin" || accessLevel === "rop";
}

export function isFinalExamUnlocked(
  overview: Pick<TrainingOverview, "stages">,
  accessLevel?: AccessLevel | null
) {
  if (canBypassFinalExamLock(accessLevel)) return true;
  return remainingStagesForFinalExam(overview.stages).length === 0;
}

export function isOpenEndedQuiz(product: Pick<ProductTrainingModule, "questions">) {
  return product.questions.length > 0 && product.questions.every((question) => question.type === "text");
}

/** Open-ended answers without a key: count as filled if the person wrote a real sentence. */
export const OPEN_TEXT_MIN_LENGTH = 20;
