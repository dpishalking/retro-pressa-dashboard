import { readFile } from "node:fs/promises";
import path from "node:path";
import { listPartnerCatalogFromTraining } from "@/lib/partners/catalog-from-training";
import type { PartnerCatalogProduct, PartnerFaqItem, PartnerMaterial } from "@/types/partners";

const contentDir = path.join(process.cwd(), "data", "partners");

const FALLBACK_MATERIALS: PartnerMaterial[] = [
  {
    id: "presentation",
    title: "PDF-презентация Retro Pressa",
    description: "Краткий обзор продуктов и партнёрской программы.",
    kind: "pdf",
    href: "/partners/materials/presentation.pdf"
  },
  {
    id: "photos",
    title: "Фотографии продуктов",
    description: "Готовый набор снимков для постов и сторис.",
    kind: "photo",
    href: "/partners/materials/photos.zip"
  },
  {
    id: "product-video",
    title: "Видео о продуктах",
    description: "Короткий ролик для рекомендаций клиентам.",
    kind: "video",
    href: "/partners/materials/product-video.mp4"
  },
  {
    id: "reels",
    title: "Reels-шаблоны",
    description: "Готовые вертикальные ролики под Instagram и TikTok.",
    kind: "reels",
    href: "/partners/materials/reels.zip"
  },
  {
    id: "logos",
    title: "Логотипы",
    description: "Логотипы Retro Pressa в PNG и SVG.",
    kind: "logo",
    href: "/partners/materials/logos.zip"
  },
  {
    id: "banners",
    title: "Баннеры",
    description: "Баннеры для сайта, Telegram и рассылок.",
    kind: "banner",
    href: "/partners/materials/banners.zip"
  },
  {
    id: "ready-texts",
    title: "Готовые тексты",
    description: "Тексты для WhatsApp, Instagram и email.",
    kind: "text",
    href: "/partners/materials/ready-texts.txt"
  },
  {
    id: "faq-sheet",
    title: "Ответы на частые вопросы",
    description: "Шпаргалка для общения с клиентами.",
    kind: "faq",
    href: "/partners/materials/faq-sheet.pdf"
  }
];

const FALLBACK_FAQ: PartnerFaqItem[] = [
  {
    id: "when-commission",
    question: "Когда начисляется комиссия?",
    answer:
      "Комиссия начисляется после перехода сделки в Bitrix24 в статус оплаты (выигранная сделка). До оплаты заказ не увеличивает ваш баланс."
  },
  {
    id: "payouts",
    question: "Как происходят выплаты?",
    answer:
      "Вы указываете способ выплаты в профиле. После одобрения заявки администратор переводит доступную сумму и отмечает выплату в истории."
  },
  {
    id: "new-promo",
    question: "Как получить новый промокод?",
    answer:
      "Промокод создаётся при регистрации. Если нужен другой код — напишите администратору программы, он обновит его в кабинете."
  },
  {
    id: "forgot-promo",
    question: "Что делать, если клиент забыл указать промокод?",
    answer:
      "Попросите менеджера Retro Pressa закрепить сделку за вами вручную. Один заказ может принадлежать только одному партнёру."
  },
  {
    id: "friends",
    question: "Можно ли рекомендовать друзьям?",
    answer:
      "Да. Партнёром может стать любой человек. Делитесь промокодом или реферальной ссылкой с друзьями и клиентами."
  },
  {
    id: "b2b",
    question: "Можно ли искать корпоративных клиентов?",
    answer:
      "Да. Корпоративные заказы тоже учитываются. Используйте презентацию и материалы из раздела «Материалы»."
  },
  {
    id: "cancel-refund",
    question: "Что будет при отмене или возврате?",
    answer:
      "Отменённый заказ не приносит комиссию. При возврате начисление автоматически уменьшается, баланс пересчитывается."
  }
];

async function readJsonArray<T>(fileName: string): Promise<T[] | null> {
  try {
    const raw = await readFile(path.join(contentDir, fileName), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export async function listPartnerCatalog(): Promise<PartnerCatalogProduct[]> {
  try {
    return await listPartnerCatalogFromTraining();
  } catch (error) {
    console.warn("Partner catalog from training failed, trying local JSON:", error);
    const fromFile = await readJsonArray<PartnerCatalogProduct>("catalog.json");
    return fromFile ?? [];
  }
}

export async function listPartnerMaterials(): Promise<PartnerMaterial[]> {
  return (await readJsonArray<PartnerMaterial>("materials.json")) ?? FALLBACK_MATERIALS;
}

export async function listPartnerFaq(): Promise<PartnerFaqItem[]> {
  return (await readJsonArray<PartnerFaqItem>("faq.json")) ?? FALLBACK_FAQ;
}
