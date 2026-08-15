import { metricDefinition, metricLabel } from "@/lib/analytics-os/metric-glossary";
import type { SliceDimensionDef, SliceDimensionId, SliceMetricId } from "./types";

export const SLICE_DIMENSIONS: SliceDimensionDef[] = [
  {
    id: "country",
    label: "Страна",
    filterKey: "country",
    dealOnly: false,
    supportsDrill: true,
    nextHints: ["product", "source", "manager"]
  },
  {
    id: "product",
    label: "Продукт",
    filterKey: "productId",
    dealOnly: true,
    supportsDrill: true,
    detailRoute: "/os/products",
    detailLabel: "Подробнее о продуктах",
    nextHints: ["country", "source", "manager"]
  },
  {
    id: "manager",
    label: "Менеджер",
    filterKey: "managerId",
    dealOnly: false,
    supportsDrill: true,
    nextHints: ["source", "product", "country"]
  },
  {
    id: "source",
    label: "Источник",
    filterKey: "sourceId",
    dealOnly: false,
    supportsDrill: true,
    nextHints: ["manager", "product", "country"],
    coverageNote: "SOURCE_ID и UTM заполнены не у всех лидов. Пустые — «Не указан»."
  },
  {
    id: "channel",
    label: "Канал",
    filterKey: "channel",
    dealOnly: false,
    supportsDrill: true,
    nextHints: ["source", "manager", "product"],
    coverageNote: "Канал из taxonomy Bitrix SOURCE_ID + UTM, не Ads API."
  },
  {
    id: "gift",
    label: "Тип подарка",
    filterKey: "gift",
    dealOnly: true,
    supportsDrill: true,
    detailRoute: "/os/products",
    detailLabel: "Продукты",
    nextHints: ["country", "source"]
  },
  {
    id: "traffic",
    label: "Платный / органика",
    filterKey: "traffic",
    dealOnly: false,
    supportsDrill: true,
    nextHints: ["channel", "source", "manager"]
  },
  {
    id: "customer",
    label: "Новый / повтор",
    filterKey: "customer",
    dealOnly: false,
    supportsDrill: true,
    nextHints: ["product", "country"]
  },
  {
    id: "time",
    label: "Время (оплаты)",
    filterKey: "timeKey",
    dealOnly: true,
    supportsDrill: true,
    detailRoute: "/os/plan",
    detailLabel: "План / факт",
    nextHints: ["country", "product", "source"]
  },
  {
    id: "cohort",
    label: "Когорта (создание лида)",
    filterKey: "cohortKey",
    dealOnly: false,
    supportsDrill: true,
    detailRoute: "/os/cohorts",
    detailLabel: "Открыть когорты",
    nextHints: ["country", "source", "manager"]
  }
];

export const SLICE_METRICS: Array<{ id: SliceMetricId; glossaryId: string; label: string }> = [
  { id: "revenue", glossaryId: "revenue", label: metricLabel("revenue") },
  { id: "sales", glossaryId: "paid_orders", label: metricLabel("paid_orders") },
  { id: "leads", glossaryId: "bitrix_cards", label: "Лиды (Bitrix)" },
  { id: "cr", glossaryId: "conversion_rate", label: metricLabel("conversion_rate") },
  { id: "aov", glossaryId: "aov", label: metricLabel("aov") }
];

export function getSliceDimension(id: string): SliceDimensionDef | null {
  return SLICE_DIMENSIONS.find((item) => item.id === id) ?? null;
}

export function parseSliceDimension(id: string | null | undefined): SliceDimensionId {
  return getSliceDimension(id || "")?.id ?? "country";
}

export function parseSliceMetric(id: string | null | undefined): SliceMetricId {
  if (id === "sales" || id === "leads" || id === "cr" || id === "aov" || id === "revenue") return id;
  return "revenue";
}

export function sliceMetricHint(id: SliceMetricId): string {
  const row = SLICE_METRICS.find((item) => item.id === id);
  return (row ? metricDefinition(row.glossaryId) : null) || "";
}

export function sliceExplorerHref(options: {
  dim: SliceDimensionId;
  metric?: SliceMetricId;
  period?: string;
  country?: string | null;
  managerId?: string | null;
  productId?: string | null;
}): string {
  const params = new URLSearchParams({ dim: options.dim });
  if (options.metric) params.set("metric", options.metric);
  if (options.period) params.set("period", options.period);
  if (options.country) params.set("country", options.country);
  if (options.managerId) params.set("managerId", options.managerId);
  if (options.productId) params.set("productId", options.productId);
  return `/os/slices?${params}`;
}
