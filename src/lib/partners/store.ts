import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateId } from "@/lib/training/id";
import { createDemoPartnerSeed, DEFAULT_COMMISSION_RATE, emptyPartnerAggregates } from "@/lib/partners/demo-data";
import { normalizePromoCode, promoCodeFromSlug, referralUrlFromSlug, slugifyPartnerName } from "@/lib/partners/promo";
import type {
  Partner,
  PartnerPayout,
  PartnerPublicProfile,
  PartnerSale,
  PartnerStatus,
  PartnersCatalog
} from "@/types/partners";

const partnersDir = process.env.PARTNERS_DATA_DIR?.trim()
  ? path.resolve(process.env.PARTNERS_DATA_DIR.trim())
  : path.join(process.cwd(), "data", "partners");
const catalogPath = path.join(partnersDir, "partners-runtime.json");

let catalogLock: Promise<void> = Promise.resolve();

function withCatalogLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = catalogLock.then(fn);
  catalogLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensurePartnersDir() {
  await mkdir(partnersDir, { recursive: true });
}

function isValidCatalog(value: unknown): value is PartnersCatalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<PartnersCatalog>;
  return (
    catalog.version === 1 &&
    Array.isArray(catalog.partners) &&
    Array.isArray(catalog.sales) &&
    Array.isArray(catalog.payouts)
  );
}

