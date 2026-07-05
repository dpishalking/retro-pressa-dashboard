import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTrainingCatalogSeed, trainingUsers, type TrainingCatalog } from "@/data/training-seed";
import { applyGiftSiteImagesToCatalog } from "@/data/training-gifts-content";
import { applySheetContentToCatalog } from "@/data/training-sheet-content";
import type {
  ProductTrainingModule,
  QuizSubmission,
  TrainingOverview,
  TrainingStatus,
  TrainingUser,
  UserQuizAttempt,
  UserTrainingProgress
} from "@/types/training";
import { generateId } from "@/lib/training/id";
import { scoreQuizSubmission } from "@/lib/training/quiz-scoring";
import { buildTrainingOverview } from "@/lib/training/progress";

export { generateId };

const trainingDir = path.join(process.cwd(), "data", "training");
const catalogPath = path.join(trainingDir, "products.json");
const progressDir = path.join(trainingDir, "progress");

async function ensureTrainingDirs() {
  await mkdir(progressDir, { recursive: true });
}

function progressFilePath(userId: string) {
  return path.join(progressDir, `${userId}.json`);
}

export async function readTrainingCatalog(): Promise<TrainingCatalog> {
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TrainingCatalog>;
    if (parsed?.version === 1 && Array.isArray(parsed.products)) {
      return {
        ...(parsed as TrainingCatalog),
        products: applyGiftSiteImagesToCatalog(
          applySheetContentToCatalog(parsed.products as ProductTrainingModule[])
        )
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read training catalog, using seed:", message);
    }
  }

  const seed = createTrainingCatalogSeed();
  await writeTrainingCatalog(seed);
  return seed;
}

