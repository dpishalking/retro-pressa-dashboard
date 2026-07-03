import type { DailyMetrics, ManagerMetrics, MonthlyMetrics, PeriodKey } from "@/types/metrics";

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

type BitrixLead = {
  ID: string;
  DATE_CREATE?: string;
  SOURCE_ID?: string;
  ASSIGNED_BY_ID?: string;
  UF_CRM_1737995147?: string | string[];
};

type BitrixDeal = {
  ID: string;
  DATE_CREATE?: string;
  CLOSEDATE?: string;
  OPPORTUNITY?: string;
  CATEGORY_ID?: string;
  STAGE_ID?: string;
  STAGE_SEMANTIC_ID?: string;
  SOURCE_ID?: string;
  ASSIGNED_BY_ID?: string;
  UF_CRM_6797B3DA00D16?: string | string[];
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
};

export type BitrixSyncPayload = {
  monthly: MonthlyMetrics;
  daily: DailyMetrics[];
  managers: ManagerMetrics[];
  countryOptions: string[];
  summary: {
    leadsLoaded: number;
    recentClientsLoaded: number;
    dealsLoaded: number;
    usersLoaded: number;
    periodStart: string;
    periodEnd: string;
  };
};

const leadCountryField = "UF_CRM_1737995147";
const dealCountryField = "UF_CRM_6797B3DA00D16";
const selectLead = ["ID", "DATE_CREATE", "SOURCE_ID", "ASSIGNED_BY_ID", leadCountryField];
const selectDeal = ["ID", "DATE_CREATE", "CLOSEDATE", "OPPORTUNITY", "CATEGORY_ID", "STAGE_ID", "STAGE_SEMANTIC_ID", "SOURCE_ID", "ASSIGNED_BY_ID", dealCountryField];
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

function monthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  return { start, end };
}

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