async function writeCatalogAtomic(catalog: PartnersCatalog) {
  await ensurePartnersDir();
  const payload: PartnersCatalog = { ...catalog, updatedAt: new Date().toISOString() };
  const tmpPath = `${catalogPath}.${process.pid}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tmpPath, catalogPath);
}

async function readCatalogUnsafe(): Promise<PartnersCatalog> {
  await ensurePartnersDir();
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isValidCatalog(parsed)) return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read partners catalog:", message);
    }
  }
  const seed = createDemoPartnerSeed();
  await writeCatalogAtomic(seed);
  return seed;
}

export async function readPartnersCatalog(): Promise<PartnersCatalog> {
  return withCatalogLock(readCatalogUnsafe);
}

export function toPublicPartner(partner: Partner): PartnerPublicProfile {
  return {
    ...partner,
    referralUrl: referralUrlFromSlug(partner.referralSlug)
  };
}

export async function listPartners(): Promise<Partner[]> {
  const catalog = await readPartnersCatalog();
  return catalog.partners;
}

export async function findPartnerByUserId(userId: string): Promise<Partner | null> {
  const catalog = await readPartnersCatalog();
  return catalog.partners.find((partner) => partner.userId === userId) ?? null;
}

export async function findPartnerById(id: string): Promise<Partner | null> {
  const catalog = await readPartnersCatalog();
  return catalog.partners.find((partner) => partner.id === id) ?? null;
}

export async function findPartnerByPromoCode(promoCode: string): Promise<Partner | null> {
  const normalized = normalizePromoCode(promoCode);
  const catalog = await readPartnersCatalog();
  return catalog.partners.find((partner) => normalizePromoCode(partner.promoCode) === normalized) ?? null;
}

export async function findPartnerByReferralSlug(slug: string): Promise<Partner | null> {
  const normalized = slug.trim().toLowerCase();
  const catalog = await readPartnersCatalog();
  return catalog.partners.find((partner) => partner.referralSlug === normalized) ?? null;
}

async function allocateUniqueSlug(base: string, catalog: PartnersCatalog): Promise<string> {
  let slug = base;
  let attempt = 1;
  while (catalog.partners.some((partner) => partner.referralSlug === slug)) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

export type RegisterPartnerInput = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  passwordLogin: string;
};

export async function createPendingPartner(input: RegisterPartnerInput): Promise<Partner> {
  return withCatalogLock(async () => {
    const catalog = await readCatalogUnsafe();
    const email = input.email.trim().toLowerCase();
    if (catalog.partners.some((partner) => partner.email === email)) {
      throw new Error("Партнёр с таким email уже зарегистрирован");
    }

    const baseSlug = slugifyPartnerName(input.name);
    const referralSlug = await allocateUniqueSlug(baseSlug, catalog);
    const promoCode = promoCodeFromSlug(referralSlug);
    if (catalog.partners.some((partner) => normalizePromoCode(partner.promoCode) === normalizePromoCode(promoCode))) {
      throw new Error("Не удалось создать уникальный промокод, попробуйте другое имя");
    }

    const now = new Date().toISOString();
    const partner: Partner = {
      id: generateId("partner"),
      userId: input.userId,
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      country: input.country.trim() || "—",
      promoCode,
      referralSlug,
      commissionRate: DEFAULT_COMMISSION_RATE,
      status: "pending",
      payoutMethod: "",
      payoutDetails: "",
      ...emptyPartnerAggregates(),
      createdAt: now,
      updatedAt: now
    };

    catalog.partners.push(partner);
    await writeCatalogAtomic(catalog);
    return partner;
  });
}

export async function updatePartner(
  partnerId: string,
  patch: Partial<
    Pick<
      Partner,
      | "name"
      | "email"
      | "phone"
      | "country"
      | "payoutMethod"
      | "payoutDetails"
      | "commissionRate"
      | "status"
      | "promoCode"
      | "referralSlug"
    >
  >
): Promise<Partner> {
  return withCatalogLock(async () => {
    const catalog = await readCatalogUnsafe();
    const index = catalog.partners.findIndex((partner) => partner.id === partnerId);
    if (index === -1) throw new Error("Партнёр не найден");

    const current = catalog.partners[index]!;
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase();
      if (catalog.partners.some((partner) => partner.id !== partnerId && partner.email === email)) {
        throw new Error("Партнёр с таким email уже существует");
      }
      current.email = email;
    }
    if (patch.name !== undefined) current.name = patch.name.trim();
    if (patch.phone !== undefined) current.phone = patch.phone.trim();
    if (patch.country !== undefined) current.country = patch.country.trim();
    if (patch.payoutMethod !== undefined) current.payoutMethod = patch.payoutMethod.trim();
    if (patch.payoutDetails !== undefined) current.payoutDetails = patch.payoutDetails.trim();
    if (patch.commissionRate !== undefined) {
      if (!(patch.commissionRate >= 0 && patch.commissionRate <= 1)) {
        throw new Error("Комиссия должна быть от 0 до 1");
      }
      current.commissionRate = patch.commissionRate;
    }
    if (patch.status !== undefined) current.status = patch.status;
    if (patch.promoCode !== undefined) {
      const promoCode = normalizePromoCode(patch.promoCode);
      if (catalog.partners.some((p) => p.id !== partnerId && normalizePromoCode(p.promoCode) === promoCode)) {
        throw new Error("Промокод уже занят");
      }
      current.promoCode = promoCode;
    }
    if (patch.referralSlug !== undefined) {
      const slug = patch.referralSlug.trim().toLowerCase();
      if (catalog.partners.some((p) => p.id !== partnerId && p.referralSlug === slug)) {
        throw new Error("Реферальный slug уже занят");
      }
      current.referralSlug = slug;
    }
    current.updatedAt = new Date().toISOString();
    catalog.partners[index] = current;
    await writeCatalogAtomic(catalog);
    return current;
  });
}

export async function setPartnerStatus(partnerId: string, status: PartnerStatus): Promise<Partner> {
  return updatePartner(partnerId, { status });
}

export function recalculatePartnerAggregates(
  partner: Partner,
  sales: PartnerSale[],
  payouts: PartnerPayout[]
): Partner {
  const partnerSales = sales.filter((sale) => sale.partnerId === partner.id);
  const partnerPayouts = payouts.filter((payout) => payout.partnerId === partner.id);

  const paidSales = partnerSales.filter((sale) => sale.status === "paid");
  const accrued = partnerSales
    .filter((sale) => sale.status === "paid")
    .reduce((sum, sale) => sum + sale.commission, 0);
  const paidOut = partnerPayouts
    .filter((payout) => payout.status === "paid")
    .reduce((sum, payout) => sum + payout.amount, 0);

  return {
    ...partner,
    paidOrders: paidSales.length,
    salesTotal: paidSales.reduce((sum, sale) => sum + sale.amount, 0),
    accrued,
    paidOut,
    available: Math.max(0, accrued - paidOut),
    updatedAt: new Date().toISOString()
  };
}

export async function listSalesForPartner(partnerId: string): Promise<PartnerSale[]> {
  const catalog = await readPartnersCatalog();
  return catalog.sales
    .filter((sale) => sale.partnerId === partnerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function listPayoutsForPartner(partnerId: string): Promise<PartnerPayout[]> {
  const catalog = await readPartnersCatalog();
  return catalog.payouts
    .filter((payout) => payout.partnerId === partnerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function replaceSalesAndPayouts(input: {
  sales: PartnerSale[];
  payouts: PartnerPayout[];
}): Promise<PartnersCatalog> {
  return withCatalogLock(async () => {
    const catalog = await readCatalogUnsafe();
    catalog.sales = input.sales;
    catalog.payouts = input.payouts;
    catalog.partners = catalog.partners.map((partner) =>
      recalculatePartnerAggregates(partner, catalog.sales, catalog.payouts)
    );
    await writeCatalogAtomic(catalog);
    return catalog;
  });
}

export async function upsertSale(sale: PartnerSale): Promise<PartnersCatalog> {
  return withCatalogLock(async () => {
    const catalog = await readCatalogUnsafe();
    const index = catalog.sales.findIndex((item) => item.id === sale.id);
    if (index === -1) catalog.sales.push(sale);
    else catalog.sales[index] = sale;

    catalog.partners = catalog.partners.map((partner) =>
      recalculatePartnerAggregates(partner, catalog.sales, catalog.payouts)
    );
    await writeCatalogAtomic(catalog);
    return catalog;
  });
}
