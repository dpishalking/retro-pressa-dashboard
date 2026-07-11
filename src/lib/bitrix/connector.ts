import type { CountryInvoiceMetrics, DailyMetrics, ManagerInvoiceMetrics, ManagerMetrics, MonthlyMetrics, PeriodKey, ProductInvoiceMetrics } from "@/types/metrics";
import { extractBitrixWebValue } from "@/lib/utm-standards";
import { readBitrixSnapshot, snapshotFilePath, writeBitrixSnapshot, type BitrixSnapshot, type BitrixSnapshotDeal, type BitrixSnapshotLead, type BitrixSnapshotProductRow } from "@/lib/bitrix/snapshot-store";

type BitrixListResponse<T> = {
  result?: T[] | { items?: T[] };
  next?: number;
  error?: string;
  error_description?: string;
};

type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

type BitrixBatchResponse<T> = {
  result?: {
    result?: Record<string, T>;
    result_error?: Array<{
      error?: string;
      error_description?: string;
    }>;
  };
  error?: string;
  error_description?: string;
};

type BitrixLead = {
  ID: string;
  DATE_CREATE?: string;
  SOURCE_ID?: string;
  ASSIGNED_BY_ID?: string;
  UF_CRM_1737995147?: string | string[];
  UTM_SOURCE?: string;
  UTM_MEDIUM?: string;
  UTM_CAMPAIGN?: string;
  UTM_CONTENT?: string;
  UTM_TERM?: string;
  WEB?: unknown;
  UF_CRM_FORMNAME?: string;
};

type BitrixDeal = {
  ID: string;
  LEAD_ID?: string;
  DATE_CREATE?: string;
  CLOSEDATE?: string;
  OPPORTUNITY?: string;
  CATEGORY_ID?: string;
  STAGE_ID?: string;
  STAGE_SEMANTIC_ID?: string;
  SOURCE_ID?: string;
  ASSIGNED_BY_ID?: string;
  UF_CRM_6797B3DA00D16?: string | string[];
  UTM_CAMPAIGN?: string;
  WEB?: unknown;
};

type BitrixProductRow = {
  PRODUCT_ID?: string | number;
  PRODUCT_NAME?: string;
  ORIGINAL_PRODUCT_NAME?: string;
  QUANTITY?: string | number;
  PRICE?: string | number;
};

type BitrixStageHistory = {
  OWNER_ID: number | string;
  CREATED_TIME?: string;
  STAGE_ID?: string;
  CATEGORY_ID?: number | string;
  TYPE_ID?: number | string;
};

type BitrixUser = {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
};

type BitrixField = {
  items?: Array<{
    ID: string;
    VALUE: string;
  }>;
};

type BitrixEnumMaps = {
  leadCountries: Map<string, string>;
  dealCountries: Map<string, string>;
};

type BitrixSyncOptions = {
  period?: PeriodKey;
  country?: string;
  manager?: string;
  product?: string;
  refresh?: boolean;
};

export type BitrixSyncPayload = {
  monthly: MonthlyMetrics;
  daily: DailyMetrics[];
  managers: ManagerMetrics[];
  invoiceCountries: CountryInvoiceMetrics[];
  invoiceManagers: ManagerInvoiceMetrics[];
  invoiceProducts: ProductInvoiceMetrics[];
  countryOptions: string[];
  productOptions: string[];
  summary: {
    leadsLoaded: number;
    recentClientsLoaded: number;
    dealsLoaded: number;
    usersLoaded: number;
    periodStart: string;
    periodEnd: string;
    dataSource: "snapshot" | "live";
    snapshotUpdatedAt: string | null;
    snapshotPath: string;
  };
};

