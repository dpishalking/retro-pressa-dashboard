import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { callGeminiGenerateContent } from "@/lib/gemini/client";
import type { ArchitectureDepthReport } from "@/lib/architecture-depth/load";

export type HypothesisStatus = "new" | "testing" | "won" | "miss";

export type ArchitectureHypothesis = {
  id: string;
  where: string;
  fact: string;
  change: string;
  signal: string;
  status: HypothesisStatus;
  createdAt: string;
};

type Store = {
  generatedAt: string | null;
  hypotheses: ArchitectureHypothesis[];
};

const storePath = path.join(process.cwd(), "data", "architecture-depth", "hypotheses.json");

const statuses = new Set<HypothesisStatus>(["new", "testing", "won", "miss"]);

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Store;
    return {
      generatedAt: parsed.generatedAt ?? null,
      hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses : []
    };
  } catch {
    return { generatedAt: null, hypotheses: [] };
  }
}

async function writeStore(store: Store) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function readArchitectureHypotheses() {
  return readStore();
}

export async function setArchitectureHypothesisStatus(id: string, status: HypothesisStatus) {
  if (!statuses.has(status)) throw new Error("Неизвестный статус гипотезы");
  const store = await readStore();
  const hypothesis = store.hypotheses.find((item) => item.id === id);
  if (!hypothesis) throw new Error("Гипотеза не найдена");
  hypothesis.status = status;
  await writeStore(store);
  return store;
}

function funnelText(report: ArchitectureDepthReport) {
  const lines = report.week.sections.map((row) => {
    const share = row.shareOfHero == null ? "—" : `${Math.round(row.shareOfHero * 100)}% от первого экрана`;
    const drop = row.dropFromPrevious == null ? "" : `, обрыв от предыдущего ${Math.round(row.dropFromPrevious * 100)}%`;
    return `${row.index}. ${row.title} (${row.id}): ${row.users} человек, ${share}${drop}`;
  });
  return [
    `Страница: ${report.pageUrl}`,
    "Окно: 7 дней, уникальные пользователи события section_view.",
    ...lines,
    `Клики по кнопке скидки: ${report.week.ctaClicks}`,
    `Старты формы: ${report.week.formStarts}`,
    `Отправки формы: ${report.week.formSubmits}`,
    `Листания карусели подарков: ${report.week.productViews}`,
    report.clarity.available
      ? `Clarity за 3 дня, ${report.clarity.url}: сессии ${report.clarity.sessions}, глубина прокрутки ${report.clarity.scrollDepth ?? "нет цифры"}, мёртвые клики ${report.clarity.deadClicks}, злые клики ${report.clarity.rageClicks}, быстрые возвраты ${report.clarity.quickbackClicks}.`
      : `Clarity: ${report.clarity.message ?? "нет данных"}`
  ].join("\n");
}

function parseHypotheses(text: string, createdAt: string): ArchitectureHypothesis[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  const jsonText = start >= 0 && end > start ? text.slice(start, end + 1) : text.trim();
  const parsed = JSON.parse(jsonText) as Array<{
    where?: string;
    fact?: string;
    change?: string;
    signal?: string;
  }>;
  if (!Array.isArray(parsed)) throw new Error("Gemini вернул не список гипотез");
  return parsed.slice(0, 3).map((item) => ({
    id: crypto.randomUUID(),
    where: String(item.where ?? "").trim(),
    fact: String(item.fact ?? "").trim(),
    change: String(item.change ?? "").trim(),
    signal: String(item.signal ?? "").trim(),
    status: "new" as const,
    createdAt
  })).filter((item) => item.where && item.fact && item.change && item.signal);
}

export async function generateArchitectureHypotheses(report: ArchitectureDepthReport) {
  if (!report.canHypothesize) {
    throw new Error(report.hypothesisNote);
  }

  const response = await callGeminiGenerateContent({
    systemInstruction: {
      parts: [{
        text: "Ты разбираешь лендинг Retro Pressa. Пиши по-русски, коротко, только из переданных цифр. Не выдумывай проценты и не предлагай больше трёх гипотез. Верни только JSON-массив."
      }]
    },
    contents: [{
      role: "user",
      parts: [{
        text: `${funnelText(report)}

Верни JSON-массив от 1 до 3 объектов:
{"where":"блок, где обрыв","fact":"одна фраза с цифрой из данных","change":"одно изменение на странице","signal":"какая цифра должна вырасти"}
Самый большой обрыв — первой гипотезой. Если Clarity пустой, не упоминай клики и записи.`
      }]
    }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
  });

  const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini не вернул гипотезы");
  const createdAt = new Date().toISOString();
  const hypotheses = parseHypotheses(text, createdAt);
  if (!hypotheses.length) throw new Error("Не удалось разобрать гипотезы");
  const store = { generatedAt: createdAt, hypotheses };
  await writeStore(store);
  return store;
}
