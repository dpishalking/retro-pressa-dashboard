import type { CountryInvoiceMetrics, DailyMetrics, ManagerInvoiceMetrics, ManagerMetrics, MonthlyMetrics, PeriodKey, ProductInvoiceMetrics } from "@/types/metrics";
import { extractBitrixWebValue } from "@/lib/utm-standards";
import {
  BITRIX_INVOICE_AMOUNT_FIELD,
  BITRIX_INVOICE_DATE_FIELD,
  BITRIX_INVOICE_STAGE_ID,
  BITRIX_METRIC_DEFINITIONS,
  BITRIX_SALES_CATEGORY_ID,
  EXCLUDED_LEAD_STATUS_IDS,
  PAID_LEAD_SOURCE_IDS,
  buildKnownGaps,
  type BitrixKnownGap
} from "@/lib/bitrix/metric-definitions";
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
  STATUS_ID?: string;
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
  TITLE?: string;
  LEAD_ID?: string;
  CONTACT_ID?: string;
  DATE_CREATE?: string;
  CLOSEDATE?: string;
  OPPORTUNITY?: string;
  CURRENCY_ID?: string;
  CATEGORY_ID?: string;
  STAGE_ID?: string;
  STAGE_SEMANTIC_ID?: string;
  SOURCE_ID?: string;
  ASSIGNED_BY_ID?: string;
  UF_CRM_6797B3DA00D16?: string | string[];
  UTM_CAMPAIGN?: string;
  WEB?: unknown;
  UF_CRM_1758618010118?: string;
  UF_CRM_1739982211?: string | number | null;
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
    leadsRawLoaded: number;
    leadsExcludedSpamReviews: number;
    recentClientsLoaded: number;
    dealsLoaded: number;
    paidDealsLoaded: number;
    invoicesFromDateField: number;
    invoicesFromStageHistory: number;
    usersLoaded: number;
    periodStart: string;
    periodEnd: string;
    dataSource: "snapshot" | "live";
    snapshotUpdatedAt: string | null;
    snapshotPath: string;
    definitions: typeof BITRIX_METRIC_DEFINITIONS;
    knownGaps: BitrixKnownGap[];
  };
};

const leadCountryField = "UF_CRM_1737995147";
const dealCountryField = "UF_CRM_6797B3DA00D16";
const selectLead = [
  "ID",
  "DATE_CREATE",
  "STATUS_ID",
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
  "TITLE",
  "LEAD_ID",
  "CONTACT_ID",
  "DATE_CREATE",
  "CLOSEDATE",
  "OPPORTUNITY",
  "CURRENCY_ID",
  "CATEGORY_ID",
  "STAGE_ID",
  "STAGE_SEMANTIC_ID",
  "SOURCE_ID",
  "ASSIGNED_BY_ID",
  dealCountryField,
  "UTM_CAMPAIGN",
  "WEB",
  BITRIX_INVOICE_DATE_FIELD,
  BITRIX_INVOICE_AMOUNT_FIELD
];
const selectUser = ["ID", "NAME", "LAST_NAME"];
const excludedLeadStatusSet = new Set<string>(EXCLUDED_LEAD_STATUS_IDS);
const paidLeadSourceSet = new Set<string>(PAID_LEAD_SOURCE_IDS);
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
    statusId: lead.STATUS_ID ?? null,
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

function isOperationalLead(lead: BitrixSnapshotLead) {
  return !lead.statusId || !excludedLeadStatusSet.has(lead.statusId);
}

function isPaidLeadSource(sourceId: string | null) {
  return Boolean(sourceId && paidLeadSourceSet.has(sourceId));
}

