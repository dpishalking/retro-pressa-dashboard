import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { findUserById } from "@/lib/auth/store";
import { createTrainingCatalogSeed, trainingUsers, type TrainingCatalog } from "@/data/training-seed";
import { applyGiftSiteImagesToCatalog } from "@/data/training-gifts-content";
import { applySheetContentToCatalog } from "@/data/training-sheet-content";
import type {
  ProductTrainingModule,
  QuizSubmission,
  TrackStageId,
  TrainingOverview,
  TrainingStatus,
  TrainingUser,
  UserQuizAttempt,
  UserTrainingProgress
} from "@/types/training";
import { generateId } from "@/lib/training/id";
import { scoreQuizSubmission } from "@/lib/training/quiz-scoring";
import { buildTrainingOverview, getTrackModuleProgress } from "@/lib/training/progress";
import { findTrackModule, listTrackModules } from "@/lib/training/track-modules";

export { generateId };

const trainingDir = process.env.TRAINING_DATA_DIR?.trim()
  ? path.resolve(process.env.TRAINING_DATA_DIR.trim())
  : path.join(process.cwd(), "data", "training");
const catalogPath = path.join(trainingDir, "products.json");
const progressDir = path.join(trainingDir, "progress");

async function ensureTrainingDirs() {
  await mkdir(progressDir, { recursive: true });
}

function progressFilePath(userId: string) {
  return path.join(progressDir, `${userId}.json`);
}

function decorateTrainingCatalog(catalog: TrainingCatalog): TrainingCatalog {
  return {
    ...catalog,
    products: applyGiftSiteImagesToCatalog(applySheetContentToCatalog(catalog.products))
  };
}

export async function readRawTrainingCatalog(): Promise<TrainingCatalog | null> {
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TrainingCatalog>;
    if (Array.isArray(parsed.products)) {
      return {
        version: 1,
        products: parsed.products as ProductTrainingModule[],
        updatedAt: parsed.updatedAt ?? new Date().toISOString()
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read training catalog:", message);
    }
  }

  return null;
}

export async function readTrainingCatalog(): Promise<TrainingCatalog> {
  const stored = await readRawTrainingCatalog();
  if (stored) {
    return decorateTrainingCatalog(stored);
  }

  const seed = createTrainingCatalogSeed();
  await writeTrainingCatalog(seed);
  return decorateTrainingCatalog(seed);
}

