/**
 * Extra cohort dimensions: channel, traffic paid/organic, gift type, new/returning.
 */

import { inferProductFromDealTitle, isMissingProductLabel } from "@/lib/bitrix/gift-type-resolver";
import {
  BITRIX_SOURCE_CATALOG,
  bitrixSourceName,
  classifyMessengerSourceId,
  classifyUtmPair
} from "@/lib/traffic-os/taxonomy";

export type TrafficKind = "paid" | "organic" | "unknown";
export type CustomerKind = "new" | "returning" | "unknown";

export type ChannelClass = {
  key: string;
  label: string;
  trafficKind: TrafficKind;
};

function trafficFromFlags(isPaid: boolean, trafficType: string): TrafficKind {
  if (isPaid || trafficType === "paid") return "paid";
  if (
    trafficType.startsWith("organic") ||
    trafficType === "messenger" ||
    trafficType === "offline" ||
    trafficType === "referral" ||
    trafficType === "direct" ||
    trafficType === "email"
  ) {
    return "organic";
  }
  return "unknown";
}

export function classifyAcquisitionChannel(input: {
  sourceId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
}): ChannelClass {
  const sourceId = String(input.sourceId || "").trim();
  const messenger = classifyMessengerSourceId(sourceId);
  if (messenger) {
    return {
      key: messenger.channel.toLowerCase().replace(/\s+/g, "_"),
      label: messenger.channel,
      trafficKind: trafficFromFlags(messenger.is_paid, messenger.traffic_type)
    };
  }

  const utm = classifyUtmPair(input.utmSource || "", input.utmMedium || "");
  if (utm) {
    return {
      key: utm.source_group || utm.channel.toLowerCase().replace(/\s+/g, "_"),
      label: utm.channel,
      trafficKind: trafficFromFlags(utm.is_paid, utm.traffic_type)
    };
  }

  const catalog = BITRIX_SOURCE_CATALOG[sourceId];
  if (catalog?.rule) {
    return {
      key: catalog.rule.source_group || sourceId.toLowerCase(),
      label: catalog.rule.channel || catalog.name || sourceId,
      trafficKind: trafficFromFlags(catalog.rule.is_paid, catalog.rule.traffic_type)
    };
  }

  if (sourceId === "WEBFORM" || /form|форм/i.test(catalog?.name || "")) {
    return { key: "form", label: "Форма", trafficKind: "unknown" };
  }
  if (sourceId === "CALL" || sourceId === "CALLBACK") {
    return { key: "call", label: "Звонок", trafficKind: "organic" };
  }
  if (sourceId === "REPEAT_SALE") {
    return { key: "repeat_sale", label: "Повторная продажа", trafficKind: "organic" };
  }
  if (!sourceId) {
    return { key: "unknown", label: "Не указан", trafficKind: "unknown" };
  }

  return {
    key: sourceId.toLowerCase(),
    label: bitrixSourceName(sourceId) || sourceId,
    trafficKind: "unknown"
  };
}

export function trafficKindLabel(kind: TrafficKind): string {
  if (kind === "paid") return "Платный";
  if (kind === "organic") return "Органический";
  return "Не определён";
}

export function customerKindLabel(kind: CustomerKind): string {
  if (kind === "new") return "Новый клиент";
  if (kind === "returning") return "Повторный клиент";
  return "Не определён";
}

export function resolveGiftTypeLabel(input: {
  giftTypes?: string[] | null;
  productName?: string | null;
  title?: string | null;
}): string {
  const fromSpa = (input.giftTypes || []).map((g) => String(g).trim()).filter(Boolean);
  if (fromSpa.length) return fromSpa[0];
  const fromTitle = inferProductFromDealTitle(input.title);
  if (fromTitle) return fromTitle;
  if (input.productName && !isMissingProductLabel(input.productName)) {
    return String(input.productName).trim();
  }
  return "—";
}
