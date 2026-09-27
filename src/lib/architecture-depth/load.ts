import { getGoogleAccessToken } from "@/lib/google/sheets-client";
import { syncClarityInsights } from "@/lib/clarity/clarity-connector";
import {
  buildLandingFunnel,
  getLandingDepth,
  type LandingDepthDef,
  type SectionFunnelRow
} from "@/lib/architecture-depth/sections";

const analyticsScope = "https://www.googleapis.com/auth/analytics.readonly";

type Ga4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  error?: { message?: string };
};

export type ArchitectureWindow = {
  id: "yesterday" | "week";
  label: string;
  sections: SectionFunnelRow[];
  ctaClicks: number;
  formStarts: number;
  formSubmits: number;
  productViews: number;
};

export type ArchitectureClaritySlice = {
  available: boolean;
  message: string | null;
  sessions: number;
  scrollDepth: number | null;
  deadClicks: number;
  rageClicks: number;
  quickbackClicks: number;
  url: string | null;
};

export type ArchitectureDepthReport = {
  landingId: string;
  kicker: string;
  updatedAt: string;
  pageUrl: string;
  breakdownError: string | null;
  realtimeSectionViews: number | null;
  yesterday: ArchitectureWindow;
  week: ArchitectureWindow;
  clarity: ArchitectureClaritySlice;
  canHypothesize: boolean;
  hypothesisNote: string;
};

function propertyId() {
  const id = process.env.GA4_PROPERTY_ID?.trim();
  if (!id) throw new Error("GA4_PROPERTY_ID не задан");
  return id;
}

function toNumber(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runGa4Report(body: Record<string, unknown>) {
  const accessToken = await getGoogleAccessToken(analyticsScope);
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId()}:runReport`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );
  const data = await response.json() as Ga4RunReportResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `GA4 ответил ${response.status}`);
  }
  return data;
}

function pageFilter(landing: LandingDepthDef) {
  return [
    {
      filter: {
        fieldName: "hostName",
        stringFilter: { matchType: "EXACT", value: landing.host }
      }
    },
    {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "CONTAINS", value: landing.path }
      }
    }
  ];
}

async function fetchSectionCounts(landing: LandingDepthDef, startDate: string, endDate: string) {
  const data = await runGa4Report({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "customEvent:section_name" }],
    metrics: [{ name: "totalUsers" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          ...pageFilter(landing),
          {
            filter: {
              fieldName: "eventName",
              stringFilter: { matchType: "EXACT", value: "section_view" }
            }
          }
        ]
      }
    },
    limit: 40
  });

  const counts: Partial<Record<string, number>> = {};
  for (const row of data.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value?.trim() ?? "";
    const section = landing.sections.find((item) => item.id === name);
    if (!section) continue;
    counts[section.id] = toNumber(row.metricValues?.[0]?.value);
  }
  return counts;
}

async function fetchActionCounts(landing: LandingDepthDef, startDate: string, endDate: string) {
  const data = await runGa4Report({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          ...pageFilter(landing),
          {
            filter: {
              fieldName: "eventName",
              inListFilter: {
                values: ["hero_cta_click", "order_form_start", "order_form_submit", "product_view"]
              }
            }
          }
        ]
      }
    },
    limit: 10
  });

  const counts = { ctaClicks: 0, formStarts: 0, formSubmits: 0, productViews: 0 };
  for (const row of data.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value;
    const value = toNumber(row.metricValues?.[0]?.value);
    if (name === "hero_cta_click") counts.ctaClicks = value;
    if (name === "order_form_start") counts.formStarts = value;
    if (name === "order_form_submit") counts.formSubmits = value;
    if (name === "product_view") counts.productViews = value;
  }
  return counts;
}

async function loadWindow(
  landing: LandingDepthDef,
  id: ArchitectureWindow["id"],
  label: string,
  startDate: string,
  endDate: string
): Promise<ArchitectureWindow> {
  const [counts, actions] = await Promise.all([
    fetchSectionCounts(landing, startDate, endDate),
    fetchActionCounts(landing, startDate, endDate)
  ]);
  return {
    id,
    label,
    sections: buildLandingFunnel(landing.sections, counts),
    ...actions
  };
}

async function fetchRealtimeSectionViews(landing: LandingDepthDef) {
  try {
    const accessToken = await getGoogleAccessToken(analyticsScope);
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId()}:runRealtimeReport`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            andGroup: {
              expressions: [
                {
                  filter: {
                    fieldName: "eventName",
                    stringFilter: { matchType: "EXACT", value: "section_view" }
                  }
                },
                {
                  filter: {
                    fieldName: "unifiedPagePathScreen",
                    stringFilter: { matchType: "CONTAINS", value: landing.path }
                  }
                }
              ]
            }
          },
          limit: 1
        }),
        cache: "no-store"
      }
    );
    const data = await response.json() as Ga4RunReportResponse;
    if (!response.ok) return null;
    return toNumber(data.rows?.[0]?.metricValues?.[0]?.value);
  } catch {
    return null;
  }
}

