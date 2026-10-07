import { readFile } from "node:fs/promises";
import path from "node:path";
import crmSeed from "../../../data/training/crm-modules.json";
import materialsSeed from "../../../data/training/client-materials.json";
import practiceSeed from "../../../data/training/practice-modules.json";
import productsSeed from "../../../data/training/products.json";
import reviewSeed from "../../../data/training/client-review-videos.json";
import { ZABKOVA_SITUATIONS } from "@/lib/training/zabkova-close";
import { readRawTrainingCatalog } from "@/lib/training/store";
import type { KnowledgeSection } from "@/lib/manager-qa/knowledge";
import { MANAGER_KNOWLEDGE, rankKnowledgeSections } from "@/lib/manager-qa/knowledge";

type NamedLink = { label: string; url: string };
type ConditionalName = { name: string; label: string; ifIncludes?: string };

export type ProductRule = {
  id: string;
  phrases: string[];
  cards: ConditionalName[];
  categories: ConditionalName[];
};

export type CorpusMaterial = {
  title?: string;
  description?: string;
  category?: string;
  type?: string;
  url?: string;
  content?: string;
  sectionKey?: string;
};

export type CorpusProduct = {
  id: string;
  title: string;
  shortDescription?: string;
  description?: string;
  targetAudience?: string;
  objections?: string;
  presentationGuide?: string;
  purchaseReasons?: string;
  materials?: CorpusMaterial[];
};

export type CorpusModule = {
  id: string;
  title: string;
  shortDescription?: string;
  sections?: Array<{ title?: string; content?: string }>;
};

export type ManagerCorpus = {
  sections: KnowledgeSection[];
  products: CorpusProduct[];
  materials: CorpusMaterial[];
  genericReviews: NamedLink[];
};

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://rp-bi.site").replace(/\/$/, "");

export const PRODUCT_RULES: ProductRule[] = [
  {
    id: "personal-magazine",
    phrases: ["книга жизни в заголовках", "в заголовках газет", "заголовках газет"],
    cards: [{ name: "life-book", label: "Книга жизни в заголовках газет" }],
    categories: []
  },
  {
    id: "life-story",
    phrases: ["книга жизни", "история жизни", "историю жизни"],
    cards: [{ name: "life-story", label: "Книга жизни" }],
    categories: [{ name: "Книга жизни", label: "Книга жизни" }]
  },
  {
    id: "original-magazine-page-posters",
    phrases: ["постер", "журнальной страницы", "журнальная страница"],
    cards: [{ name: "original-magazine-page-posters", label: "Постер из оригинальной журнальной страницы" }],
    categories: [{ name: "Постер из оригинальной журнальной страницы", label: "Постер" }]
  },
  {
    id: "retro-newspaper",
    phrases: ["поздравительная газета", "поздравительную газету", "поздравительный журнал", "поздравительного журнала", "ретро-газета", "ретро газета"],
    cards: [
      { name: "congratulatory-newspaper", label: "Поздравительная газета", ifIncludes: "газет" },
      { name: "congratulatory-magazine", label: "Поздравительный журнал", ifIncludes: "журнал" }
    ],
    categories: [
      { name: "Поздравительная газета", label: "Поздравительная газета", ifIncludes: "газет" },
      { name: "Поздравительный журнал", label: "Поздравительный журнал", ifIncludes: "журнал" }
    ]
  },
  {
    id: "glossy-magazine",
    phrases: ["глянцевый журнал", "глянцевый персональный", "журнал о человеке", "персонализированный журнал", "глянц"],
    cards: [{ name: "personal-magazine", label: "Журнал о человеке" }],
    categories: [{ name: "Персонализированный журнал", label: "Персонализированный журнал" }]
  },
  {
    id: "gift-edition",
    phrases: ["party page", "парти пейдж", "персонализированная газета", "персонализированную газету"],
    cards: [],
    categories: [{ name: "Персонализированная газета", label: "Персонализированная газета" }]
  },
  {
    id: "family-card-deck",
    phrases: ["колода карт", "колоду карт", "семейная колода", "семейные карты"],
    cards: [{ name: "family-card-deck", label: "Семейная колода карт" }],
    categories: []
  },
  {
    id: "family-edition",
    phrases: ["семейное издание", "семейного издания", "семейный журнал"],
    cards: [{ name: "family-edition", label: "Семейное издание" }],
    categories: [{ name: "Семейное издание", label: "Семейное издание" }]
  },
  {
    id: "congratulatory-song",
    phrases: ["поздравительная песня", "поздравительную песню", "песня"],
    cards: [{ name: "congratulatory-song", label: "Поздравительная песня" }],
    categories: [{ name: "Поздравительная песня", label: "Поздравительная песня" }]
  },
  {
    id: "stickers",
    phrases: ["наклейк"],
    cards: [],
    categories: [{ name: "Наклейка", label: "Наклейки" }]
  },
  {
    id: "ozivi",
    phrases: ["оживи", "оживление фото", "оживить фото"],
    cards: [],
    categories: [{ name: "Оживи", label: "Оживи" }]
  },
  {
    id: "pervoe-pismo",
    phrases: ["первое письмо", "первого письма", "письмо о рождении"],
    cards: [{ name: "pervoe-pismo", label: "Первое письмо" }],
    categories: []
  },
  {
    id: "personal-newspaper",
    phrases: ["газета из дня", "из важной даты", "издание из даты", "газета из даты", "оригинальная газета", "оригинальные газеты", "оригинальный журнал", "оригинальные журналы"],
    cards: [
      { name: "original", label: "Оригинал — газета из даты", ifIncludes: "газет" },
      { name: "original-magazines", label: "Оригинальные журналы", ifIncludes: "журнал" }
    ],
    categories: [{ name: "Оригинал", label: "Оригинал" }]
  }
];

