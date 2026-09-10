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

export function isFinalExamUnlocked(overview: Pick<TrainingOverview, "stages">) {
  return remainingStagesForFinalExam(overview.stages).length === 0;
}
