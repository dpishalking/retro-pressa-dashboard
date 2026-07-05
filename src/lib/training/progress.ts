import type { ProductTrainingModule, TrainingOverview, UserTrainingProgress } from "@/types/training";

export function buildTrainingOverview(
  products: ProductTrainingModule[],
  progress: UserTrainingProgress
): TrainingOverview {
  const completedProducts = progress.products.filter((item) => item.status === "completed").length;
  const inProgressProducts = progress.products.filter((item) => item.status === "in_progress").length;
  const totalProducts = products.length;
  const notStartedProducts = totalProducts - completedProducts - inProgressProducts;
  const overallPercent = totalProducts ? Math.round((completedProducts / totalProducts) * 100) : 0;
  const passedTests = progress.attempts.filter((attempt) => attempt.passed).length;
  const remainingProductIds = products
    .filter((product) => {
      const item = progress.products.find((entry) => entry.productId === product.id);
      return !item || item.status !== "completed";
    })
    .map((product) => product.id);

  return {
    totalProducts,
    completedProducts,
    inProgressProducts,
    notStartedProducts,
    overallPercent,
    passedTests,
    remainingProductIds
  };
}