function dayKey(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function euroAmount(value?: string) {
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

async function listAll<T>(method: string, body: Record<string, unknown>, limit = 2000): Promise<T[]> {
  const rows: T[] = [];
  let start = 0;

  while (rows.length < limit) {
    const page = await callBitrix<T>(method, body, start);
    const result = page.result;
    const pageRows = Array.isArray(result) ? result : result?.items ?? [];
    rows.push(...pageRows);

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

function enumValueName(map: Map<string, string>, value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";
  return map.get(String(raw)) ?? String(raw);
}

function matchesCountry(name: string, country?: string) {
  return !country || country === "all" || name === country;
}

function filterLeadsByCountry(leads: BitrixLead[], enumMaps: BitrixEnumMaps, country?: string) {
  return leads.filter((lead) => matchesCountry(enumValueName(enumMaps.leadCountries, lead[leadCountryField]), country));
}

function filterDealsByCountry(deals: BitrixDeal[], enumMaps: BitrixEnumMaps, country?: string) {
  return deals.filter((deal) => matchesCountry(enumValueName(enumMaps.dealCountries, deal[dealCountryField]), country));
}

export async function syncBitrixMetrics(options: BitrixSyncOptions = {}): Promise<BitrixSyncPayload> {
  const now = new Date();
  const period = options.period ?? "july-2026";
  const { start, end, factualEnd } = monthRangeForPeriod(period, now);
  const periodStart = isoDate(start);
  const periodEnd = isoDate(factualEnd);
  const calendarDays = end.getUTCDate();

  const recentStart = isoDate(daysAgo(now, 10));

  const [allLeads, allRecentLeads, invoiceStageHistory, users, countryMetadata] = await Promise.all([
    listAll<BitrixLead>("crm.lead.list", {
      order: { DATE_CREATE: "ASC" },
      filter: { ">=DATE_CREATE": periodStart, "<=DATE_CREATE": periodEnd },
      select: selectLead
    }),
    listAll<BitrixLead>("crm.lead.list", {
      order: { DATE_CREATE: "ASC" },
      filter: { ">=DATE_CREATE": recentStart, "<=DATE_CREATE": periodEnd },
      select: selectLead
    }),
    listAll<BitrixStageHistory>("crm.stagehistory.list", {
      entityTypeId: 2,
      order: { CREATED_TIME: "ASC" },
      filter: {
        ">=CREATED_TIME": periodStart,
        "<=CREATED_TIME": periodEnd,
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

  const { countryOptions, enumMaps } = countryMetadata;
  const leads = filterLeadsByCountry(allLeads, enumMaps, options.country);
  const recentLeads = filterLeadsByCountry(allRecentLeads, enumMaps, options.country);
  const userNames = buildUserNameMap(users);
  const invoiceEntries = new Map<string, BitrixStageHistory>();
  for (const entry of invoiceStageHistory) {
    const id = String(entry.OWNER_ID);
    if (!invoiceEntries.has(id)) invoiceEntries.set(id, entry);
  }
  const invoiceDeals = filterDealsByCountry(await listDealsByIds(Array.from(invoiceEntries.keys())), enumMaps, options.country);
  const lostDeals = invoiceDeals.filter((deal) => deal.STAGE_SEMANTIC_ID === "F");
  const paidDeals = invoiceDeals.filter((deal) => deal.STAGE_SEMANTIC_ID === "S");
  const paidLeads = leads.filter((lead) => lead.SOURCE_ID && lead.SOURCE_ID !== "ORGANIC").length;
  const organicLeads = leads.length - paidLeads;
  const invoicesAmount = invoiceDeals.reduce((sum, deal) => sum + euroAmount(deal.OPPORTUNITY), 0);
  const revenue = paidDeals.reduce((sum, deal) => sum + euroAmount(deal.OPPORTUNITY), 0);
  const cancelledAmount = lostDeals.reduce((sum, deal) => sum + euroAmount(deal.OPPORTUNITY), 0);

  const days = new Map<string, DailyMetrics>();
  for (let day = 1; day <= calendarDays; day += 1) {
    const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.set(key, {
      date: key,
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
    });
  }

  for (const lead of leads) {
    const row = days.get(dayKey(lead.DATE_CREATE));
    if (!row) continue;
    if (lead.SOURCE_ID && lead.SOURCE_ID !== "ORGANIC") row.paidLeads += 1;
    else row.organicLeads += 1;
  }

  for (const deal of invoiceDeals) {
    const invoiceDate = invoiceEntries.get(deal.ID)?.CREATED_TIME;
    const row = days.get(dayKey(invoiceDate));
    if (!row) continue;
    row.invoicesCount += 1;
    row.invoicesAmount += euroAmount(deal.OPPORTUNITY);
    if (deal.STAGE_SEMANTIC_ID === "S") {
      row.salesCount += 1;
      row.revenue += euroAmount(deal.OPPORTUNITY);
    }
  }

  const activeByDay = new Map<string, Set<string>>();
  for (const deal of invoiceDeals) {
    const key = dayKey(invoiceEntries.get(deal.ID)?.CREATED_TIME);
    if (!key || !deal.ASSIGNED_BY_ID) continue;
    activeByDay.set(key, activeByDay.get(key) ?? new Set<string>());
    activeByDay.get(key)?.add(deal.ASSIGNED_BY_ID);
  }

  for (const [key, row] of days) {
    row.activeManagers = activeByDay.get(key)?.size ?? 0;
    row.averagePaidCheck = row.salesCount ? row.revenue / row.salesCount : 0;
  }

  const byManager = new Map<string, ManagerMetrics>();
  for (const lead of leads) {
    const id = lead.ASSIGNED_BY_ID || "unknown";
    byManager.set(id, byManager.get(id) ?? emptyManager(userNames.get(id) ?? `ID ${id}`));
    byManager.get(id)!.newLeads += 1;
  }

  for (const lead of recentLeads) {
    const id = lead.ASSIGNED_BY_ID || "unknown";
    byManager.set(id, byManager.get(id) ?? emptyManager(userNames.get(id) ?? `ID ${id}`));
    const manager = byManager.get(id)!;
    manager.recentClientsLast10Days += 1;
    if (!manager.lastClientAt || (lead.DATE_CREATE && lead.DATE_CREATE > manager.lastClientAt)) {
      manager.lastClientAt = lead.DATE_CREATE ?? manager.lastClientAt;
    }
  }

  for (const deal of invoiceDeals) {
    const id = deal.ASSIGNED_BY_ID || "unknown";
    byManager.set(id, byManager.get(id) ?? emptyManager(userNames.get(id) ?? `ID ${id}`));
    const manager = byManager.get(id)!;
    manager.invoicesCount += 1;
  }

  for (const deal of paidDeals) {
    const id = deal.ASSIGNED_BY_ID || "unknown";
    byManager.set(id, byManager.get(id) ?? emptyManager(userNames.get(id) ?? `ID ${id}`));
    const manager = byManager.get(id)!;
    manager.sales += 1;
    manager.revenue += euroAmount(deal.OPPORTUNITY);
  }

  return {
    monthly: {
      month: period,
      paidLeads,
      organicLeads,
      qualifiedLeads: 0,
      invoicesCount: invoiceDeals.length,
      invoicesAmount,
      cancelledInvoicesCount: lostDeals.length,
      cancelledInvoicesAmount: cancelledAmount,
      salesCount: paidDeals.length,
      revenue,
      adSpend: 0,
      paidSalesCount: null,
      workingDays: 21,
      calendarDays
    },
    daily: Array.from(days.values()),
    managers: Array.from(byManager.values()),
    countryOptions,
    summary: {
      leadsLoaded: leads.length,
      recentClientsLoaded: recentLeads.length,
      dealsLoaded: invoiceDeals.length,
      usersLoaded: users.length,
      periodStart,
      periodEnd
    }
  };
}

function emptyManager(manager: string): ManagerMetrics {
  return {
    period: "july-2026",
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
