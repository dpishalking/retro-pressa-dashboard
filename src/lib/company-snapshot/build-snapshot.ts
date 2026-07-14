import path from "node:path";
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import { readBitrixSnapshot } from "@/lib/bitrix/snapshot-store";
import { readPeriodArchive } from "@/lib/conversation-snapshot-store";
import { syncGoogleTraffic } from "@/lib/google/traffic-connector";
import { readGoogleTrafficSnapshot } from "@/lib/google/snapshot-store";
import {
  averagePaidCheck,
  invoiceConversion,
  paidCpl,
  salesConversion,
  totalLeads
} from "@/lib/metrics-engine";
import type {
  ConversationDashboardMetrics,
  DialogueQualityMetrics,
  MonthlyMetrics,
  PeriodKey
} from "@/types/metrics";
import {
  buildCanonicalMonthly,
  demoDriverDefaults,
  demoQuality,
  fallbackDriverValues,
  mergeDailySeries,
  resolveDataMode
} from "./fallback";
import { metric, unavailableMetric } from "./metric";
import { collectReconciliations, reconcileMetric } from "./reconciliation";
import { loadAllSheetSources } from "./sheet-sources";
import { readCompanySnapshot, writeCompanySnapshot } from "./snapshot-store";
import { ssotRule } from "./ssot-rules";
import type {
  BuildSnapshotOptions,
  CompanySnapshot,
  CompanySnapshotPayload,
  SourceAvailability,
  SnapshotSourceId
} from "./types";

const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

const periodOrder: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

function previousPeriod(period: PeriodKey): PeriodKey | null {
  const index = periodOrder.indexOf(period);
  return index > 0 ? periodOrder[index - 1]! : null;
}

function conversationToDialogueQuality(
  period: PeriodKey,
  conversation: ConversationDashboardMetrics | null
): DialogueQualityMetrics {
  const fallback = demoQuality(period);
  if (!conversation) return { ...fallback };

  return {
    ...fallback,
    targetDialogs: conversation.totalDialogs,
    meaningfulDialogs: conversation.totalDialogs,
    personalRecommendationPct: Math.max(0, (1 - conversation.recommendationMissingShare) * 100),
    deliveryDeadlineQualificationPct: Math.max(0, (1 - conversation.deliveryRiskShare) * 100)
  };
}

async function loadTrainingSummary() {
  try {
    const progressDir = path.join(process.cwd(), "data", "training", "progress");
    const { readdir, readFile } = await import("node:fs/promises");
    const files = (await readdir(progressDir)).filter((file) => file.endsWith(".json"));
    let completedModules = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const file of files) {
      const raw = await readFile(path.join(progressDir, file), "utf8");
      const parsed = JSON.parse(raw) as {
        modules?: Array<{ status?: string; bestScore?: number }>;
      };
      const modules = parsed.modules ?? [];
      completedModules += modules.filter((m) => m.status === "completed").length;
      for (const module of modules) {
        if (typeof module.bestScore === "number") {
          scoreSum += module.bestScore;
          scoreCount += 1;
        }
      }
    }

    return {
      activeTrainees: files.length,
      completedModules,
      averageQuizScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
      available: files.length > 0
    };
  } catch {
    return { activeTrainees: 0, completedModules: 0, averageQuizScore: 0, available: false };
  }
}

function sheetMetricMap(
  entries: Awaited<ReturnType<typeof loadAllSheetSources>>["entries"]
): Map<string, { value: number; source: SnapshotSourceId; updatedAt: string | null }> {
  const map = new Map<string, { value: number; source: SnapshotSourceId; updatedAt: string | null }>();
  for (const entry of entries) {
    for (const row of entry.metrics) {
      map.set(row.metricId, {
        value: row.value,
        source: entry.config.sourceId,
        updatedAt: entry.updatedAt
      });
    }
  }
  return map;
}

function pickSheetMetric(
  map: Map<string, { value: number; source: SnapshotSourceId; updatedAt: string | null }>,
  metricId: string,
  fallbackValue: number
) {
  const found = map.get(metricId);
  if (found) return metric(found.value, found.source, found.updatedAt, true);
  return metric(fallbackValue, "demo_fallback", null, false);
}

