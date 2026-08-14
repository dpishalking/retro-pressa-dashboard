/**
 * 12 analytical contours from the CEO Control Center mockup.
 * Home hub links here; each contour is /os/[id] (or external).
 */

export type ContourStatus = "live" | "partial" | "stub";

export type ContourId =
  | "revenue"
  | "unit-economics"
  | "products"
  | "cohorts"
  | "sales-cycle"
  | "customers"
  | "marketing"
  | "creatives"
  | "funnel"
  | "managers"
  | "conversations"
  | "geography"
  | "production"
  | "plan"
  | "sources"
  | "factors";

export type ContourDef = {
  id: ContourId;
  number: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  /** In-app path; external absolute path when leaveOs */
  href: string;
  leaveOs?: boolean;
  status: ContourStatus;
  accent: "blue" | "green" | "purple" | "gold" | "slate";
  /** Contours shown on the central wheel (1–12). */
  onWheel: boolean;
};

export const ANALYTICS_CONTOURS: ContourDef[] = [
  {
    id: "revenue",
    number: 1,
    title: "Дерево выручки",
    shortTitle: "Выручка",
    subtitle: "Трафик → лиды → оплаты → чек → повтор",
    href: "/os/revenue",
    status: "live",
    accent: "blue",
    onWheel: true
  },
  {
    id: "unit-economics",
    number: 2,
    title: "Юнит-экономика",
    shortTitle: "Юнит",
    subtitle: "Вклад на заказ · AOV / CPL / ROAS",
    href: "/os/unit-economics",
    status: "partial",
    accent: "green",
    onWheel: true
  },
  {
    id: "products",
    number: 3,
    title: "Продуктовая аналитика",
    shortTitle: "Продукты",
    subtitle: "SKU · заказы · доля выручки",
    href: "/os/products",
    status: "partial",
    accent: "blue",
    onWheel: true
  },
  {
    id: "cohorts",
    number: 4,
    title: "Когорты",
    shortTitle: "Когорты",
    subtitle: "Месяц / неделя создания лида · страны · оплаты когорты",
    href: "/os/cohorts",
    status: "live",
    accent: "blue",
    onWheel: true
  },
  {
    id: "sales-cycle",
    number: 0,
    title: "Цикл сделки",
    shortTitle: "Цикл сделки",
    subtitle: "Лид → оплата · D0–D30 · менеджеры / источники",
    href: "/os/sales-cycle",
    status: "partial",
    accent: "blue",
    onWheel: false
  },
  {
    id: "customers",
    number: 5,
    title: "Клиенты",
    shortTitle: "Клиенты",
    subtitle: "Новые / повтор / средний чек клиента",
    href: "/os/customers",
    status: "partial",
    accent: "purple",
    onWheel: true
  },
  {
    id: "marketing",
    number: 6,
    title: "Маркетинг",
    shortTitle: "Маркетинг",
    subtitle: "Бюджет · CPL · CAC · ROAS",
    href: "/os/marketing",
    status: "partial",
    accent: "purple",
    onWheel: true
  },
  {
    id: "creatives",
    number: 7,
    title: "Креативная аналитика",
    shortTitle: "Креативы",
    subtitle: "Темы · хуки · удержание · лиды",
    href: "/os/creatives",
    status: "stub",
    accent: "slate",
    onWheel: true
  },
  {
    id: "funnel",
    number: 8,
    title: "Воронка продаж",
    shortTitle: "Воронка",
    subtitle: "Лид → счёт → оплата · цикл сделки",
    href: "/os/funnel",
    status: "live",
    accent: "blue",
    onWheel: true
  },
  {
    id: "managers",
    number: 9,
    title: "Менеджеры продаж",
    shortTitle: "Менеджеры",
    subtitle: "Эффективность · конверсия · чек",
    href: "/os/managers",
    status: "live",
    accent: "blue",
    onWheel: true
  },
  {
    id: "conversations",
    number: 10,
    title: "Диалоги",
    shortTitle: "Диалоги",
    subtitle: "Чаты · возражения · качество",
    href: "/rop/conversations",
    leaveOs: true,
    status: "live",
    accent: "purple",
    onWheel: true
  },
  {
    id: "geography",
    number: 11,
    title: "География",
    shortTitle: "Гео",
    subtitle: "Страны · рынки · доля",
    href: "/os/geography",
    status: "live",
    accent: "green",
    onWheel: true
  },
  {
    id: "production",
    number: 12,
    title: "Производство",
    shortTitle: "Производство",
    subtitle: "Сроки · загрузка · качество",
    href: "/os/production",
    status: "stub",
    accent: "slate",
    onWheel: true
  },
  {
    id: "factors",
    number: 0,
    title: "Факторный анализ",
    shortTitle: "Факторы",
    subtitle: "Что съело план и куда жать, чтобы расти",
    href: "/os/factors",
    status: "live",
    accent: "gold",
    onWheel: false
  },
  {
    id: "plan",
    number: 0,
    title: "План / Факт / Прогноз",
    shortTitle: "План",
    subtitle: "Месячный план из Google Sheets",
    href: "/os/plan",
    status: "live",
    accent: "gold",
    onWheel: false
  },
  {
    id: "sources",
    number: 0,
    title: "Источники данных",
    shortTitle: "Источники",
    subtitle: "Единая модель · качество данных",
    href: "/os/sources",
    status: "partial",
    accent: "slate",
    onWheel: false
  }
];