const leadCountryField = "UF_CRM_1737995147";
const dealCountryField = "UF_CRM_6797B3DA00D16";
const selectLead = [
  "ID",
  "DATE_CREATE",
  "SOURCE_ID",
  "ASSIGNED_BY_ID",
  leadCountryField,
  "UTM_SOURCE",
  "UTM_MEDIUM",
  "UTM_CAMPAIGN",
  "UTM_CONTENT",
  "UTM_TERM",
  "WEB",
  "UF_CRM_FORMNAME"
];
const selectDeal = [
  "ID",
  "LEAD_ID",
  "DATE_CREATE",
  "CLOSEDATE",
  "OPPORTUNITY",
  "CATEGORY_ID",
  "STAGE_ID",
  "STAGE_SEMANTIC_ID",
  "SOURCE_ID",
  "ASSIGNED_BY_ID",
  dealCountryField,
  "UTM_CAMPAIGN",
  "WEB"
];
const selectUser = ["ID", "NAME", "LAST_NAME"];
const invoiceStageId = "1";
const invoiceCategoryId = 0;
const requestedCountryOrder = [
  "Латвия",
  "Беларусь",
  "Казахстан",
  "Эстония",
  "Германия",
  "Литва",
  "Россия",
  "Молдова",
  "Грузия",
  "Англия",
  "Израиль",
  "Испания",
  "Армения",
  "Финляндия",
  "Австрия",
  "Азербайджан",
  "Польша",
  "США",
  "Украина",
  "Швейцария",
  "Ирландия",
  "Италия",
  "Словакия",
  "Турция",
  "Франция",
  "Чехия",
  "Швеция",
  "Бельгия",
  "Болгария",
  "другие",
  "Исландия",
  "Люксембург",
  "Нидерланды",
  "Норвегия",
  "Остров Гернси",
  "Португалия",
  "Румыния",
  "Сербия",
  "Словения",
  "Туркменистан",
  "Хорватия",
  "Черногория"
];

const workingDaysByPeriod: Record<PeriodKey, number> = {
  "may-2026": 21,
  "june-2026": 21,
  "july-2026": 23
};

function monthRangeForPeriod(period: PeriodKey, now = new Date()) {
  const months: Record<PeriodKey, { year: number; month: number }> = {
    "may-2026": { year: 2026, month: 5 },
    "june-2026": { year: 2026, month: 6 },
    "july-2026": { year: 2026, month: 7 }
  };
  const { year, month } = months[period];
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const factualEnd = now >= start && now < end ? now : end;
  return { start, end, factualEnd };
}

function isoDate(date: Date) {
  return date.toISOString();
}