export async function buildCompanySnapshot(options: BuildSnapshotOptions): Promise<CompanySnapshot> {
  const period = options.period;
  const defaults = demoDriverDefaults();
  const driverFallback = fallbackDriverValues(period);

  if (options.refresh) {
    await Promise.allSettled([
      syncBitrixMetrics({ period, refresh: true }),
      syncGoogleTraffic({ period, refresh: true })
    ]);
  }

  const [bitrixSnapshot, googleSnapshot, conversationArchive, sheetSources, training] = await Promise.all([
    readBitrixSnapshot(period),
    readGoogleTrafficSnapshot(period),
    readPeriodArchive(period),
    loadAllSheetSources(period),
    loadTrainingSummary()
  ]);

  let bitrixPayload: Awaited<ReturnType<typeof syncBitrixMetrics>> | null = null;
  if (bitrixSnapshot) {
    bitrixPayload = await syncBitrixMetrics({ period, refresh: false });
  }

  const bitrixMonthly = bitrixPayload?.monthly ?? null;
  const googleMonthly: Partial<MonthlyMetrics> | null = googleSnapshot
    ? {
        paidLeads: googleSnapshot.summary.paidLeads,
        organicLeads: googleSnapshot.summary.organicLeads,
        qualifiedLeads: googleSnapshot.summary.ql,
        adSpend: googleSnapshot.summary.spend
      }
    : null;

  const canonical = buildCanonicalMonthly({
    period,
    bitrix: bitrixMonthly,
    google: googleMonthly,
    workingDays: bitrixMonthly?.workingDays ?? 0,
    calendarDays: bitrixMonthly?.calendarDays ?? 0
  });

  const leads = totalLeads(canonical);
  const sheetMap = sheetMetricMap(sheetSources.entries);

  const reconciliations = collectReconciliations([
    reconcileMetric(ssotRule("paidLeads")!, canonical.paidLeads, googleMonthly?.paidLeads ?? null, "google_marketing"),
    reconcileMetric(ssotRule("organicLeads")!, canonical.organicLeads, googleMonthly?.organicLeads ?? null, "google_marketing"),
    reconcileMetric(ssotRule("qualifiedLeads")!, canonical.qualifiedLeads, bitrixMonthly?.qualifiedLeads ?? null, "bitrix")
  ]);

  const conversation = conversationArchive?.dashboard ?? null;
  const dialogue = conversationToDialogueQuality(period, conversation);

  const managerCount = bitrixPayload?.managers.length ?? driverFallback.managerCount ?? defaults.managerCount ?? 8;
  const leadsPerManager = safeDiv(leads, Math.max(1, managerCount));

  const sources: SourceAvailability[] = [
    {
      id: "bitrix",
      available: Boolean(bitrixSnapshot),
      updatedAt: bitrixSnapshot?.createdAt ?? null
    },
    {
      id: "google_marketing",
      available: Boolean(googleSnapshot),
      updatedAt: googleSnapshot?.createdAt ?? null
    },
    {
      id: "conversation_analytics",
      available: Boolean(conversation),
      updatedAt: conversationArchive?.importedAt ?? null
    },
    {
      id: "training",
      available: training.available,
      updatedAt: training.available ? new Date().toISOString() : null
    },
    ...sheetSources.entries.map((entry) => ({
      id: entry.config.sourceId,
      available: entry.available,
      updatedAt: entry.updatedAt,
      note: entry.available ? undefined : `${entry.config.label} не настроен`
    })),
    {
      id: "bank",
      available: sheetSources.bank.available,
      updatedAt: sheetSources.bank.updatedAt,
      note: sheetSources.bank.available ? undefined : "BANK_BALANCE_FILE не настроен"
    }
  ];

  const daily = mergeDailySeries(bitrixPayload?.daily ?? [], googleSnapshot?.daily ?? []);

  return {
    version: 1,
    meta: {
      period,
      builtAt: new Date().toISOString(),
      dataMode: resolveDataMode(sources),
      sources,
      reconciliations
    },
    marketing: {
      paidLeads: metric(canonical.paidLeads, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      organicLeads: metric(canonical.organicLeads, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      qualifiedLeads: metric(canonical.qualifiedLeads, "google_marketing", googleSnapshot?.createdAt ?? null, Boolean(googleSnapshot)),
      adSpend: metric(canonical.adSpend, "google_marketing", googleSnapshot?.createdAt ?? null, Boolean(googleSnapshot)),
      cpl: metric(paidCpl(canonical), "computed", googleSnapshot?.createdAt ?? bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot || googleSnapshot)),
      cpql: metric(safeDiv(canonical.adSpend, Math.max(1, canonical.qualifiedLeads)), "computed", googleSnapshot?.createdAt ?? null, Boolean(googleSnapshot)),
      daily: googleSnapshot?.daily ?? daily,
      markets: googleSnapshot?.summary.markets ?? [],
      channels: googleSnapshot?.summary.channels ?? []
    },
    sales: {
      revenue: metric(canonical.revenue, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      salesCount: metric(canonical.salesCount, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      invoicesCount: metric(canonical.invoicesCount, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      invoicesAmount: metric(canonical.invoicesAmount, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      cancelledInvoicesCount: metric(canonical.cancelledInvoicesCount, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      cancelledInvoicesAmount: metric(canonical.cancelledInvoicesAmount, "bitrix", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      averagePaidCheck: metric(averagePaidCheck(canonical), "computed", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      salesConversion: metric(salesConversion(canonical), "computed", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot || googleSnapshot)),
      invoiceConversion: metric(invoiceConversion(canonical), "computed", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot || googleSnapshot)),
      managers: bitrixPayload?.managers ?? [],
      invoiceCountries: bitrixPayload?.invoiceCountries ?? [],
      invoiceManagers: bitrixPayload?.invoiceManagers ?? [],
      invoiceProducts: bitrixPayload?.invoiceProducts ?? [],
      countryOptions: bitrixPayload?.countryOptions ?? [],
      productOptions: bitrixPayload?.productOptions ?? []
    },
    finance: {
      payroll: pickSheetMetric(
        sheetMap,
        "payroll",
        (defaults.avgSalary ?? 1200) * (managerCount + (defaults.productionStaff ?? 6) + (defaults.supportStaff ?? 2))
      ),
      overheadFixed: pickSheetMetric(sheetMap, "overheadFixed", defaults.overheadFixed ?? 3500),
      unitCost: pickSheetMetric(sheetMap, "unitCost", defaults.unitCost ?? 18.5),
      taxRate: pickSheetMetric(sheetMap, "taxRate", defaults.taxRate ?? 0.12),
      discountRate: pickSheetMetric(sheetMap, "discountRate", defaults.discountRate ?? 0.05),
      deliveryCost: pickSheetMetric(sheetMap, "deliveryCost", defaults.deliveryCost ?? 8.5),
      cashBalance: sheetSources.bank.available
        ? metric(sheetSources.bank.value ?? 0, "bank", sheetSources.bank.updatedAt, true)
        : unavailableMetric("bank")
    },
    production: {
      productionHours: pickSheetMetric(sheetMap, "productionHours", defaults.productionHours ?? 1600),
      hoursPerOrder: pickSheetMetric(sheetMap, "hoursPerOrder", defaults.hoursPerOrder ?? 2.8),
      defectRate: pickSheetMetric(sheetMap, "defectRate", defaults.defectRate ?? 0.03),
      maxOrders: metric(
        Math.floor(safeDiv(defaults.productionHours ?? 1600, defaults.hoursPerOrder ?? 2.8)),
        "computed",
        null,
        true
      ),
      utilization: metric(0, "computed", null, false)
    },
    hr: {
      managerCount: metric(managerCount, bitrixSnapshot ? "bitrix" : "demo_fallback", bitrixSnapshot?.createdAt ?? null, Boolean(bitrixSnapshot)),
      productionStaff: pickSheetMetric(sheetMap, "productionStaff", defaults.productionStaff ?? 6),
      supportStaff: pickSheetMetric(sheetMap, "supportStaff", defaults.supportStaff ?? 2),
      avgSalary: pickSheetMetric(sheetMap, "avgSalary", defaults.avgSalary ?? 1200),
      leadsPerManager: metric(leadsPerManager, "computed", null, true),
      managerProductivity: metric(safeDiv(canonical.salesCount, Math.max(1, managerCount)), "computed", null, Boolean(bitrixSnapshot))
    },
    quality: {
      dialogue,
      conversation,
      qualityScore: metric(conversation?.qualityScore ?? 0, "conversation_analytics", conversationArchive?.importedAt ?? null, Boolean(conversation)),
      potentialLostRevenue: metric(conversation?.potentialLostRevenue ?? 0, "conversation_analytics", conversationArchive?.importedAt ?? null, Boolean(conversation))
    },
    training: {
      activeTrainees: metric(training.activeTrainees, "training", null, training.available),
      completedModules: metric(training.completedModules, "training", null, training.available),
      averageQuizScore: metric(training.averageQuizScore, "training", null, training.available)
    },
    canonical,
    daily
  };
}

export async function getCompanySnapshot(
  options: BuildSnapshotOptions & { forceRebuild?: boolean }
): Promise<CompanySnapshotPayload> {
  if (!options.forceRebuild && !options.refresh) {
    const cached = await readCompanySnapshot(options.period);
    if (cached) {
      const prevKey = options.previousPeriod ?? previousPeriod(options.period);
      const previous = prevKey ? await readCompanySnapshot(prevKey) : null;
      return { snapshot: cached, previous, builtAt: cached.meta.builtAt, fromCache: true };
    }
  }

  const snapshot = await buildCompanySnapshot(options);
  await writeCompanySnapshot(snapshot);

  const prevKey = options.previousPeriod ?? previousPeriod(options.period);
  const previous = prevKey ? await buildCompanySnapshot({ period: prevKey, refresh: false }) : null;

  return {
    snapshot,
    previous,
    builtAt: snapshot.meta.builtAt,
    fromCache: false
  };
}