function dealInvoiceAmount(deal: BitrixDeal) {
  const labeled = numberValue(deal[BITRIX_INVOICE_AMOUNT_FIELD as keyof BitrixDeal] as string | number | null | undefined);
  return labeled > 0 ? labeled : numberValue(deal.OPPORTUNITY);
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
  leadLookup: Map<string, BitrixSnapshotLead>,
  invoiceSource?: BitrixSnapshotDeal["invoiceSource"]
): BitrixSnapshotDeal {
  const assignedById = deal.ASSIGNED_BY_ID || "unknown";
  const leadId = deal.LEAD_ID ? String(deal.LEAD_ID) : null;
  const linkedLead = leadId ? leadLookup.get(leadId) : undefined;
  const country = enumValueName(enumMaps.dealCountries, deal[dealCountryField]) || linkedLead?.country || "";
  const opportunity = numberValue(deal.OPPORTUNITY);

  return {
    id: String(deal.ID),
    title: deal.TITLE?.trim() || null,
    leadId,
    contactId: deal.CONTACT_ID ? String(deal.CONTACT_ID) : null,
    dateCreate: deal.DATE_CREATE ?? null,
    closeDate: deal.CLOSEDATE ?? null,
    invoiceDate,
    opportunity,
    currencyId: deal.CURRENCY_ID?.trim() || null,
    invoiceAmount: dealInvoiceAmount(deal),
    stageId: deal.STAGE_ID ?? null,
    stageSemanticId: deal.STAGE_SEMANTIC_ID ?? null,
    sourceId: deal.SOURCE_ID ?? linkedLead?.sourceId ?? null,
    assignedById,
    managerName: userNames.get(assignedById) ?? linkedLead?.managerName ?? `ID ${assignedById}`,
    country,
    utmCampaign: deal.UTM_CAMPAIGN?.trim() || linkedLead?.utmCampaign || null,
    landingPage: extractBitrixWebValue(deal.WEB) || linkedLead?.landingPage || null,
    phone: null,
    email: null,
    products: products
      .map(normalizeProductRow)
      .filter((row) => row.productName),
    invoiceSource
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
  const periodStartDate = dayKey(periodStart);
  const factualEndDate = dayKey(factualEndIso);

  const [periodLeadsRaw, recentLeadsRaw, invoiceByDateRaw, invoiceStageHistory, paidDealsRaw, users, countryMetadata] = await Promise.all([
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
    listAll<BitrixDeal>("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {
        [`>=${BITRIX_INVOICE_DATE_FIELD}`]: periodStartDate,
        [`<=${BITRIX_INVOICE_DATE_FIELD}`]: factualEndDate,
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      select: selectDeal
    }),
    listAll<BitrixStageHistory>("crm.stagehistory.list", {
      entityTypeId: 2,
      order: { CREATED_TIME: "ASC" },
      filter: {
        ">=CREATED_TIME": periodStart,
        "<=CREATED_TIME": factualEndIso,
        "=CATEGORY_ID": BITRIX_SALES_CATEGORY_ID,
        "=STAGE_ID": BITRIX_INVOICE_STAGE_ID
      },
      select: ["OWNER_ID", "CREATED_TIME", "STAGE_ID", "CATEGORY_ID", "TYPE_ID"]
    }),
    listAll<BitrixDeal>("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {
        ">=CLOSEDATE": periodStartDate,
        "<=CLOSEDATE": factualEndDate,
        STAGE_SEMANTIC_ID: "S",
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      select: selectDeal
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

  const invoiceByDateIds = new Set(invoiceByDateRaw.map((deal) => String(deal.ID)));
  const invoiceStageEntries = new Map<string, BitrixStageHistory>();
  for (const entry of invoiceStageHistory) {
    const id = String(entry.OWNER_ID);
    if (!invoiceStageEntries.has(id)) invoiceStageEntries.set(id, entry);
  }

  const stageOnlyIds = Array.from(invoiceStageEntries.keys()).filter((id) => !invoiceByDateIds.has(id));
  const stageOnlyDealsRaw = stageOnlyIds.length ? await listDealsByIds(stageOnlyIds) : [];
  const invoiceRawById = new Map<string, BitrixDeal>();
  for (const deal of [...invoiceByDateRaw, ...stageOnlyDealsRaw]) {
    invoiceRawById.set(String(deal.ID), deal);
  }

  const paidRawById = new Map(paidDealsRaw.map((deal) => [String(deal.ID), deal]));
  const allDealIds = Array.from(new Set([
    ...invoiceRawById.keys(),
    ...paidRawById.keys()
  ]));
  const productRows = await listDealProductRows(allDealIds);

  const deals: BitrixSnapshotDeal[] = Array.from(invoiceRawById.values()).map((deal) => {
    const id = String(deal.ID);
    const fromDateField = invoiceByDateIds.has(id);
    const fieldDate = deal[BITRIX_INVOICE_DATE_FIELD as keyof BitrixDeal] as string | undefined;
    const invoiceDate = fromDateField
      ? (fieldDate ?? null)
      : (invoiceStageEntries.get(id)?.CREATED_TIME ?? fieldDate ?? null);
    return normalizeSnapshotDeal(
      deal,
      invoiceDate,
      userNames,
      enumMaps,
      productRows.get(id) ?? [],
      leadLookup,
      fromDateField ? "invoice_date_field" : "stage_history"
    );
  });

  const paidDeals: BitrixSnapshotDeal[] = Array.from(paidRawById.values()).map((deal) => {
    const id = String(deal.ID);
    const fieldDate = deal[BITRIX_INVOICE_DATE_FIELD as keyof BitrixDeal] as string | undefined;
    return normalizeSnapshotDeal(
      deal,
      fieldDate ?? null,
      userNames,
      enumMaps,
      productRows.get(id) ?? [],
      leadLookup
    );
  });

  const derivedCountries = [
    ...leads.map((lead) => lead.country),
    ...recentLeads.map((lead) => lead.country),
    ...deals.map((deal) => deal.country),
    ...paidDeals.map((deal) => deal.country)
  ];
  const productOptions = uniqueSorted([
    ...deals.flatMap((deal) => deal.products.map((product) => product.productName)),
    ...paidDeals.flatMap((deal) => deal.products.map((product) => product.productName))
  ]);

  return {
    version: 2,
    period,
    periodStart,
    periodEnd,
    factualEnd: factualEndIso,
    createdAt: new Date().toISOString(),
    countryOptions: orderedCountryOptions(metadataCountryOptions, derivedCountries),
    productOptions,
    leads,
    recentLeads,
    deals,
    paidDeals
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

function filterDeal(deal: BitrixSnapshotDeal, options: BitrixSyncOptions) {
  return matchesCountry(deal.country, options.country)
    && matchesManager(deal.assignedById, deal.managerName, options.manager)
    && matchesProduct(deal, options.product);
}

function addInvoiceBucket<T extends { invoicesCount: number; invoicesAmount: number; salesCount: number; revenue: number }>(
  bucket: T,
  kind: "invoice" | "paid",
  amount: number
) {
  if (kind === "invoice") {
    bucket.invoicesCount += 1;
    bucket.invoicesAmount += amount;
  } else {
    bucket.salesCount += 1;
    bucket.revenue += amount;
  }
  return bucket;
}

function aggregateBitrixSnapshot(snapshot: BitrixSnapshot, options: BitrixSyncOptions, dataSource: "snapshot" | "live"): BitrixSyncPayload {
  const start = new Date(snapshot.periodStart);
  const end = new Date(snapshot.periodEnd);
  const calendarDays = end.getUTCDate();
  const workingDays = workingDaysByPeriod[snapshot.period];

  const filteredInvoiceDeals = snapshot.deals.filter((deal) => filterDeal(deal, options));
  const filteredPaidDeals = (snapshot.paidDeals ?? []).filter((deal) => filterDeal(deal, options));

  const productLeadIds = options.product && options.product !== "all"
    ? new Set([
      ...filteredInvoiceDeals.map((deal) => deal.leadId),
      ...filteredPaidDeals.map((deal) => deal.leadId)
    ].filter((leadId): leadId is string => Boolean(leadId)))
    : null;

  const filterLead = (lead: BitrixSnapshotLead) => (
    matchesCountry(lead.country, options.country)
    && matchesManager(lead.assignedById, lead.managerName, options.manager)
    && (!productLeadIds || productLeadIds.has(lead.id))
  );

  const leadsRaw = snapshot.leads.filter(filterLead);
  const leads = leadsRaw.filter(isOperationalLead);
  const recentLeads = snapshot.recentLeads.filter(filterLead).filter(isOperationalLead);
  const lostDeals = filteredInvoiceDeals.filter((deal) => deal.stageSemanticId === "F");
  const paidLeads = leads.filter((lead) => isPaidLeadSource(lead.sourceId)).length;
  const organicLeads = leads.length - paidLeads;
  const invoicesAmount = filteredInvoiceDeals.reduce((sum, deal) => sum + (deal.invoiceAmount || deal.opportunity), 0);
  const revenue = filteredPaidDeals.reduce((sum, deal) => sum + deal.opportunity, 0);
  const cancelledAmount = lostDeals.reduce((sum, deal) => sum + (deal.invoiceAmount || deal.opportunity), 0);

  const days = new Map<string, DailyMetrics>();
  for (let day = 1; day <= calendarDays; day += 1) {
    const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.set(key, buildEmptyDay(key));
  }

  for (const lead of leads) {
    const row = days.get(dayKey(lead.dateCreate));
    if (!row) continue;
    if (isPaidLeadSource(lead.sourceId)) row.paidLeads += 1;
    else row.organicLeads += 1;
  }

  for (const deal of filteredInvoiceDeals) {
    const row = days.get(dayKey(deal.invoiceDate));
    if (!row) continue;
    row.invoicesCount += 1;
    row.invoicesAmount += deal.invoiceAmount || deal.opportunity;
  }

  for (const deal of filteredPaidDeals) {
    const row = days.get(dayKey(deal.closeDate));
    if (!row) continue;
    row.salesCount += 1;
    row.revenue += deal.opportunity;
  }

  const activeByDay = new Map<string, Set<string>>();
  for (const deal of [...filteredInvoiceDeals, ...filteredPaidDeals]) {
    const key = dayKey(deal.invoiceDate || deal.closeDate);
    if (!key) continue;
    activeByDay.set(key, activeByDay.get(key) ?? new Set<string>());
    activeByDay.get(key)?.add(deal.assignedById);
  }

  for (const [, row] of days) {
    row.activeManagers = activeByDay.get(row.date)?.size ?? 0;
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

  for (const deal of filteredInvoiceDeals) {
    byManager.set(deal.assignedById, byManager.get(deal.assignedById) ?? emptyManager(snapshot.period, deal.assignedById, deal.managerName));
    byManager.get(deal.assignedById)!.invoicesCount += 1;
  }

  for (const deal of filteredPaidDeals) {
    byManager.set(deal.assignedById, byManager.get(deal.assignedById) ?? emptyManager(snapshot.period, deal.assignedById, deal.managerName));
    const manager = byManager.get(deal.assignedById)!;
    manager.sales += 1;
    manager.revenue += deal.opportunity;
  }

  const countryInvoices = new Map<string, CountryInvoiceMetrics>();
  for (const deal of filteredInvoiceDeals) {
    const country = deal.country || "Не указано";
    const bucket = countryInvoices.get(country) ?? { country, invoicesCount: 0, invoicesAmount: 0, salesCount: 0, revenue: 0 };
    countryInvoices.set(country, addInvoiceBucket(bucket, "invoice", deal.invoiceAmount || deal.opportunity));
  }
  for (const deal of filteredPaidDeals) {
    const country = deal.country || "Не указано";
    const bucket = countryInvoices.get(country) ?? { country, invoicesCount: 0, invoicesAmount: 0, salesCount: 0, revenue: 0 };
    countryInvoices.set(country, addInvoiceBucket(bucket, "paid", deal.opportunity));
  }

  const managerInvoices = new Map<string, ManagerInvoiceMetrics>();
  for (const deal of filteredInvoiceDeals) {
    const managerId = deal.assignedById || "unknown";
    const manager = deal.managerName || `ID ${managerId}`;
    const bucket = managerInvoices.get(managerId) ?? { managerId, manager, invoicesCount: 0, invoicesAmount: 0, salesCount: 0, revenue: 0 };
    managerInvoices.set(managerId, addInvoiceBucket(bucket, "invoice", deal.invoiceAmount || deal.opportunity));
  }
  for (const deal of filteredPaidDeals) {
    const managerId = deal.assignedById || "unknown";
    const manager = deal.managerName || `ID ${managerId}`;
    const bucket = managerInvoices.get(managerId) ?? { managerId, manager, invoicesCount: 0, invoicesAmount: 0, salesCount: 0, revenue: 0 };
    managerInvoices.set(managerId, addInvoiceBucket(bucket, "paid", deal.opportunity));
  }

  const productInvoices = new Map<string, ProductInvoiceMetrics>();
  for (const deal of filteredInvoiceDeals) {
    const product = dominantProductName(deal);
    const bucket = productInvoices.get(product) ?? { product, invoicesCount: 0, invoicesAmount: 0, salesCount: 0, revenue: 0 };
    productInvoices.set(product, addInvoiceBucket(bucket, "invoice", deal.invoiceAmount || deal.opportunity));
  }
  for (const deal of filteredPaidDeals) {
    const product = dominantProductName(deal);
    const bucket = productInvoices.get(product) ?? { product, invoicesCount: 0, invoicesAmount: 0, salesCount: 0, revenue: 0 };
    productInvoices.set(product, addInvoiceBucket(bucket, "paid", deal.opportunity));
  }

  const usersLoaded = new Set([
    ...snapshot.leads.map((lead) => lead.assignedById),
    ...snapshot.recentLeads.map((lead) => lead.assignedById),
    ...snapshot.deals.map((deal) => deal.assignedById),
    ...(snapshot.paidDeals ?? []).map((deal) => deal.assignedById)
  ]).size;

  const invoicesFromDateField = filteredInvoiceDeals.filter((deal) => deal.invoiceSource === "invoice_date_field").length;
  const invoicesFromStageHistory = filteredInvoiceDeals.filter((deal) => deal.invoiceSource === "stage_history").length;

  return {
    monthly: {
      month: snapshot.period,
      paidLeads,
      organicLeads,
      qualifiedLeads: 0,
      invoicesCount: filteredInvoiceDeals.length,
      invoicesAmount,
      cancelledInvoicesCount: lostDeals.length,
      cancelledInvoicesAmount: cancelledAmount,
      salesCount: filteredPaidDeals.length,
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
      leadsRawLoaded: leadsRaw.length,
      leadsExcludedSpamReviews: leadsRaw.length - leads.length,
      recentClientsLoaded: recentLeads.length,
      dealsLoaded: filteredInvoiceDeals.length,
      paidDealsLoaded: filteredPaidDeals.length,
      invoicesFromDateField,
      invoicesFromStageHistory,
      usersLoaded,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.factualEnd,
      dataSource,
      snapshotUpdatedAt: snapshot.createdAt,
      snapshotPath: snapshotFilePath(snapshot.period),
      definitions: BITRIX_METRIC_DEFINITIONS,
      knownGaps: buildKnownGaps({
        invoicesCount: filteredInvoiceDeals.length,
        invoicesAmount,
        salesCount: filteredPaidDeals.length,
        revenue,
        leadsCount: leads.length,
        leadsRaw: leadsRaw.length,
        adSpend: 0
      })
    }
  };
}

export async function syncBitrixMetrics(options: BitrixSyncOptions = {}): Promise<BitrixSyncPayload> {
  const period = options.period ?? "july-2026";
  const { snapshot, dataSource } = await loadBitrixSnapshot(period, options.refresh);
  return aggregateBitrixSnapshot(snapshot, options, dataSource);
}

/**
 * Broader Bitrix deal universe for OS Orders:
 * created / invoiced / paid in period + active sales-funnel pipeline (STAGE_SEMANTIC_ID=P).
 */
export async function loadOsBitrixDealUniverse(period: PeriodKey): Promise<{
  deals: BitrixSnapshotDeal[];
  leads: BitrixSnapshotLead[];
  loadedAt: string;
}> {
  const now = new Date();
  const { start, factualEnd } = monthRangeForPeriod(period, now);
  const periodStart = isoDate(start);
  const factualEndIso = isoDate(factualEnd);
  const periodStartDate = dayKey(periodStart);
  const factualEndDate = dayKey(factualEndIso);

  const [createdDealsRaw, invoiceByDateRaw, invoiceStageHistory, paidDealsRaw, openPipelineRaw, periodLeadsRaw, users, countryMetadata] = await Promise.all([
    listAll<BitrixDeal>("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {
        ">=DATE_CREATE": periodStart,
        "<=DATE_CREATE": factualEndIso,
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      select: selectDeal
    }),
    listAll<BitrixDeal>("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {
        [`>=${BITRIX_INVOICE_DATE_FIELD}`]: periodStartDate,
        [`<=${BITRIX_INVOICE_DATE_FIELD}`]: factualEndDate,
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      select: selectDeal
    }),
    listAll<BitrixStageHistory>("crm.stagehistory.list", {
      entityTypeId: 2,
      order: { CREATED_TIME: "ASC" },
      filter: {
        ">=CREATED_TIME": periodStart,
        "<=CREATED_TIME": factualEndIso,
        "=CATEGORY_ID": BITRIX_SALES_CATEGORY_ID,
        "=STAGE_ID": BITRIX_INVOICE_STAGE_ID
      },
      select: ["OWNER_ID", "CREATED_TIME", "STAGE_ID", "CATEGORY_ID", "TYPE_ID"]
    }),
    listAll<BitrixDeal>("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {
        ">=CLOSEDATE": periodStartDate,
        "<=CLOSEDATE": factualEndDate,
        STAGE_SEMANTIC_ID: "S",
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      select: selectDeal
    }),
    listAll<BitrixDeal>("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID,
        STAGE_SEMANTIC_ID: "P"
      },
      select: selectDeal
    }),
    listAll<BitrixLead>("crm.lead.list", {
      order: { DATE_CREATE: "ASC" },
      filter: { ">=DATE_CREATE": periodStart, "<=DATE_CREATE": factualEndIso },
      select: selectLead
    }),
    listAll<BitrixUser>("user.get", {
      sort: "ID",
      order: "ASC",
      FILTER: { ACTIVE: true },
      SELECT: selectUser
    }, 500),
    loadCountryMetadata()
  ]);

  const { enumMaps } = countryMetadata;
  const userNames = buildUserNameMap(users);
  const leads = periodLeadsRaw.map((lead) => normalizeSnapshotLead(lead, userNames, enumMaps));
  const leadLookup = new Map(leads.map((lead) => [lead.id, lead]));

  const invoiceByDateIds = new Set(invoiceByDateRaw.map((deal) => String(deal.ID)));
  const invoiceStageEntries = new Map<string, BitrixStageHistory>();
  for (const entry of invoiceStageHistory) {
    const id = String(entry.OWNER_ID);
    if (!invoiceStageEntries.has(id)) invoiceStageEntries.set(id, entry);
  }
  const stageOnlyIds = Array.from(invoiceStageEntries.keys()).filter((id) => !invoiceByDateIds.has(id));
  const stageOnlyDealsRaw = stageOnlyIds.length ? await listDealsByIds(stageOnlyIds) : [];

  const rawById = new Map<string, BitrixDeal>();
  for (const deal of [...createdDealsRaw, ...invoiceByDateRaw, ...stageOnlyDealsRaw, ...paidDealsRaw, ...openPipelineRaw]) {
    rawById.set(String(deal.ID), deal);
  }

  const paidIds = new Set(paidDealsRaw.map((deal) => String(deal.ID)));
  const productRows = await listDealProductRows(Array.from(rawById.keys()));

  const deals = Array.from(rawById.values()).map((deal) => {
    const id = String(deal.ID);
    const fromDateField = invoiceByDateIds.has(id);
    const fieldDate = deal[BITRIX_INVOICE_DATE_FIELD as keyof BitrixDeal] as string | undefined;
    const invoiceDate = fromDateField
      ? (fieldDate ?? null)
      : (invoiceStageEntries.get(id)?.CREATED_TIME ?? fieldDate ?? null);
    const normalized = normalizeSnapshotDeal(
      deal,
      invoiceDate,
      userNames,
      enumMaps,
      productRows.get(id) ?? [],
      leadLookup,
      fromDateField ? "invoice_date_field" : (invoiceStageEntries.has(id) ? "stage_history" : undefined)
    );
    // Prefer paid deal CLOSEDATE / semantic when available.
    if (paidIds.has(id)) {
      const paid = paidDealsRaw.find((item) => String(item.ID) === id);
      if (paid) {
        return normalizeSnapshotDeal(
          paid,
          fieldDate ?? invoiceDate,
          userNames,
          enumMaps,
          productRows.get(id) ?? [],
          leadLookup,
          normalized.invoiceSource
        );
      }
    }
    return normalized;
  }).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

  return {
    deals,
    leads,
    loadedAt: new Date().toISOString()
  };
}