function daysAgo(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function dayKey(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function numberValue(value?: string | number | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeWebhookUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error?: string, description?: string) {
  return `${error ?? ""} ${description ?? ""}`.toLowerCase().includes("too many requests");
}

function arrayResult<T>(result?: T[] | { items?: T[] }) {
  return Array.isArray(result) ? result : result?.items ?? [];
}

async function callBitrix<T>(method: string, body: Record<string, unknown>, start = 0, attempt = 0): Promise<BitrixListResponse<T>> {
  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) {
    throw new Error("BITRIX_WEBHOOK_URL is not configured");
  }

  const response = await fetch(`${normalizeWebhookUrl(webhook)}${method}.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, start }),
    cache: "no-store"
  });

  const data = await response.json() as BitrixListResponse<T>;
  if (!response.ok || data.error) {
    if (attempt < 3 && isRateLimitError(data.error, data.error_description)) {
      await sleep(1200 * (attempt + 1));
      return callBitrix<T>(method, body, start, attempt + 1);
    }
    throw new Error(data.error_description || data.error || `Bitrix request failed: ${method}`);
  }

  return data;
}

async function callBitrixResult<T>(method: string, body: Record<string, unknown> = {}, attempt = 0): Promise<T> {
  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) {
    throw new Error("BITRIX_WEBHOOK_URL is not configured");
  }

  const response = await fetch(`${normalizeWebhookUrl(webhook)}${method}.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const data = await response.json() as BitrixResponse<T>;
  if (!response.ok || data.error || typeof data.result === "undefined") {
    if (attempt < 3 && isRateLimitError(data.error, data.error_description)) {
      await sleep(1200 * (attempt + 1));
      return callBitrixResult<T>(method, body, attempt + 1);
    }
    throw new Error(data.error_description || data.error || `Bitrix request failed: ${method}`);
  }

  return data.result;
}

async function callBitrixBatchResult<T>(cmd: Record<string, string>, attempt = 0): Promise<Record<string, T>> {
  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) {
    throw new Error("BITRIX_WEBHOOK_URL is not configured");
  }

  const response = await fetch(`${normalizeWebhookUrl(webhook)}batch.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ halt: 0, cmd }),
    cache: "no-store"
  });

  const data = await response.json() as BitrixBatchResponse<T>;
  if (!response.ok || data.error) {
    if (attempt < 3 && isRateLimitError(data.error, data.error_description)) {
      await sleep(1200 * (attempt + 1));
      return callBitrixBatchResult<T>(cmd, attempt + 1);
    }
    throw new Error(data.error_description || data.error || "Bitrix batch request failed");
  }

  return data.result?.result ?? {};
}

async function listAll<T>(method: string, body: Record<string, unknown>, limit = Number.POSITIVE_INFINITY): Promise<T[]> {
  const rows: T[] = [];
  let start = 0;

  while (rows.length < limit) {
    const page = await callBitrix<T>(method, body, start);
    rows.push(...arrayResult(page.result));

    if (typeof page.next !== "number") break;
    start = page.next;
  }

  return rows;
}

async function listDealsByIds(ids: string[]) {
  const rows: BitrixDeal[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    rows.push(...await listAll<BitrixDeal>("crm.deal.list", {
      order: { ID: "ASC" },
      filter: { "@ID": batch },
      select: selectDeal
    }));
  }
  return rows;
}

async function listDealProductRows(dealIds: string[]) {
  const rowsByDeal = new Map<string, BitrixProductRow[]>();

  for (let index = 0; index < dealIds.length; index += 50) {
    const batch = dealIds.slice(index, index + 50);
    const commands = Object.fromEntries(batch.map((dealId, batchIndex) => [`deal_${batchIndex}`, `crm.deal.productrows.get?id=${dealId}`]));
    const result = await callBitrixBatchResult<BitrixProductRow[]>(commands);

    batch.forEach((dealId, batchIndex) => {
      rowsByDeal.set(dealId, Array.isArray(result[`deal_${batchIndex}`]) ? result[`deal_${batchIndex}`] : []);
    });
  }

  return rowsByDeal;
}

function buildUserNameMap(users: BitrixUser[]) {
  return new Map(users.map((user) => {
    const name = [user.NAME, user.LAST_NAME].filter(Boolean).join(" ").trim() || `ID ${user.ID}`;
    return [user.ID, name];
  }));
}

function bitrixEnumOptions(field?: BitrixField) {
  return field?.items?.map((item) => item.VALUE).filter(Boolean) ?? [];
}

function bitrixEnumMap(field?: BitrixField) {
  return new Map(field?.items?.map((item) => [String(item.ID), item.VALUE]) ?? []);
}

function orderedCountryOptions(...countryLists: string[][]) {
  const available = new Set(countryLists.flat().filter(Boolean));
  const ordered = requestedCountryOrder.filter((country) => country === "другие" || available.has(country));
  const extra = Array.from(available)
    .filter((country) => !ordered.includes(country))
    .sort((a, b) => a.localeCompare(b, "ru"));

  return Array.from(new Set([...ordered, ...extra]));
}

function enumValueName(map: Map<string, string>, value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";
  return map.get(String(raw)) ?? String(raw);
}

async function loadCountryMetadata() {
  const [leadFields, dealFields] = await Promise.all([
    callBitrixResult<Record<string, BitrixField>>("crm.lead.fields"),
    callBitrixResult<Record<string, BitrixField>>("crm.deal.fields")
  ]);

  const leadCountries = bitrixEnumMap(leadFields[leadCountryField]);
  const dealCountries = bitrixEnumMap(dealFields[dealCountryField]);

  return {
    countryOptions: orderedCountryOptions(
      bitrixEnumOptions(leadFields[leadCountryField]),
      bitrixEnumOptions(dealFields[dealCountryField])
    ),
    enumMaps: {
      leadCountries,
      dealCountries
    }
  };
}

function normalizeSnapshotLead(lead: BitrixLead, userNames: Map<string, string>, enumMaps: BitrixEnumMaps): BitrixSnapshotLead {
  const assignedById = lead.ASSIGNED_BY_ID || "unknown";
  return {
    id: String(lead.ID),
    dateCreate: lead.DATE_CREATE ?? null,
    sourceId: lead.SOURCE_ID ?? null,
    assignedById,
    managerName: userNames.get(assignedById) ?? `ID ${assignedById}`,
    country: enumValueName(enumMaps.leadCountries, lead[leadCountryField]),
    utmSource: lead.UTM_SOURCE?.trim() || null,
    utmMedium: lead.UTM_MEDIUM?.trim() || null,
    utmCampaign: lead.UTM_CAMPAIGN?.trim() || null,
    utmContent: lead.UTM_CONTENT?.trim() || null,
    utmTerm: lead.UTM_TERM?.trim() || null,
    landingPage: extractBitrixWebValue(lead.WEB) || null,
    formName: lead.UF_CRM_FORMNAME?.trim() || null
  };
}

function normalizeProductRow(row: BitrixProductRow): BitrixSnapshotProductRow {
  return {
    productId: String(row.PRODUCT_ID ?? ""),
    productName: String(row.PRODUCT_NAME || row.ORIGINAL_PRODUCT_NAME || "").trim(),
    quantity: numberValue(row.QUANTITY),
    price: numberValue(row.PRICE)
  };
}

function normalizeSnapshotDeal(
  deal: BitrixDeal,
  invoiceDate: string | null,
  userNames: Map<string, string>,
  enumMaps: BitrixEnumMaps,
  products: BitrixProductRow[],
  leadLookup: Map<string, BitrixSnapshotLead>
): BitrixSnapshotDeal {
  const assignedById = deal.ASSIGNED_BY_ID || "unknown";
  const leadId = deal.LEAD_ID ? String(deal.LEAD_ID) : null;
  const linkedLead = leadId ? leadLookup.get(leadId) : undefined;
  const country = enumValueName(enumMaps.dealCountries, deal[dealCountryField]) || linkedLead?.country || "";

  return {
    id: String(deal.ID),
    leadId,
    dateCreate: deal.DATE_CREATE ?? null,
    closeDate: deal.CLOSEDATE ?? null,
    invoiceDate,
    opportunity: numberValue(deal.OPPORTUNITY),
    stageId: deal.STAGE_ID ?? null,
    stageSemanticId: deal.STAGE_SEMANTIC_ID ?? null,
    sourceId: deal.SOURCE_ID ?? linkedLead?.sourceId ?? null,
    assignedById,
    managerName: userNames.get(assignedById) ?? linkedLead?.managerName ?? `ID ${assignedById}`,
    country,
    utmCampaign: deal.UTM_CAMPAIGN?.trim() || linkedLead?.utmCampaign || null,
    landingPage: extractBitrixWebValue(deal.WEB) || linkedLead?.landingPage || null,
    products: products
      .map(normalizeProductRow)
      .filter((row) => row.productName)
  };
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
}

function isClosedPeriod(period: PeriodKey, now = new Date()) {
  const { start } = monthRangeForPeriod(period, now);
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return start < currentMonthStart;
}

function isSnapshotFreshToday(createdAt: string, now = new Date()) {
  const snapshotDate = new Date(createdAt);
  if (Number.isNaN(snapshotDate.getTime())) return false;
  return snapshotDate.getFullYear() === now.getFullYear()
    && snapshotDate.getMonth() === now.getMonth()
    && snapshotDate.getDate() === now.getDate();
}

async function buildBitrixSnapshot(period: PeriodKey): Promise<BitrixSnapshot> {
  const now = new Date();
  const { start, end, factualEnd } = monthRangeForPeriod(period, now);
  const periodStart = isoDate(start);
  const periodEnd = isoDate(end);
  const factualEndIso = isoDate(factualEnd);
  const recentStart = isoDate(daysAgo(factualEnd, 10));

  const [periodLeadsRaw, recentLeadsRaw, invoiceStageHistory, users, countryMetadata] = await Promise.all([
    listAll<BitrixLead>("crm.lead.list", {
      order: { DATE_CREATE: "ASC" },
      filter: { ">=DATE_CREATE": periodStart, "<=DATE_CREATE": factualEndIso },
      select: selectLead
    }),
    listAll<BitrixLead>("crm.lead.list", {
      order: { DATE_CREATE: "ASC" },
      filter: { ">=DATE_CREATE": recentStart, "<=DATE_CREATE": factualEndIso },
      select: selectLead
    }),
    listAll<BitrixStageHistory>("crm.stagehistory.list", {
      entityTypeId: 2,
      order: { CREATED_TIME: "ASC" },
      filter: {
        ">=CREATED_TIME": periodStart,
        "<=CREATED_TIME": factualEndIso,
        "=CATEGORY_ID": invoiceCategoryId,
        "=STAGE_ID": invoiceStageId,
        "=TYPE_ID": 2
      },
      select: ["OWNER_ID", "CREATED_TIME", "STAGE_ID", "CATEGORY_ID", "TYPE_ID"]
    }),
    listAll<BitrixUser>("user.get", {
      sort: "ID",
      order: "ASC",
      FILTER: { ACTIVE: true },
      SELECT: selectUser
    }, 500),
    loadCountryMetadata()
  ]);

  const { countryOptions: metadataCountryOptions, enumMaps } = countryMetadata;
  const userNames = buildUserNameMap(users);
  const leads = periodLeadsRaw.map((lead) => normalizeSnapshotLead(lead, userNames, enumMaps));
  const recentLeads = recentLeadsRaw.map((lead) => normalizeSnapshotLead(lead, userNames, enumMaps));
  const leadLookup = new Map(leads.map((lead) => [lead.id, lead]));

  const invoiceEntries = new Map<string, BitrixStageHistory>();
  for (const entry of invoiceStageHistory) {
    const id = String(entry.OWNER_ID);
    if (!invoiceEntries.has(id)) invoiceEntries.set(id, entry);
  }

  const dealIds = Array.from(invoiceEntries.keys());
  const [rawDeals, productRows] = await Promise.all([
    listDealsByIds(dealIds),
    listDealProductRows(dealIds)
  ]);

  const deals = rawDeals.map((deal) => normalizeSnapshotDeal(
    deal,
    invoiceEntries.get(String(deal.ID))?.CREATED_TIME ?? null,
    userNames,
    enumMaps,
    productRows.get(String(deal.ID)) ?? [],
    leadLookup
  ));

  const derivedCountries = [
    ...leads.map((lead) => lead.country),
    ...recentLeads.map((lead) => lead.country),
    ...deals.map((deal) => deal.country)
  ];
  const productOptions = uniqueSorted(deals.flatMap((deal) => deal.products.map((product) => product.productName)));

  return {
    version: 1,
    period,
    periodStart,
    periodEnd,
    factualEnd: factualEndIso,
    createdAt: new Date().toISOString(),
    countryOptions: orderedCountryOptions(metadataCountryOptions, derivedCountries),
    productOptions,
    leads,
    recentLeads,
    deals
  };
}

async function loadBitrixSnapshot(period: PeriodKey, refresh = false) {
  const now = new Date();
  const storedSnapshot = refresh ? null : await readBitrixSnapshot(period);

  if (storedSnapshot) {
    const shouldUseStoredSnapshot = isClosedPeriod(period, now) || isSnapshotFreshToday(storedSnapshot.createdAt, now);
    if (shouldUseStoredSnapshot) {
      return {
        snapshot: storedSnapshot,
        dataSource: "snapshot" as const
      };
    }
  }

  const snapshot = await buildBitrixSnapshot(period);
  await writeBitrixSnapshot(snapshot);

  return {
    snapshot,
    dataSource: "live" as const
  };
}

function matchesCountry(countryName: string, country?: string) {
  return !country || country === "all" || countryName === country;
}

function matchesManager(assignedById: string, managerName: string, manager?: string) {
  return !manager || manager === "all" || assignedById === manager || managerName === manager || `ID ${assignedById}` === manager;
}

function matchesProduct(deal: BitrixSnapshotDeal, product?: string) {
  return !product || product === "all" || deal.products.some((item) => item.productName === product);
}

function buildEmptyDay(date: string): DailyMetrics {
  return {
    date,
    paidLeads: 0,
    organicLeads: 0,
    qualifiedLeads: 0,
    paidQualifiedLeads: 0,
    organicQualifiedLeads: 0,
    invoicesCount: 0,
    invoicesAmount: 0,
    salesCount: 0,
    revenue: 0,
    adSpend: 0,
    averagePaidCheck: 0,
    activeManagers: 0
  };
}

function emptyManager(period: PeriodKey, managerId: string, manager: string): ManagerMetrics {
  return {
    period,
    managerId,
    manager,
    newLeads: 0,
    recentClientsLast10Days: 0,
    lastClientAt: null,
    meaningfulDialogs: 0,
    invoicesCount: 0,
    sales: 0,
    revenue: 0,
    medianResponseMinutes: 0,
    responseUnder5MinutesPct: 0,
    recipientQualificationPct: 0,
    personalRecommendationPct: 0,
    visualContentPct: 0,
    fullFinalPricePct: 0,
    directClosingQuestionPct: 0
  };
}

function sortCountryInvoices(items: CountryInvoiceMetrics[]) {
  return items.sort((a, b) => b.invoicesCount - a.invoicesCount || b.invoicesAmount - a.invoicesAmount || a.country.localeCompare(b.country, "ru"));
}

function sortManagerInvoices(items: ManagerInvoiceMetrics[]) {
  return items.sort((a, b) => b.invoicesCount - a.invoicesCount || b.invoicesAmount - a.invoicesAmount || a.manager.localeCompare(b.manager, "ru"));
}

function sortProductInvoices(items: ProductInvoiceMetrics[]) {
  return items.sort((a, b) => b.invoicesCount - a.invoicesCount || b.invoicesAmount - a.invoicesAmount || a.product.localeCompare(b.product, "ru"));
}

function dominantProductName(deal: BitrixSnapshotDeal) {
  const [topProduct] = [...deal.products].sort((a, b) => (b.quantity * b.price) - (a.quantity * a.price) || b.price - a.price || a.productName.localeCompare(b.productName, "ru"));
  return topProduct?.productName || "Без продукта";
}

function aggregateBitrixSnapshot(snapshot: BitrixSnapshot, options: BitrixSyncOptions, dataSource: "snapshot" | "live"): BitrixSyncPayload {
  const start = new Date(snapshot.periodStart);
  const end = new Date(snapshot.periodEnd);
  const calendarDays = end.getUTCDate();
  const workingDays = workingDaysByPeriod[snapshot.period];

  const filteredDeals = snapshot.deals.filter((deal) =>
    matchesCountry(deal.country, options.country)
    && matchesManager(deal.assignedById, deal.managerName, options.manager)
    && matchesProduct(deal, options.product)
  );

  const productLeadIds = options.product && options.product !== "all"
    ? new Set(filteredDeals.map((deal) => deal.leadId).filter((leadId): leadId is string => Boolean(leadId)))
    : null;

  const filterLead = (lead: BitrixSnapshotLead) => (
    matchesCountry(lead.country, options.country)
    && matchesManager(lead.assignedById, lead.managerName, options.manager)
    && (!productLeadIds || productLeadIds.has(lead.id))
  );

  const leads = snapshot.leads.filter(filterLead);
  const recentLeads = snapshot.recentLeads.filter(filterLead);
  const lostDeals = filteredDeals.filter((deal) => deal.stageSemanticId === "F");
  const paidDeals = filteredDeals.filter((deal) => deal.stageSemanticId === "S");
  const paidLeads = leads.filter((lead) => lead.sourceId && lead.sourceId !== "ORGANIC").length;
  const organicLeads = leads.length - paidLeads;
  const invoicesAmount = filteredDeals.reduce((sum, deal) => sum + deal.opportunity, 0);
  const revenue = paidDeals.reduce((sum, deal) => sum + deal.opportunity, 0);
  const cancelledAmount = lostDeals.reduce((sum, deal) => sum + deal.opportunity, 0);

  const days = new Map<string, DailyMetrics>();
  for (let day = 1; day <= calendarDays; day += 1) {
    const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.set(key, buildEmptyDay(key));
  }

  for (const lead of leads) {
    const row = days.get(dayKey(lead.dateCreate));
    if (!row) continue;
    if (lead.sourceId && lead.sourceId !== "ORGANIC") row.paidLeads += 1;
    else row.organicLeads += 1;
  }

  for (const deal of filteredDeals) {
    const row = days.get(dayKey(deal.invoiceDate));
    if (!row) continue;
    row.invoicesCount += 1;
    row.invoicesAmount += deal.opportunity;
    if (deal.stageSemanticId === "S") {
      row.salesCount += 1;
      row.revenue += deal.opportunity;
    }
  }

  const activeByDay = new Map<string, Set<string>>();
  for (const deal of filteredDeals) {
    const key = dayKey(deal.invoiceDate);
    if (!key) continue;
    activeByDay.set(key, activeByDay.get(key) ?? new Set<string>());
    activeByDay.get(key)?.add(deal.assignedById);
  }

  for (const [key, row] of days) {
    row.activeManagers = activeByDay.get(key)?.size ?? 0;
    row.averagePaidCheck = row.salesCount ? row.revenue / row.salesCount : 0;
  }

  const byManager = new Map<string, ManagerMetrics>();
  for (const lead of leads) {
    byManager.set(lead.assignedById, byManager.get(lead.assignedById) ?? emptyManager(snapshot.period, lead.assignedById, lead.managerName));
    byManager.get(lead.assignedById)!.newLeads += 1;
  }

  for (const lead of recentLeads) {
    byManager.set(lead.assignedById, byManager.get(lead.assignedById) ?? emptyManager(snapshot.period, lead.assignedById, lead.managerName));
    const manager = byManager.get(lead.assignedById)!;
    manager.recentClientsLast10Days += 1;
    if (!manager.lastClientAt || (lead.dateCreate && lead.dateCreate > manager.lastClientAt)) {
      manager.lastClientAt = lead.dateCreate;
    }
  }

  for (const deal of filteredDeals) {
    byManager.set(deal.assignedById, byManager.get(deal.assignedById) ?? emptyManager(snapshot.period, deal.assignedById, deal.managerName));
    byManager.get(deal.assignedById)!.invoicesCount += 1;
  }

  for (const deal of paidDeals) {
    byManager.set(deal.assignedById, byManager.get(deal.assignedById) ?? emptyManager(snapshot.period, deal.assignedById, deal.managerName));
    const manager = byManager.get(deal.assignedById)!;
    manager.sales += 1;
    manager.revenue += deal.opportunity;
  }

  const countryInvoices = new Map<string, CountryInvoiceMetrics>();
  for (const deal of filteredDeals) {
    const country = deal.country || "Не указано";
    const bucket = countryInvoices.get(country) ?? {
      country,
      invoicesCount: 0,
      invoicesAmount: 0,
      salesCount: 0,
      revenue: 0
    };
    bucket.invoicesCount += 1;
    bucket.invoicesAmount += deal.opportunity;
    if (deal.stageSemanticId === "S") {
      bucket.salesCount += 1;
      bucket.revenue += deal.opportunity;
    }
    countryInvoices.set(country, bucket);
  }

  const managerInvoices = new Map<string, ManagerInvoiceMetrics>();
  for (const deal of filteredDeals) {
    const managerId = deal.assignedById || "unknown";
    const manager = deal.managerName || `ID ${managerId}`;
    const bucket = managerInvoices.get(managerId) ?? {
      managerId,
      manager,
      invoicesCount: 0,
      invoicesAmount: 0,
      salesCount: 0,
      revenue: 0
    };
    bucket.invoicesCount += 1;
    bucket.invoicesAmount += deal.opportunity;
    if (deal.stageSemanticId === "S") {
      bucket.salesCount += 1;
      bucket.revenue += deal.opportunity;
    }
    managerInvoices.set(managerId, bucket);
  }

  const productInvoices = new Map<string, ProductInvoiceMetrics>();
  for (const deal of filteredDeals) {
    const product = dominantProductName(deal);
    const bucket = productInvoices.get(product) ?? {
      product,
      invoicesCount: 0,
      invoicesAmount: 0,
      salesCount: 0,
      revenue: 0
    };
    bucket.invoicesCount += 1;
    bucket.invoicesAmount += deal.opportunity;
    if (deal.stageSemanticId === "S") {
      bucket.salesCount += 1;
      bucket.revenue += deal.opportunity;
    }
    productInvoices.set(product, bucket);
  }

  const usersLoaded = new Set([
    ...snapshot.leads.map((lead) => lead.assignedById),
    ...snapshot.recentLeads.map((lead) => lead.assignedById),
    ...snapshot.deals.map((deal) => deal.assignedById)
  ]).size;

  return {
    monthly: {
      month: snapshot.period,
      paidLeads,
      organicLeads,
      qualifiedLeads: 0,
      invoicesCount: filteredDeals.length,
      invoicesAmount,
      cancelledInvoicesCount: lostDeals.length,
      cancelledInvoicesAmount: cancelledAmount,
      salesCount: paidDeals.length,
      revenue,
      adSpend: 0,
      paidSalesCount: null,
      workingDays,
      calendarDays
    },
    daily: Array.from(days.values()),
    managers: Array.from(byManager.values()),
    invoiceCountries: sortCountryInvoices(Array.from(countryInvoices.values())),
    invoiceManagers: sortManagerInvoices(Array.from(managerInvoices.values())),
    invoiceProducts: sortProductInvoices(Array.from(productInvoices.values())),
    countryOptions: snapshot.countryOptions,
    productOptions: snapshot.productOptions,
    summary: {
      leadsLoaded: leads.length,
      recentClientsLoaded: recentLeads.length,
      dealsLoaded: filteredDeals.length,
      usersLoaded,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.factualEnd,
      dataSource,
      snapshotUpdatedAt: snapshot.createdAt,
      snapshotPath: snapshotFilePath(snapshot.period)
    }
  };
}

export async function syncBitrixMetrics(options: BitrixSyncOptions = {}): Promise<BitrixSyncPayload> {
  const period = options.period ?? "july-2026";
  const { snapshot, dataSource } = await loadBitrixSnapshot(period, options.refresh);
  return aggregateBitrixSnapshot(snapshot, options, dataSource);
}