export async function writeTrainingCatalog(catalog: TrainingCatalog) {
  await ensureTrainingDirs();
  await writeFile(catalogPath, JSON.stringify({ ...catalog, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export async function listProducts(): Promise<ProductTrainingModule[]> {
  const catalog = await readTrainingCatalog();
  return [...catalog.products].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getProduct(id: string): Promise<ProductTrainingModule | null> {
  const products = await listProducts();
  return products.find((product) => product.id === id) ?? null;
}

export async function createProduct(input: Omit<ProductTrainingModule, "createdAt" | "updatedAt">) {
  const catalog = await readTrainingCatalog();
  const now = new Date().toISOString();
  const product: ProductTrainingModule = { ...input, createdAt: now, updatedAt: now };
  catalog.products.push(product);
  await writeTrainingCatalog(catalog);
  return product;
}

export async function updateProduct(id: string, patch: Partial<ProductTrainingModule>) {
  const catalog = await readTrainingCatalog();
  const index = catalog.products.findIndex((product) => product.id === id);
  if (index === -1) return null;

  const updated: ProductTrainingModule = {
    ...catalog.products[index],
    ...patch,
    id,
    updatedAt: new Date().toISOString()
  };
  catalog.products[index] = updated;
  await writeTrainingCatalog(catalog);
  return updated;
}

export async function deleteProduct(id: string) {
  const catalog = await readTrainingCatalog();
  const nextProducts = catalog.products.filter((product) => product.id !== id);
  if (nextProducts.length === catalog.products.length) return false;
  catalog.products = nextProducts;
  await writeTrainingCatalog(catalog);
  return true;
}

function createEmptyProgress(user: TrainingUser): UserTrainingProgress {
  return {
    userId: user.id,
    userName: user.name,
    products: [],
    attempts: []
  };
}

export async function readUserProgress(userId: string): Promise<UserTrainingProgress | null> {
  try {
    const raw = await readFile(progressFilePath(userId), "utf8");
    const parsed = JSON.parse(raw) as Partial<UserTrainingProgress>;
    if (parsed?.userId === userId && Array.isArray(parsed.products) && Array.isArray(parsed.attempts)) {
      return parsed as UserTrainingProgress;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return null;
  }
  return null;
}

export async function writeUserProgress(progress: UserTrainingProgress) {
  await ensureTrainingDirs();
  await writeFile(progressFilePath(progress.userId), JSON.stringify(progress, null, 2), "utf8");
}

export async function getOrCreateUserProgress(userId: string): Promise<UserTrainingProgress> {
  const user = trainingUsers.find((item) => item.id === userId);
  if (!user) throw new Error("User not found");

  const existing = await readUserProgress(userId);
  if (existing) return existing;

  const created = createEmptyProgress(user);
  await writeUserProgress(created);
  return created;
}

export function getProductProgress(
  progress: UserTrainingProgress,
  productId: string
): UserTrainingProgress["products"][number] | undefined {
  return progress.products.find((item) => item.productId === productId);
}

export function resolveProductStatus(progress: UserTrainingProgress, productId: string): TrainingStatus {
  return getProductProgress(progress, productId)?.status ?? "not_started";
}

export async function markProductStarted(userId: string, productId: string) {
  const progress = await getOrCreateUserProgress(userId);
  const existing = getProductProgress(progress, productId);
  const now = new Date().toISOString();

  if (!existing) {
    progress.products.push({
      productId,
      status: "in_progress",
      startedAt: now,
      attemptCount: 0
    });
  } else if (existing.status === "not_started") {
    existing.status = "in_progress";
    existing.startedAt = existing.startedAt ?? now;
  }

  await writeUserProgress(progress);
  return progress;
}

export async function submitQuiz(submission: QuizSubmission) {
  const product = await getProduct(submission.productId);
  if (!product) throw new Error("Product not found");

  const progress = await getOrCreateUserProgress(submission.userId);
  const { attempt, gradedAnswers } = scoreQuizSubmission(product, submission);

  progress.attempts.unshift(attempt);

  const productProgress = getProductProgress(progress, submission.productId);
  const now = attempt.attemptedAt;

  if (!productProgress) {
    progress.products.push({
      productId: submission.productId,
      status: attempt.passed ? "completed" : "in_progress",
      startedAt: now,
      completedAt: attempt.passed ? now : undefined,
      lastAttemptAt: now,
      bestScorePercent: attempt.scorePercent,
      attemptCount: 1
    });
  } else {
    productProgress.attemptCount += 1;
    productProgress.lastAttemptAt = now;
    productProgress.bestScorePercent = Math.max(productProgress.bestScorePercent ?? 0, attempt.scorePercent);
    if (attempt.passed) {
      productProgress.status = "completed";
      productProgress.completedAt = productProgress.completedAt ?? now;
    } else if (productProgress.status === "not_started") {
      productProgress.status = "in_progress";
      productProgress.startedAt = productProgress.startedAt ?? now;
    }
  }

  await writeUserProgress(progress);

  return {
    attempt,
    gradedAnswers,
    product,
    progress
  };
}

export async function getQuizAttempt(userId: string, attemptId: string) {
  const progress = await getOrCreateUserProgress(userId);
  const attempt = progress.attempts.find((item) => item.id === attemptId);
  if (!attempt) return null;

  const product = await getProduct(attempt.productId);
  if (!product) return null;

  return {
    attempt,
    product,
    questions: product.questions.map((question) => ({
      question,
      userAnswer: attempt.answers.find((answer) => answer.questionId === question.id)!
    }))
  };
}

export async function getTrainingOverview(userId: string): Promise<TrainingOverview> {
  const [products, progress] = await Promise.all([listProducts(), getOrCreateUserProgress(userId)]);
  return buildTrainingOverview(products, progress);
}

export async function listAllManagerProgress() {
  const products = await listProducts();
  const managers = trainingUsers.filter((user) => user.role === "manager");
  const rows = await Promise.all(
    managers.map(async (manager) => {
      const progress = await getOrCreateUserProgress(manager.id);
      return {
        manager,
        progress,
        overview: buildTrainingOverview(products, progress)
      };
    })
  );
  return rows;
}

export function listTrainingUsers() {
  return trainingUsers;
}

export function getTrainingUser(userId: string) {
  return trainingUsers.find((user) => user.id === userId) ?? null;
}
