import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateId } from "@/lib/training/id";
import { readKnowledgeBaseCatalog, saveKnowledgeBaseCatalog } from "@/lib/training/knowledge-base";
import type {
  ManagerQuestion,
  ManagerQuestionSource,
  ManagerQuestionsStore,
  ManagerQuestionsSummary,
  ManagerQuestionStatus
} from "@/types/training";

const UNCATEGORIZED_LABEL = "Без категории";
const TOP_QUESTIONS_LIMIT = 20;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const trainingDir = process.env.TRAINING_DATA_DIR?.trim()
  ? path.resolve(process.env.TRAINING_DATA_DIR.trim())
  : path.join(process.cwd(), "data", "training");

const storePath = path.join(trainingDir, "manager-questions.json");

const QUESTION_WORDS = [
  "как",
  "что",
  "где",
  "когда",
  "почему",
  "зачем",
  "сколько",
  "какой",
  "какая",
  "какие",
  "можно ли",
  "подскажите",
  "подскажет",
  "не понимаю",
  "не понятно",
  "непонятно"
];

/** Грубая эвристика: похоже ли сообщение на вопрос менеджера. */
export function looksLikeQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("?")) return true;
  return QUESTION_WORDS.some((word) => normalized.includes(word));
}

function normalizeForDedup(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function emptyStore(): ManagerQuestionsStore {
  return { version: 1, questions: [] };
}

function normalizeStatus(value: unknown): ManagerQuestionStatus {
  return value === "clustered" || value === "answered" || value === "ignored" ? value : "new";
}

function normalizeSource(value: unknown): ManagerQuestionSource {
  return value === "manual" ? "manual" : "telegram";
}

function normalizeQuestion(entry: Partial<ManagerQuestion>): ManagerQuestion | null {
  const text = entry.text?.trim();
  if (!text) return null;
  const now = new Date().toISOString();

  return {
    id: entry.id?.trim() || generateId("mq"),
    source: normalizeSource(entry.source),
    text,
    authorName: entry.authorName?.trim() || undefined,
    authorId: entry.authorId?.trim() || undefined,
    chatId: entry.chatId?.trim() || undefined,
    messageId: entry.messageId?.trim() || undefined,
    category: entry.category?.trim() || undefined,
    status: normalizeStatus(entry.status),
    occurrences: typeof entry.occurrences === "number" && entry.occurrences > 0 ? entry.occurrences : 1,
    createdAt: entry.createdAt?.trim() || now,
    lastSeenAt: entry.lastSeenAt?.trim() || entry.createdAt?.trim() || now
  };
}

async function readStoreFile(): Promise<ManagerQuestionsStore | null> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ManagerQuestionsStore>;
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((entry) => normalizeQuestion(entry))
          .filter((entry): entry is ManagerQuestion => entry !== null)
      : [];
    return { version: 1, questions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read manager questions store:", message);
    }
    return null;
  }
}

async function writeStoreFile(store: ManagerQuestionsStore) {
  await mkdir(trainingDir, { recursive: true });
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  const tempPath = `${storePath}.${process.pid}.tmp`;
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, storePath);
}

export async function readManagerQuestions(): Promise<ManagerQuestionsStore> {
  return (await readStoreFile()) ?? emptyStore();
}

export type CollectManagerQuestionInput = {
  text: string;
  source?: ManagerQuestionSource;
  authorName?: string;
  authorId?: string;
  chatId?: string;
  messageId?: string;
};

export type CollectManagerQuestionResult = {
  question: ManagerQuestion;
  deduplicated: boolean;
};

/**
 * Накапливает вопрос в бэклоге. Если такой же текст уже есть — увеличивает счётчик
 * повторов и обновляет lastSeenAt, а не создаёт дубликат.
 */