async function loadClaritySlice(landing: LandingDepthDef): Promise<ArchitectureClaritySlice> {
  try {
    const snapshot = await syncClarityInsights({ numOfDays: 3 });
    const match = snapshot.byUrl
      .filter((row) => {
        const value = row.value.toLowerCase();
        return value.includes(landing.host) && value.includes(landing.path);
      })
      .sort((a, b) => b.sessions - a.sessions)[0];
    if (!match) {
      return {
        available: false,
        message: `В Clarity за 3 дня ещё нет визитов ${landing.host}${landing.path}. Записи появятся, когда страница наберёт просмотры.`,
        sessions: 0,
        scrollDepth: null,
        deadClicks: 0,
        rageClicks: 0,
        quickbackClicks: 0,
        url: null
      };
    }
    return {
      available: true,
      message: null,
      sessions: match.sessions,
      scrollDepth: match.scrollDepth ?? null,
      deadClicks: match.deadClicks ?? 0,
      rageClicks: match.rageClicks ?? 0,
      quickbackClicks: match.quickbackClicks ?? 0,
      url: match.value
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Clarity недоступен";
    const message = /CLARITY_API_TOKEN/i.test(raw)
      ? "Сводка Clarity в кабинете не подключена. Записи сессий по-прежнему в проекте Clarity."
      : raw;
    return {
      available: false,
      message,
      sessions: 0,
      scrollDepth: null,
      deadClicks: 0,
      rageClicks: 0,
      quickbackClicks: 0,
      url: null
    };
  }
}

export async function loadLandingDepth(landingId: string): Promise<ArchitectureDepthReport> {
  const landing = getLandingDepth(landingId);
  if (!landing) throw new Error("Неизвестный лендинг");

  let breakdownError: string | null = null;
  let yesterday: ArchitectureWindow;
  let week: ArchitectureWindow;
  try {
    [yesterday, week] = await Promise.all([
      loadWindow(landing, "yesterday", "Вчера", "yesterday", "yesterday"),
      loadWindow(landing, "week", "7 дней", "7daysAgo", "today")
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось прочитать GA4";
    breakdownError = message;
    const empty = (id: ArchitectureWindow["id"], label: string): ArchitectureWindow => ({
      id,
      label,
      sections: buildLandingFunnel(landing.sections, {}),
      ctaClicks: 0,
      formStarts: 0,
      formSubmits: 0,
      productViews: 0
    });
    yesterday = empty("yesterday", "Вчера");
    week = empty("week", "7 дней");
  }

  const [clarity, realtimeSectionViews] = await Promise.all([
    loadClaritySlice(landing),
    fetchRealtimeSectionViews(landing)
  ]);
  const weekHero = week.sections[0]?.users ?? 0;
  const canHypothesize = !breakdownError && weekHero >= landing.minUsers;
  const waitingForProcessing = !breakdownError && weekHero === 0 && (realtimeSectionViews ?? 0) > 0;

  return {
    landingId: landing.id,
    kicker: landing.kicker,
    updatedAt: new Date().toISOString(),
    pageUrl: landing.pageUrl,
    breakdownError,
    realtimeSectionViews,
    yesterday,
    week,
    clarity,
    canHypothesize,
    hypothesisNote: breakdownError
      ? "Гипотезы недоступны, пока GA4 не отдаёт блоки."
      : waitingForProcessing
        ? `За последние 30 минут GA4 уже принял ${realtimeSectionViews} событий просмотра блоков. Разбивка по блокам доезжает в отчёт в течение суток, после этого здесь появится воронка.`
        : canHypothesize
          ? "Можно собрать гипотезы по семи дням."
          : `Гипотезы появятся, когда первый экран за 7 дней увидят хотя бы ${landing.minUsers} человек. Сейчас ${weekHero}.`
  };
}

export async function loadArchitectureDepth() {
  return loadLandingDepth("architecture");
}