function norm(value: string): string {
  return value.toLowerCase().replaceAll("ё", "е");
}

function tokenStem(word: string): string {
  if (word.length <= 4) return word;
  if (word.length <= 6) return word.slice(0, word.length - 1);
  return word.slice(0, 5);
}

function stemPhrase(value: string): string {
  return norm(value)
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length >= 4)
    .map(tokenStem)
    .join(" ");
}

export function matchProductRules(question: string, rules: ProductRule[] = PRODUCT_RULES): ProductRule[] {
  const q = stemPhrase(question);
  const hits = rules.flatMap((rule) => {
    const phrase = rule.phrases
      .map((item) => stemPhrase(item))
      .filter((item) => item && q.includes(item))
      .sort((left, right) => right.length - left.length)[0];
    return phrase ? [{ rule, phrase }] : [];
  });

  const kept = hits.filter((hit) => !hits.some((other) => other.phrase.length > hit.phrase.length && other.phrase.includes(hit.phrase)));
  const seen = new Set<string>();
  return kept.filter((hit) => {
    if (seen.has(hit.rule.id)) return false;
    seen.add(hit.rule.id);
    return true;
  }).map((hit) => hit.rule);
}

function selectedNames(question: string, items: ConditionalName[]): ConditionalName[] {
  if (items.length === 0) return [];
  const q = norm(question);
  const conditional = items.filter((item) => item.ifIncludes);
  const matched = conditional.filter((item) => q.includes(norm(item.ifIncludes || "")));
  if (matched.length > 0) {
    return [...matched, ...items.filter((item) => !item.ifIncludes)];
  }
  return items;
}

export function wantsAssetLinks(question: string): boolean {
  return /ссылк|отзыв|скинь|пришли|видеоотзыв|материалы по|материал по|фото по|фото для|картинк|покажи фото|покажи отзыв|покажи видео/.test(norm(question));
}

export function asksOperationalFact(question: string): boolean {
  return /сколько|стоит|срок|как |куда |почему|реквизит|доставк|что говорить|возражен|оплат|счет|счёт/.test(norm(question));
}