export function getContour(id: string): ContourDef | null {
  return ANALYTICS_CONTOURS.find((item) => item.id === id) ?? null;
}

export function wheelContours(): ContourDef[] {
  return ANALYTICS_CONTOURS.filter((item) => item.onWheel).sort((a, b) => a.number - b.number);
}

/** Home hub tiles — work modules only (sources live in their own band). */
const HUB_TILE_ORDER: ContourId[] = [
  "revenue",
  "factors",
  "unit-economics",
  "products",
  "cohorts",
  "sales-cycle",
  "customers",
  "marketing",
  "creatives",
  "funnel",
  "managers",
  "conversations",
  "geography",
  "production",
  "plan"
];

export function hubTileContours(): ContourDef[] {
  const byId = new Map(ANALYTICS_CONTOURS.map((item) => [item.id, item]));
  return HUB_TILE_ORDER.map((id) => byId.get(id)).filter(
    (item): item is ContourDef => Boolean(item) && item?.status !== "stub"
  );
}

export type BusinessContourId = "analytics" | "sales" | "marketing" | "product" | "finance";

export type BusinessContourGroup = {
  id: BusinessContourId;
  title: string;
  subtitle: string;
  contours: ContourDef[];
};

const BUSINESS_CONTOUR_ORDER: Array<{
  id: BusinessContourId;
  title: string;
  subtitle: string;
  contourIds: ContourId[];
}> = [
  {
    id: "analytics",
    title: "Аналитика",
    subtitle: "Общая картина бизнеса и клиентская база",
    contourIds: ["revenue", "factors", "customers", "geography"]
  },
  {
    id: "sales",
    title: "Продажи",
    subtitle: "Воронка, команда и качество диалогов",
    contourIds: ["funnel", "sales-cycle", "managers", "conversations"]
  },
  {
    id: "marketing",
    title: "Маркетинг и трафик",
    subtitle: "Бюджет, когорты, привлечение и креативы",
    contourIds: ["marketing", "cohorts", "creatives"]
  },
  {
    id: "product",
    title: "Продукт",
    subtitle: "Ассортимент, спрос и производство",
    contourIds: ["products", "production"]
  },
  {
    id: "finance",
    title: "Финансы",
    subtitle: "План, экономика и итоговый результат",
    contourIds: ["plan", "unit-economics"]
  }
];

export function businessContourGroups(): BusinessContourGroup[] {
  const byId = new Map(hubTileContours().map((item) => [item.id, item]));
  return BUSINESS_CONTOUR_ORDER.map((group) => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    contours: group.contourIds
      .map((id) => byId.get(id))
      .filter((item): item is ContourDef => Boolean(item))
  }));
}

export const BUSINESS_CONTOUR_PATHS: Record<BusinessContourId, string> = {
  analytics: "/os",
  sales: "/sales",
  marketing: "/marketing",
  product: "/product",
  finance: "/finance"
};

export function businessContourForOsId(id: ContourId): BusinessContourId | null {
  for (const group of BUSINESS_CONTOUR_ORDER) {
    if (group.contourIds.includes(id)) return group.id;
  }
  if (id === "sources") return "marketing";
  return null;
}

export function siblingContours(id: ContourId): ContourDef[] {
  const groupId = businessContourForOsId(id);
  if (!groupId) return [];
  const group = businessContourGroups().find((item) => item.id === groupId);
  return group?.contours ?? [];
}

export function contourStatusLabel(status: ContourStatus): string {
  if (status === "live") return "ФАКТ";
  if (status === "partial") return "ЧАСТИЧНО";
  return "СКОРО";
}