export async function collectManagerQuestion(
  input: CollectManagerQuestionInput
): Promise<CollectManagerQuestionResult> {
  const store = await readManagerQuestions();
  const now = new Date().toISOString();
  const dedupKey = normalizeForDedup(input.text);

  const existing = store.questions.find((item) => normalizeForDedup(item.text) === dedupKey);
  if (existing) {
    existing.occurrences += 1;
    existing.lastSeenAt = now;
    await writeStoreFile(store);
    return { question: existing, deduplicated: true };
  }

  const question = normalizeQuestion({
    source: input.source,
    text: input.text,
    authorName: input.authorName,
    authorId: input.authorId,
    chatId: input.chatId,
    messageId: input.messageId,
    createdAt: now,
    lastSeenAt: now
  });

  if (!question) {
    throw new Error("Question text is required");
  }

  store.questions.unshift(question);
  await writeStoreFile(store);
  return { question, deduplicated: false };
}

/**
 * Сводка для BI-витрины: только агрегаты, без сырого потока.
 */
export function summarizeManagerQuestions(store: ManagerQuestionsStore): ManagerQuestionsSummary {
  const questions = store.questions;
  const weekAgo = Date.now() - WEEK_MS;

  const byStatus: Record<ManagerQuestionStatus, number> = {
    new: 0,
    clustered: 0,
    answered: 0,
    ignored: 0
  };

  const categoryMap = new Map<string, { count: number; occurrences: number }>();
  let totalOccurrences = 0;
  let newThisWeek = 0;

  for (const question of questions) {
    byStatus[question.status] += 1;
    totalOccurrences += question.occurrences;

    if (new Date(question.createdAt).getTime() >= weekAgo) {
      newThisWeek += 1;
    }

    const label = question.category?.trim() || UNCATEGORIZED_LABEL;
    const bucket = categoryMap.get(label) ?? { count: 0, occurrences: 0 };
    bucket.count += 1;
    bucket.occurrences += question.occurrences;
    categoryMap.set(label, bucket);
  }

  const topQuestions = [...questions]
    .sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    })
    .slice(0, TOP_QUESTIONS_LIMIT)
    .map((question) => ({
      id: question.id,
      text: question.text,
      occurrences: question.occurrences,
      status: question.status,
      category: question.category,
      lastSeenAt: question.lastSeenAt
    }));

  const categories = [...categoryMap.entries()]
    .map(([category, value]) => ({ category, count: value.count, occurrences: value.occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences);

  return {
    total: questions.length,
    totalOccurrences,
    newThisWeek,
    unanswered: byStatus.new + byStatus.clustered,
    answeredByKnowledgeBase: byStatus.answered,
    byStatus,
    topQuestions,
    categories
  };
}

export type UpdateManagerQuestionInput = {
  status?: ManagerQuestionStatus;
  category?: string;
};

export async function updateManagerQuestion(
  id: string,
  patch: UpdateManagerQuestionInput
): Promise<ManagerQuestion | null> {
  const store = await readManagerQuestions();
  const question = store.questions.find((item) => item.id === id);
  if (!question) return null;

  if (patch.status) {
    question.status = normalizeStatus(patch.status);
  }
  if (patch.category !== undefined) {
    question.category = patch.category.trim() || undefined;
  }

  await writeStoreFile(store);
  return question;
}

export type PromoteManagerQuestionInput = {
  questionId: string;
  answer: string;
  category?: string;
};

export async function promoteManagerQuestionToKnowledgeBase(input: PromoteManagerQuestionInput) {
  const answer = input.answer.trim();
  if (!answer) {
    throw new Error("Answer is required");
  }

  const store = await readManagerQuestions();
  const question = store.questions.find((item) => item.id === input.questionId);
  if (!question) {
    throw new Error("Question not found");
  }

  const catalog = await readKnowledgeBaseCatalog();
  const category = input.category?.trim() || question.category?.trim() || undefined;
  const entry = {
    id: generateId("kb"),
    question: question.text,
    answer,
    category,
    mediaType: "none" as const,
    sortOrder: catalog.entries.length + 1
  };

  const nextCatalog = await saveKnowledgeBaseCatalog({
    ...catalog,
    entries: [...catalog.entries, entry]
  });

  question.status = "answered";
  if (category) {
    question.category = category;
  }
  await writeStoreFile(store);

  return { question, entry, catalog: nextCatalog };
}