export function absoluteUrl(url: string): string {
  const value = url.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${APP_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
}

function isReview(material: CorpusMaterial): boolean {
  return material.sectionKey === "reviews" || /отзыв/i.test(material.title || "");
}

function isManagerOnly(material: CorpusMaterial): boolean {
  return /менеджер/i.test(material.title || "");
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

function priceLines(product: CorpusProduct): string[] {
  const source = [product.shortDescription, product.description, product.presentationGuide, product.objections, product.purchaseReasons]
    .filter(Boolean)
    .join("\n");
  const lines = source
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => /€|eur|евро|руб|byn|стоит|цена/i.test(line));
  return [...new Set(lines)].slice(0, 12);
}

export function buildProductSections(products: CorpusProduct[]): KnowledgeSection[] {
  return products
    .filter((product) => product.id !== "final-exam")
    .map((product) => {
      const rule = PRODUCT_RULES.find((item) => item.id === product.id);
      const keywords = [...new Set((rule?.phrases ?? [product.title]).flatMap((phrase) => phrase.split(/\s+/)).filter((word) => word.length >= 4))];
      const prices = priceLines(product);
      const text = [
        product.title,
        product.shortDescription || "",
        prices.length ? `Цифры из карточки:\n${prices.join("\n")}` : "",
        product.objections ? `Возражения:\n${clip(product.objections, 1500)}` : "",
        product.presentationGuide ? `Как говорить:\n${clip(product.presentationGuide, 1800)}` : "",
        product.description ? `Описание:\n${clip(product.description, 1200)}` : "",
        product.targetAudience ? `Кому:\n${clip(product.targetAudience, 400)}` : ""
      ].filter(Boolean).join("\n\n");
      return {
        id: `product-${product.id}`,
        title: product.title,
        keywords,
        text
      };
    });
}

function plain(text: string): string {
  return text.replace(/\*/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

export function buildModuleSections(modules: CorpusModule[], prefix: string): KnowledgeSection[] {
  return modules.map((module) => {
    const body = (module.sections || [])
      .map((section) => `${section.title || ""}\n${plain(section.content || "")}`.trim())
      .filter(Boolean)
      .join("\n\n");
    const keywords = module.title.split(/\s+/).filter((word) => word.length >= 5);
    return {
      id: `${prefix}-${module.id}`,
      title: module.title,
      keywords,
      text: [module.shortDescription || "", body].filter(Boolean).join("\n\n")
    };
  });
}

export function zabkovaSection(): KnowledgeSection {
  const text = ZABKOVA_SITUATIONS.map((situation) => [
    situation.label,
    `Клиент: ${situation.client}`,
    situation.why,
    situation.script,
    situation.live
  ].join("\n")).join("\n\n");
  return {
    id: "zabkova",
    title: "Как продавали Забковы",
    keywords: ["забков", "оформить", "скрипт", "закрыть", "бронировать"],
    text
  };
}

export function pickSections(question: string, sections: KnowledgeSection[], rules: ProductRule[] = matchProductRules(question)): KnowledgeSection[] {
  const ranked = rankKnowledgeSections(question, sections, 3);
  const deliveryAsked = /достав/.test(question.toLowerCase().replaceAll("ё", "е"));
  const forcedTopics = deliveryAsked
    ? ["delivery", "timing"].flatMap((id) => {
        const section = sections.find((item) => item.id === id);
        return section ? [section] : [];
      })
    : [];
  const forced = rules
    .map((rule) => sections.find((section) => section.id === `product-${rule.id}`))
    .filter((section): section is KnowledgeSection => Boolean(section));
  const merged = [...forcedTopics, ...forced];
  for (const section of ranked) {
    if (!merged.some((item) => item.id === section.id)) merged.push(section);
  }
  return merged.slice(0, 4);
}

type LinkBuckets = {
  title: string;
  cards: NamedLink[];
  reviews: NamedLink[];
  photos: NamedLink[];
  videos: NamedLink[];
  documents: NamedLink[];
  training?: NamedLink;
};

function pushUnique(bucket: NamedLink[], item: NamedLink) {
  if (!item.url || bucket.some((existing) => existing.url === item.url)) return;
  bucket.push(item);
}

function materialLabel(material: CorpusMaterial): string {
  const title = material.title?.trim() || "Материал";
  const description = material.description?.trim() || "";
  if (!description || description === title || description.length > 90) return title;
  return `${title} — ${description}`;
}

function bucketsFor(question: string, rule: ProductRule, corpus: ManagerCorpus): LinkBuckets {
  const product = corpus.products.find((item) => item.id === rule.id);
  const buckets: LinkBuckets = {
    title: product?.title || rule.cards[0]?.label || rule.id,
    cards: [],
    reviews: [],
    photos: [],
    videos: [],
    documents: [],
    training: product ? { label: "Карточка в обучении", url: absoluteUrl(`/training/products/${product.id}`) } : undefined
  };

  for (const card of selectedNames(question, rule.cards)) {
    pushUnique(buckets.cards, { label: card.label, url: absoluteUrl(`/cards/${card.name}`) });
  }

  const categories = new Set(selectedNames(question, rule.categories).map((item) => item.name));
  if (norm(question).includes("упаков")) categories.add("Упаковка");

  const own = product?.materials || [];
  const shared = corpus.materials.filter((material) => categories.has(material.category || ""));
  for (const material of [...own, ...shared]) {
    const url = material.url?.trim();
    if (!url || material.type === "text") continue;
    const link = { label: materialLabel(material), url: absoluteUrl(url) };
    if (isReview(material)) pushUnique(buckets.reviews, link);
    else if (isManagerOnly(material)) pushUnique(buckets.videos, link);
    else if (material.type === "image") pushUnique(buckets.photos, link);
    else if (material.type === "document") pushUnique(buckets.documents, link);
    else if (material.type === "video") pushUnique(buckets.videos, link);
  }

  return buckets;
}

function renderList(title: string, items: NamedLink[], limit: number): string[] {
  if (items.length === 0) return [];
  const lines = [title];
  items.slice(0, limit).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.label}`, item.url);
  });
  if (items.length > limit) lines.push(`Ещё ${items.length - limit} в обучении.`);
  return lines;
}

function renderBuckets(question: string, buckets: LinkBuckets): string {
  const focus = norm(question);
  const reviewsFirst = /отзыв/.test(focus);
  const photosFirst = /фото|картин/.test(focus) && !reviewsFirst;
  const blocks = [
    buckets.title,
    ...renderList("Карточка для клиента:", buckets.cards, 4)
  ];
  const groups = [
    reviewsFirst ? renderList("Отзывы:", buckets.reviews, 15) : [],
    photosFirst ? renderList("Фото:", buckets.photos, 12) : [],
    !reviewsFirst ? renderList("Отзывы:", buckets.reviews, 15) : [],
    !photosFirst ? renderList("Фото:", buckets.photos, 12) : [],
    renderList("Видео:", buckets.videos, 6),
    renderList("Файлы:", buckets.documents, 6)
  ];
  for (const group of groups) blocks.push(...(group.length ? ["", ...group] : []));
  if (buckets.reviews.length === 0 && /отзыв/.test(focus)) {
    blocks.push("", "Отдельных отзывов по этому продукту в материалах нет.");
  }
  if (buckets.training) blocks.push("", "Обучение:", buckets.training.url);
  return blocks.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n").trim();
}

export function formatCardFooter(question: string): string | null {
  const rules = matchProductRules(question);
  if (rules.length === 0 || wantsAssetLinks(question)) return null;
  const lines: string[] = [];
  for (const rule of rules) {
    for (const card of selectedNames(question, rule.cards)) {
      lines.push(card.label, absoluteUrl(`/cards/${card.name}`));
    }
    lines.push("Обучение:", absoluteUrl(`/training/products/${rule.id}`));
  }
  return lines.length ? lines.join("\n") : null;
}

const PRODUCT_BUTTONS: Array<{ id: string; label: string }> = [
  { id: "personal-newspaper", label: "Газета из даты" },
  { id: "original-magazine-page-posters", label: "Постер" },
  { id: "personal-magazine", label: "Книга в заголовках" },
  { id: "life-story", label: "Книга жизни" },
  { id: "retro-newspaper", label: "Поздравительная газета" },
  { id: "gift-edition", label: "Party Page" },
  { id: "glossy-magazine", label: "Глянцевый журнал" },
  { id: "family-edition", label: "Семейное издание" },
  { id: "family-card-deck", label: "Колода карт" },
  { id: "congratulatory-song", label: "Поздравительная песня" },
  { id: "stickers", label: "Наклейки" },
  { id: "ozivi", label: "Оживи" },
  { id: "pervoe-pismo", label: "Первое письмо" }
];

export function managerProductButtons(corpus: ManagerCorpus): Array<{ id: string; label: string }> {
  const products = corpus.products.filter((product) => product.id !== "final-exam");
  const ordered = PRODUCT_BUTTONS.filter((item) => products.some((product) => product.id === item.id));
  for (const product of products) {
    if (ordered.some((item) => item.id === product.id)) continue;
    ordered.push({ id: product.id, label: product.title.slice(0, 40) });
  }
  return ordered;
}

export function formatProductSheet(productId: string, corpus: ManagerCorpus): string | null {
  const product = corpus.products.find((item) => item.id === productId && item.id !== "final-exam");
  if (!product) return null;
  const lines = [product.title];
  const info = clip([product.shortDescription, product.targetAudience].filter(Boolean).join(" "), 700);
  if (info) lines.push("", "Информация:", info);
  const rule = PRODUCT_RULES.find((item) => item.id === product.id);
  if (rule) {
    const buckets = bucketsFor(`${product.title} газет журнал`, rule, corpus);
    for (const group of [
      renderList("Карточка для клиента:", buckets.cards, 4),
      renderList("Видео:", buckets.videos, 8),
      renderList("Фото:", buckets.photos, 12),
      renderList("Отзывы:", buckets.reviews, 15)
    ]) {
      if (group.length) lines.push("", ...group);
    }
  }
  lines.push("", "Обучение:", absoluteUrl(`/training/products/${product.id}`));
  return lines.join("\n");
}

export function formatAssetReply(question: string, corpus: ManagerCorpus): string | null {
  if (!wantsAssetLinks(question)) return null;
  const rules = matchProductRules(question);
  if (rules.length === 0) {
    const counts = corpus.products
      .map((product) => ({
        title: product.title,
        reviews: (product.materials || []).filter((material) => material.url && isReview(material)).length
      }))
      .filter((item) => item.reviews > 0);
    const lines = [
      "Напишите продукт. Например: «скинь отзывы по книге жизни» или «фото поздравительной газеты».",
      "",
      "Отзывы есть у:"
    ];
    counts.forEach((item) => lines.push(`- ${item.title} — ${item.reviews}`));
    if (corpus.genericReviews.length) {
      lines.push("", "Общие видеоотзывы:");
      corpus.genericReviews.slice(0, 6).forEach((item, index) => {
        lines.push(`${index + 1}. ${item.label}`, item.url);
      });
    }
    return lines.join("\n");
  }

  return rules.map((rule) => renderBuckets(question, bucketsFor(question, rule, corpus))).join("\n\n");
}

async function readJsonFile<T>(fileName: string): Promise<T | null> {
  const dirs = [
    process.env.TRAINING_DATA_DIR?.trim(),
    path.join(process.cwd(), "data", "training")
  ].filter((dir): dir is string => Boolean(dir));
  for (const dir of dirs) {
    try {
      const raw = await readFile(path.join(dir, fileName), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      // Try the next directory.
    }
  }
  return null;
}

export async function loadManagerCorpus(baseSections: KnowledgeSection[] = MANAGER_KNOWLEDGE): Promise<ManagerCorpus> {
  const storedProducts = await readRawTrainingCatalog().catch(() => null);
  const productFile = await readJsonFile<{ products?: CorpusProduct[] }>("products.json");
  const products = storedProducts?.products?.length
    ? storedProducts.products
    : productFile?.products?.length
      ? productFile.products
      : productsSeed.products;

  const materialFile = await readJsonFile<{ materials?: CorpusMaterial[] }>("client-materials.json");
  const materials = materialFile?.materials?.length ? materialFile.materials : materialsSeed.materials;

  const crmFile = await readJsonFile<{ modules?: CorpusModule[] }>("crm-modules.json");
  const practiceFile = await readJsonFile<{ modules?: CorpusModule[] }>("practice-modules.json");
  const reviewFile = await readJsonFile<{ videos?: Array<{ title?: string; url?: string }> }>("client-review-videos.json");
  const reviews = reviewFile?.videos?.length ? reviewFile.videos : reviewSeed.videos;

  return {
    products,
    materials,
    genericReviews: reviews
      .filter((video) => video.url?.trim())
      .map((video) => ({ label: video.title?.trim() || "Отзыв", url: absoluteUrl(video.url || "") })),
    sections: [
      ...baseSections,
      ...buildProductSections(products),
      ...buildModuleSections(crmFile?.modules?.length ? crmFile.modules : crmSeed.modules, "crm"),
      ...buildModuleSections(practiceFile?.modules?.length ? practiceFile.modules : practiceSeed.modules, "practice"),
      zabkovaSection()
    ]
  };
}