export async function writeTrainingCatalog(catalog: TrainingCatalog) {
  await ensureTrainingDirs();
  const payload = `${JSON.stringify({ ...catalog, version: 1, updatedAt: new Date().toISOString() }, null, 2)}\n`;
  const tempPath = `${catalogPath}.${process.pid}.tmp`;

  try {
    await writeFile(tempPath, payload, "utf8");
    await rename(tempPath, catalogPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown write error";
    throw new Error(`Failed to write training catalog (${catalogPath}): ${message}`);
  }
}

export async function listProducts(): Promise<ProductTrainingModule[]> {
  const catalog = await readTrainingCatalog();
  return [...catalog.products].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getProduct(id: string, options?: { raw?: boolean }): Promise<ProductTrainingModule | null> {
  if (options?.raw) {
    const catalog = await readRawTrainingCatalog();
    return catalog?.products.find((product) => product.id === id) ?? null;
  }

  const products = await listProducts();
  return products.find((product) => product.id === id) ?? null;
}

export async function createProduct(input: Omit<ProductTrainingModule, "createdAt" | "updatedAt">) {
  const catalog = (await readRawTrainingCatalog()) ?? {
    version: 1 as const,
    products: [],
    updatedAt: new Date().toISOString()
  };
  const now = new Date().toISOString();
  const product: ProductTrainingModule = { ...input, createdAt: now, updatedAt: now };
  catalog.products.push(product);
  await writeTrainingCatalog(catalog);
  return product;
}

export async function updateProduct(id: string, patch: Partial<ProductTrainingModule>) {
  const catalog = await readRawTrainingCatalog();
  if (!catalog) return null;

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
  const catalog = await readRawTrainingCatalog();
  if (!catalog) return false;

  const nextProducts = catalog.products.filter((product) => product.id !== id);
  if (nextProducts.length === catalog.products.length) return false;
  catalog.products = nextProducts;
  await writeTrainingCatalog(catalog);
  return true;
}

function createEmptyProgress(userId: string, userName: string): UserTrainingProgress {
  return {
    userId,
    userName,
    products: [],
    modules: [],
    botScenarios: [],
    attempts: []
  };
}

function normalizeProgress(parsed: Partial<UserTrainingProgress>, userId: string): UserTrainingProgress | null {
  if (!Array.isArray(parsed.products) || !Array.isArray(parsed.attempts)) {
    return null;
  }

  return {
    userId,
    userName: parsed.userName ?? userId,
    products: parsed.products,
    modules: Array.isArray(parsed.modules) ? parsed.modules : [],
    botScenarios: Array.isArray(parsed.botScenarios) ? parsed.botScenarios : [],
    attempts: parsed.attempts
  };
}

export async function readUserProgress(userId: string): Promise<UserTrainingProgress | null> {
  try {
    const raw = await readFile(progressFilePath(userId), "utf8");
    const parsed = JSON.parse(raw) as Partial<UserTrainingProgress>;
    const normalized = normalizeProgress(parsed, userId);
    if (normalized) return normalized;
    console.warn("Progress file has invalid shape", { userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return null;
    console.warn("Failed to read progress file", { userId, error: message });
  }
  return null;
}

export async function writeUserProgress(progress: UserTrainingProgress) {
  await ensureTrainingDirs();
  await writeFile(progressFilePath(progress.userId), JSON.stringify(progress, null, 2), "utf8");
}

async function resolveProgressUser(userId: string, userName?: string) {
  const authUser = await findUserById(userId);
  const seedUser = trainingUsers.find((item) => item.id === userId);
  const name = userName ?? authUser?.name ?? seedUser?.name ?? userId;
  return { userId, userName: name };
}

export async function getOrCreateUserProgress(userId: string, userName?: string): Promise<UserTrainingProgress> {
  const existing = await readUserProgress(userId);
  const resolved = await resolveProgressUser(userId, userName);

  if (existing) {
    if (existing.userName !== resolved.userName) {
      existing.userName = resolved.userName;
      await writeUserProgress(existing);
    }
    return existing;
  }

  try {
    await access(progressFilePath(userId));
    console.error("Progress file exists but could not be parsed; refusing to overwrite", { userId });
    return createEmptyProgress(resolved.userId, resolved.userName);
  } catch {
    // File does not exist yet.
  }

  const created = createEmptyProgress(resolved.userId, resolved.userName);
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

export async function markModuleStarted(userId: string, stageId: TrackStageId, moduleId: string) {
  const progress = await getOrCreateUserProgress(userId);
  const existing = getTrackModuleProgress(progress, stageId, moduleId);
  const now = new Date().toISOString();

  if (!existing) {
    progress.modules.push({
      moduleId,
      stageId,
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
  if (submission.moduleId && submission.stageId) {
    return submitModuleQuiz(submission);
  }

  if (!submission.productId) throw new Error("productId or moduleId is required");

  const product = await getProduct(submission.productId);
  if (!product) throw new Error("Product not found");

  const progress = await getOrCreateUserProgress(submission.userId);
  const { attempt, gradedAnswers } = scoreQuizSubmission(product, { ...submission, productId: product.id });

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

async function submitModuleQuiz(submission: QuizSubmission) {
  if (!submission.moduleId || !submission.stageId) {
    throw new Error("moduleId and stageId are required");
  }

  const module = await findTrackModule(submission.moduleId);
  if (!module || module.stageId !== submission.stageId) throw new Error("Module not found");

  const progress = await getOrCreateUserProgress(submission.userId);
  const { attempt, gradedAnswers } = scoreQuizSubmission(module, submission);

  progress.attempts.unshift(attempt);

  const moduleProgress = getTrackModuleProgress(progress, submission.stageId, submission.moduleId);
  const now = attempt.attemptedAt;

  if (!moduleProgress) {
    progress.modules.push({
      moduleId: submission.moduleId,
      stageId: submission.stageId,
      status: attempt.passed ? "completed" : "in_progress",
      startedAt: now,
      completedAt: attempt.passed ? now : undefined,
      lastAttemptAt: now,
      bestScorePercent: attempt.scorePercent,
      attemptCount: 1
    });
  } else {
    moduleProgress.attemptCount += 1;
    moduleProgress.lastAttemptAt = now;
    moduleProgress.bestScorePercent = Math.max(moduleProgress.bestScorePercent ?? 0, attempt.scorePercent);
    if (attempt.passed) {
      moduleProgress.status = "completed";
      moduleProgress.completedAt = moduleProgress.completedAt ?? now;
    } else if (moduleProgress.status === "not_started") {
      moduleProgress.status = "in_progress";
      moduleProgress.startedAt = moduleProgress.startedAt ?? now;
    }
  }

  await writeUserProgress(progress);

  return {
    attempt,
    gradedAnswers,
    module,
    progress
  };
}

export async function getQuizAttempt(userId: string, attemptId: string) {
  const progress = await getOrCreateUserProgress(userId);
  const attempt = progress.attempts.find((item) => item.id === attemptId);
  if (!attempt) return null;

  if (attempt.moduleId && attempt.stageId) {
    const module = await findTrackModule(attempt.moduleId);
    if (!module) return null;
    return {
      attempt,
      module,
      product: null,
      questions: module.questions.map((question) => ({
        question,
        userAnswer: attempt.answers.find((answer) => answer.questionId === question.id) ?? {
          questionId: question.id,
          isCorrect: false
        }
      }))
    };
  }

  if (!attempt.productId) return null;
  const product = await getProduct(attempt.productId);
  if (!product) return null;

  return {
    attempt,
    product,
    module: null,
    questions: product.questions.map((question) => ({
      question,
      userAnswer: attempt.answers.find((answer) => answer.questionId === question.id) ?? {
        questionId: question.id,
        isCorrect: false
      }
    }))
  };
}

export async function getTrainingOverview(userId: string): Promise<TrainingOverview> {
  const [products, crmModules, practiceModules, progress] = await Promise.all([
    listProducts(),
    listTrackModules("crm"),
    listTrackModules("practice"),
    getOrCreateUserProgress(userId)
  ]);
  return buildTrainingOverview(products, crmModules, practiceModules, progress);
}

export async function markBotScenarioStarted(userId: string, scenarioId: string) {
  const progress = await getOrCreateUserProgress(userId);
  const now = new Date().toISOString();
  const scenarios = progress.botScenarios ?? [];
  const existing = scenarios.find((item) => item.scenarioId === scenarioId);

  if (!existing) {
    scenarios.push({
      scenarioId,
      status: "in_progress",
      startedAt: now
    });
  } else if (existing.status === "not_started") {
    existing.status = "in_progress";
    existing.startedAt = existing.startedAt ?? now;
  }

  progress.botScenarios = scenarios;
  await writeUserProgress(progress);
  return progress;
}

export async function markBotScenarioCompleted(userId: string, scenarioId: string) {
  const progress = await getOrCreateUserProgress(userId);
  const now = new Date().toISOString();
  const scenarios = progress.botScenarios ?? [];
  const existing = scenarios.find((item) => item.scenarioId === scenarioId);

  if (!existing) {
    scenarios.push({
      scenarioId,
      status: "completed",
      startedAt: now,
      completedAt: now
    });
  } else {
    existing.status = "completed";
    existing.startedAt = existing.startedAt ?? now;
    existing.completedAt = now;
  }

  progress.botScenarios = scenarios;
  await writeUserProgress(progress);
  return progress;
}

export async function listAllManagerProgress() {
  const { listTraineeUsers } = await import("@/lib/auth/store");
  const [products, crmModules, practiceModules, trainees] = await Promise.all([
    listProducts(),
    listTrackModules("crm"),
    listTrackModules("practice"),
    listTraineeUsers()
  ]);

  const rows = await Promise.all(
    trainees.map(async (trainee) => {
      const progress = await getOrCreateUserProgress(trainee.id, trainee.name);
      return {
        manager: {
          id: trainee.id,
          name: trainee.name,
          role: "manager" as const
        },
        progress,
        overview: buildTrainingOverview(products, crmModules, practiceModules, progress)
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
