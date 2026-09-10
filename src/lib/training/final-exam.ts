import type { ProductTrainingModule } from "@/types/training";

/** Итоговый тест по всей линейке: живёт в каталоге продуктов, но не является подарком. */
export const FINAL_EXAM_PRODUCT_ID = "final-exam";

export function isFinalExamProduct(product: Pick<ProductTrainingModule, "id">) {
  return product.id === FINAL_EXAM_PRODUCT_ID;
}

export function splitFinalExam(products: ProductTrainingModule[]) {
  return {
    gifts: products.filter((product) => !isFinalExamProduct(product)),
    finalExam: products.find((product) => isFinalExamProduct(product)) ?? null
  };
}

/** Балл, который нужно набрать по остальным этапам, чтобы открыть финальный тест. */
export function requiredStageScore(gifts: ProductTrainingModule[], fallback = 80) {
  return gifts.length ? Math.min(...gifts.map((product) => product.passingScore)) : fallback;
}
