import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { syncBitrixMetrics } from "@/lib/bitrix/connector";
import { readBitrixSnapshot, type BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";
import { readLivePeriodStore } from "@/lib/conversation-live-store";
import type { ConversationMessage, DialogSummary, PeriodKey } from "@/types/metrics";
import { parseConversationFile, summarizeDialogs } from "@/lib/conversation-intelligence";

const periodFiles: Record<PeriodKey, string> = {
  "may-2026": "retro-pressa-conversations-2026-05.json",
  "june-2026": "retro-pressa-conversations-2026-06.json",
  "july-2026": "retro-pressa-conversations-2026-07.json",
};

export type ManagerDialogExportRow = {
  dialogId: string;
  dealId?: string;
  managerName: string | null;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  outcome: string;
  orderAmount: number;
  occasion: string;
  dialogText: string;
  chatFound?: boolean;
};

export type ManagerDialogSuccessSource = "bitrix" | "text";

type RawConversationDialog = {
  dialogId: string;
  leadId: string | null;
  dealId: string | null;
  serialized: string;
};

function normalizeManagerQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function inferManagerNameFromMessages(messages: ConversationMessage[]): string | null {
  const managerMessages = messages
    .filter((message) => message.senderRole === "manager" || /менеджер/i.test(message.sender))
    .sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")));

  for (const message of managerMessages.slice(0, 3)) {
    const text = message.text;
    const named =
      text.match(/Меня зовут ([А-ЯA-ZЁ][а-яa-zё-]+(?:\s+[А-ЯA-ZЁ][а-яa-zё-]+)?)/i)?.[1]
      ?? text.match(/Это ([А-ЯA-ZЁ][а-яa-zё-]+),?\s*(?:я )?менеджер/i)?.[1];
    if (named) return named.trim();
  }

  return managerMessages[0]?.sender?.trim() || null;
}

const firstNameAliases: Record<string, string[]> = {
  elena: ["elena", "jelena", "елена"],
  елена: ["elena", "jelena", "елена"],
  jelena: ["elena", "jelena", "елена"],
  anastasija: ["anastasija", "anastasia", "анастасия"],
  anastasia: ["anastasija", "anastasia", "анастасия"],
  анастасия: ["anastasija", "anastasia", "анастасия"],
};

const lastNameAliases: Record<string, string[]> = {
  zabkova: ["zabkova", "забкова", "zubkova", "зубкова"],
  забкова: ["zabkova", "забкова", "zubkova", "зубкова"],
  zubkova: ["zabkova", "забкова", "zubkova", "зубкова"],
  зубкова: ["zabkova", "забкова", "zubkova", "зубкова"],
};

function expandNamePart(part: string) {
  const normalized = normalizeManagerQuery(part);
  return firstNameAliases[normalized] ?? lastNameAliases[normalized] ?? [normalized];
}

function namePartsMatchQuery(name: string, query: string) {
  const normalizedName = normalizeManagerQuery(name);
  const queryParts = normalizeManagerQuery(query).split(" ").filter(Boolean);
  const [firstName, ...lastNameParts] = queryParts;
  if (!firstName) return false;

  const firstMatches = expandNamePart(firstName).some((part) => normalizedName.includes(part));
  if (!firstMatches) return false;
  if (lastNameParts.length === 0) return true;
  if (normalizedName === normalizeManagerQuery(firstName)) return true;

  return lastNameParts.every((part) => expandNamePart(part).some((alias) => normalizedName.includes(alias)));
}

export function isAllManagersQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || normalized === "*" || normalized === "all" || normalized === "все";
}

export function managerMatchesQuery(managerName: string | null, query: string): boolean {
  if (isAllManagersQuery(query)) return Boolean(managerName);
  if (!managerName) return false;
  return namePartsMatchQuery(managerName, query);
}

export function managerMatchesBitrixDeal(deal: Pick<BitrixSnapshotDeal, "managerName">, query: string) {
  if (isAllManagersQuery(query)) return true;
  return namePartsMatchQuery(deal.managerName, query);
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadPeriodConversationData(input: {
  periodKey: PeriodKey;
  exportDir: string;
}): Promise<{
  messages: ConversationMessage[];
  rawDialogs: RawConversationDialog[];
  source: string;
}> {
  const filename = periodFiles[input.periodKey];
  if (!filename) throw new Error(`Unknown period: ${input.periodKey}`);

  const exportPath = path.join(input.exportDir, filename);
  if (await fileExists(exportPath)) {
    const raw = await readFile(exportPath, "utf8");
    const messages = parseConversationFile({
      filename,
      content: raw,
      defaultChannel: "gift-ai",
    });
    return {
      messages,
      rawDialogs: parseRawConversationDialogs(raw),
      source: filename,
    };
  }

  const liveStore = await readLivePeriodStore(input.periodKey);
  if (liveStore?.messages.length) {
    const rawDialogs = liveStore.messages.reduce<RawConversationDialog[]>((acc, message) => {
      if (acc.some((dialog) => dialog.dialogId === message.dialogId)) return acc;
      acc.push({
        dialogId: message.dialogId,
        leadId: null,
        dealId: null,
        serialized: JSON.stringify({ dialog_id: message.dialogId }),
      });
      return acc;
    }, []);
    return {
      messages: liveStore.messages,
      rawDialogs,
      source: "bitrix-live-store",
    };
  }

  throw new Error(
    `No conversation data for ${input.periodKey}. Run daily Bitrix sync or upload a gift-ai export.`,
  );
}

function formatDialogText(messages: ConversationMessage[]): string {
  return [...messages]
    .sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")))
    .map((message) => {
      const role = message.senderRole === "manager" ? "Менеджер" : message.senderRole === "client" ? "Клиент" : message.sender;
      const date = message.date ? new Date(message.date).toLocaleString("ru-RU") : "";
      return `[${date}] ${role}: ${message.text}`;
    })
    .join("\n");
}

export type DialogSuccessTier = "paid" | "invoice_sent";

export type DialogSuccessClassification = {
  tier: DialogSuccessTier;
  label: string;
};

const clientDeferralPatterns = [
  /подумаю/i,
  /надо подумать/i,
  /ещё подумаю/i,
  /еще подумаю/i,
  /сообщу позже/i,
  /напишу позже/i,
  /пока не/i,
  /не актуально/i,
  /передум/i,
  /отлож/i,
  /не будем/i,
  /не надо/i,
  /откаж/i,
  /пока нет/i,
  /вернусь позже/i,
];

const invoicePatterns = [
  /выстав(?:лю|ила|ить|ляю)\s+(?:вам\s+)?сч[её]т/i,
  /подготов(?:лю|ила)\s+(?:вам\s+)?(?:сч[eё]т|данные для оформления)/i,
  /выш(?:лю|л(?:a|и)?)\s+(?:вам\s+)?(?:сюда\s+)?(?:сч[eё]т|invoice)/i,
  /сч[eё]т\s+(?:номер|№|#)/i,
  /номер\s+сч[eё]та/i,
  /сумма к оплате/i,
  /итого[^\n]{0,80}(?:могу|выстав)/i,
  /оплатить заказ можно/i,
  /банковск(?:ой|ую)\s+ссылк/i,
];

const paymentPatterns = [
  /оплат[уы]\s+получ/i,
  /оплата получена/i,
  /получили\s+оплат/i,
  /перевод\s+получ/i,
  /payment received/i,
  /оплатил(?:а)?(?:\s|$|[!.])/i,
  /оплачено/i,
  /оплачиваю/i,
  /перев(?:ёл|ел|ела)\s+(?:деньги|сумму|оплат)/i,
];

function sortedDialogMessages(messages: ConversationMessage[]) {
  return [...messages].sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")));
}

function isClientMessage(message: ConversationMessage) {
  return message.senderRole === "client" || /клиент|client/i.test(message.sender);
}

function isManagerMessage(message: ConversationMessage) {
  return message.senderRole === "manager" || /менеджер|manager/i.test(message.sender);
}

function closingMessages(messages: ConversationMessage[]) {
  const sorted = sortedDialogMessages(messages);
  const tailSize = Math.max(6, Math.ceil(sorted.length * 0.35));
  return sorted.slice(-tailSize);
}

function lastClientMessage(messages: ConversationMessage[]) {
  const sorted = sortedDialogMessages(messages);
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const message = sorted[index]!;
    if (isClientMessage(message)) return message;
  }
  return null;
}

function textMatchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function chatShowsPaymentConfirmation(messages: ConversationMessage[]): boolean {
  if (messages.length === 0) return false;

  const dialogText = sortedDialogMessages(messages).map((message) => message.text).join("\n");
  return textMatchesAny(dialogText, paymentPatterns);
}

function bitrixDealQualifiesAsSuccessful(deal: BitrixSnapshotDeal, dialogMessages: ConversationMessage[]) {
  return deal.stageSemanticId === "S"
    && dialogMessages.length > 0
    && chatShowsPaymentConfirmation(dialogMessages);
}

function outcomeForUnsuccessfulBitrixDeal(deal: BitrixSnapshotDeal, dialogMessages: ConversationMessage[]) {
  if (deal.stageSemanticId === "S" && !chatShowsPaymentConfirmation(dialogMessages)) {
    return "оплата в CRM, в чате не подтверждена";
  }
  if (deal.stageSemanticId !== "S" && textMatchesAny(
    closingMessages(dialogMessages).filter(isManagerMessage).map((message) => message.text).join("\n"),
    invoicePatterns,
  )) {
    return "счёт выставлен, оплаты нет";
  }
  return classifyUnsuccessfulDialogForExport(dialogMessages);
}

export function classifySuccessfulDialogForExport(
  messages: ConversationMessage[],
): DialogSuccessClassification | null {
  if (messages.length === 0) return null;

  const lastClient = lastClientMessage(messages);
  if (lastClient && textMatchesAny(lastClient.text, clientDeferralPatterns)) {
    return null;
  }

  const tail = closingMessages(messages);
  const tailText = tail.map((message) => message.text).join("\n");
  const managerTailText = tail.filter(isManagerMessage).map((message) => message.text).join("\n");
  const clientTailText = tail.filter(isClientMessage).map((message) => message.text).join("\n");

  const hasPayment = textMatchesAny(tailText, paymentPatterns);
  const hasInvoice = textMatchesAny(managerTailText, invoicePatterns);

  if (hasPayment) {
    return { tier: "paid", label: "оплата" };
  }

  if (!hasInvoice) return null;

  // Invoice sent, but client still hesitating in the closing messages.
  if (textMatchesAny(clientTailText, clientDeferralPatterns)) {
    return null;
  }

  return { tier: "invoice_sent", label: "счёт выставлен" };
}

export function classifyUnsuccessfulDialogForExport(messages: ConversationMessage[]): string {
  if (classifySuccessfulDialogForExport(messages)?.tier === "paid") {
    return "успешный";
  }

  const lastClient = lastClientMessage(messages);
  if (lastClient && textMatchesAny(lastClient.text, clientDeferralPatterns)) {
    return "подумаю / отложил";
  }

  const tail = closingMessages(messages);
  const clientTailText = tail.filter(isClientMessage).map((message) => message.text).join("\n");
  const managerTailText = tail.filter(isManagerMessage).map((message) => message.text).join("\n");

  if (textMatchesAny(clientTailText, [/не актуально/i, /передум/i, /не надо/i, /откаж/i, /не будем/i])) {
    return "отказ";
  }
  if (/дорого|не подходит|слишком/i.test(clientTailText)) {
    return "возражение / не устроило";
  }
  if (textMatchesAny(managerTailText, invoicePatterns)) {
    return "счёт был, без оплаты";
  }
  return "не дошло до счёта";
}

function parseRawConversationDialogs(raw: string): RawConversationDialog[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  return parsed.map((item) => {
    const dialog = item as Record<string, unknown>;
    return {
      dialogId: String(dialog.dialog_id ?? dialog.id ?? ""),
      leadId: dialog.lead_id ? String(dialog.lead_id) : null,
      dealId: dialog.deal_id ? String(dialog.deal_id) : null,
      serialized: JSON.stringify(dialog),
    };
  }).filter((dialog) => dialog.dialogId);
}

function findDialogForBitrixDeal(
  deal: BitrixSnapshotDeal,
  rawDialogs: RawConversationDialog[],
): RawConversationDialog | null {
  const ids = [deal.id, deal.leadId].filter(Boolean) as string[];

  for (const dialog of rawDialogs) {
    if (ids.some((id) => dialog.dialogId === id || dialog.leadId === id || dialog.dealId === id)) {
      return dialog;
    }
  }

  for (const dialog of rawDialogs) {
    if (ids.some((id) => dialog.serialized.includes(id))) return dialog;
  }

  return null;
}

async function loadBitrixSnapshotForPeriod(periodKey: PeriodKey, refresh = false) {
  if (refresh) {
    await syncBitrixMetrics({ period: periodKey, refresh: true });
  }
  const snapshot = await readBitrixSnapshot(periodKey);
  if (!snapshot) {
    throw new Error(
      `Bitrix snapshot for ${periodKey} is missing. Run dashboard sync or pass refreshBitrix=true.`,
    );
  }
  return snapshot;
}

function buildDialogExportRow(input: {
  dialogId: string;
  dealId?: string;
  dialogMessages: ConversationMessage[];
  managerName: string | null;
  summary?: DialogSummary;
  outcome: string;
  orderAmount: number;
  chatFound?: boolean;
}): ManagerDialogExportRow {
  const summary = input.summary;
  return {
    dialogId: input.dialogId,
    dealId: input.dealId,
    managerName: input.managerName,
    startedAt: summary?.startedAt ?? input.dialogMessages[0]?.date ?? "",
    lastMessageAt: summary?.lastMessageAt ?? input.dialogMessages.at(-1)?.date ?? "",
    messageCount: summary?.messageCount ?? input.dialogMessages.length,
    outcome: input.outcome,
    orderAmount: input.orderAmount,
    occasion: summary?.occasion ?? "",
    dialogText: input.dialogMessages.length
      ? formatDialogText(input.dialogMessages)
      : "Переписка в gift-ai экспорте не найдена.",
    chatFound: input.chatFound,
  };
}

async function loadManagerDialogExportsFromBitrix(input: {
  periodKey: PeriodKey;
  managerQuery: string;
  resultFilter: "successful" | "unsuccessful" | "all";
  exportDir: string;
  refreshBitrix?: boolean;
}): Promise<ManagerDialogExportRow[]> {
  const [snapshot, periodData] = await Promise.all([
    loadBitrixSnapshotForPeriod(input.periodKey, input.refreshBitrix),
    loadPeriodConversationData({
      periodKey: input.periodKey,
      exportDir: input.exportDir,
    }),
  ]);

  const { messages, rawDialogs } = periodData;
  const grouped = new Map<string, ConversationMessage[]>();
  messages.forEach((message) => {
    grouped.set(message.dialogId, [...(grouped.get(message.dialogId) ?? []), message]);
  });
  const summaries = new Map(summarizeDialogs(messages).map((summary) => [summary.dialogId, summary]));
  const managerDeals = snapshot.deals.filter((deal) => managerMatchesBitrixDeal(deal, input.managerQuery));

  const successfulRows: ManagerDialogExportRow[] = [];
  const handledDialogIds = new Set<string>();
  const unsuccessfulRows: ManagerDialogExportRow[] = [];

  for (const deal of managerDeals) {
    const matchedDialog = findDialogForBitrixDeal(deal, rawDialogs);
    const dialogMessages = matchedDialog ? grouped.get(matchedDialog.dialogId) ?? [] : [];
    const summary = matchedDialog ? summaries.get(matchedDialog.dialogId) : undefined;
    const managerName = deal.managerName
      ?? (dialogMessages.length ? inferManagerNameFromMessages(dialogMessages) : null);

    if (bitrixDealQualifiesAsSuccessful(deal, dialogMessages)) {
      if (matchedDialog) handledDialogIds.add(matchedDialog.dialogId);
      successfulRows.push(buildDialogExportRow({
        dialogId: matchedDialog!.dialogId,
        dealId: deal.id,
        dialogMessages,
        managerName,
        summary,
        outcome: "оплата",
        orderAmount: deal.opportunity,
        chatFound: true,
      }));
      continue;
    }

    if (matchedDialog && dialogMessages.length) {
      handledDialogIds.add(matchedDialog.dialogId);
      unsuccessfulRows.push(buildDialogExportRow({
        dialogId: matchedDialog.dialogId,
        dealId: deal.id,
        dialogMessages,
        managerName,
        summary,
        outcome: outcomeForUnsuccessfulBitrixDeal(deal, dialogMessages),
        orderAmount: deal.opportunity || summary?.orderAmount || 0,
        chatFound: true,
      }));
    }
  }

  for (const summary of summaries.values()) {
    if (handledDialogIds.has(summary.dialogId)) continue;

    const dialogMessages = grouped.get(summary.dialogId) ?? [];
    const managerName = inferManagerNameFromMessages(dialogMessages);
    if (!managerMatchesQuery(managerName, input.managerQuery)) continue;

    unsuccessfulRows.push(buildDialogExportRow({
      dialogId: summary.dialogId,
      dialogMessages,
      managerName,
      summary,
      outcome: classifyUnsuccessfulDialogForExport(dialogMessages),
      orderAmount: summary.orderAmount,
      chatFound: true,
    }));
  }

  if (input.resultFilter === "successful") return successfulRows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (input.resultFilter === "unsuccessful") return unsuccessfulRows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return [...successfulRows, ...unsuccessfulRows].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

async function loadManagerDialogExportsFromText(input: {
  periodKey: PeriodKey;
  managerQuery: string;
  resultFilter: "successful" | "unsuccessful" | "all";
  exportDir: string;
}): Promise<ManagerDialogExportRow[]> {
  const periodData = await loadPeriodConversationData({
    periodKey: input.periodKey,
    exportDir: input.exportDir,
  });
  const { messages } = periodData;
  const grouped = new Map<string, ConversationMessage[]>();
  messages.forEach((message) => {
    grouped.set(message.dialogId, [...(grouped.get(message.dialogId) ?? []), message]);
  });

  const summaries = summarizeDialogs(messages);
  const rows: ManagerDialogExportRow[] = [];

  for (const summary of summaries) {
    const dialogMessages = grouped.get(summary.dialogId) ?? [];
    const managerName = inferManagerNameFromMessages(dialogMessages);
    if (!managerMatchesQuery(managerName, input.managerQuery)) continue;

    const success = classifySuccessfulDialogForExport(dialogMessages);
    const isSuccessful = success?.tier === "paid";

    if (input.resultFilter === "successful" && !isSuccessful) continue;
    if (input.resultFilter === "unsuccessful" && isSuccessful) continue;

    rows.push(buildDialogExportRow({
      dialogId: summary.dialogId,
      dialogMessages,
      managerName,
      summary,
      outcome: isSuccessful
        ? "оплата"
        : classifyUnsuccessfulDialogForExport(dialogMessages),
      orderAmount: summary.orderAmount,
      chatFound: true,
    }));
  }

  return rows.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function loadManagerDialogExports(input: {
  periodKey: PeriodKey;
  managerQuery: string;
  resultFilter?: "successful" | "unsuccessful" | "all";
  /** @deprecated use resultFilter */
  successfulOnly?: boolean;
  exportDir?: string;
  /** CRM deals (dashboard) or strict chat-text rules */
  successSource?: ManagerDialogSuccessSource;
  refreshBitrix?: boolean;
}): Promise<ManagerDialogExportRow[]> {
  const exportDir = input.exportDir ?? path.join(process.cwd(), "data", "conversation-exports");
  const resultFilter = input.resultFilter
    ?? (input.successfulOnly === false ? "all" : "successful");
  const successSource = input.successSource ?? "bitrix";

  if (successSource === "bitrix") {
    return loadManagerDialogExportsFromBitrix({
      periodKey: input.periodKey,
      managerQuery: input.managerQuery,
      resultFilter,
      exportDir,
      refreshBitrix: input.refreshBitrix,
    });
  }

  return loadManagerDialogExportsFromText({
    periodKey: input.periodKey,
    managerQuery: input.managerQuery,
    resultFilter,
    exportDir,
  });
}

export function managerDialogHeaderRows(): string[][] {
  return [[
    "ID диалога",
    "ID сделки",
    "Менеджер",
    "Дата начала",
    "Последнее сообщение",
    "Сообщений",
    "Итог",
    "Сумма EUR",
    "Переписка",
    "Повод",
    "Текст диалога",
  ]];
}

export function managerDialogDataRows(rows: ManagerDialogExportRow[]): string[][] {
  return rows.map((row) => [
    row.dialogId,
    row.dealId ?? "",
    row.managerName ?? "",
    row.startedAt,
    row.lastMessageAt,
    String(row.messageCount),
    row.outcome,
    row.orderAmount > 0 ? String(row.orderAmount) : "",
    row.chatFound === false ? "нет" : row.chatFound ? "да" : "",
    row.occasion,
    row.dialogText,
  ]);
}

export function managerDialogRowsToSheetValues(rows: ManagerDialogExportRow[], meta: {
  managerQuery: string;
  periodKey: PeriodKey;
  exportedAt: string;
  sheetKind?: string;
}): string[][] {
  return [
    ["Менеджер", isAllManagersQuery(meta.managerQuery) ? "Все менеджеры" : meta.managerQuery],
    ["Период", meta.periodKey],
    ["Тип", meta.sheetKind ?? "все диалоги"],
    ["Выгружено", meta.exportedAt],
    ["Диалогов", String(rows.length)],
    [],
    ...managerDialogHeaderRows(),
    ...managerDialogDataRows(rows),
  ];
}

export function filterManagerDialogRowsByDate(
  rows: ManagerDialogExportRow[],
  dateFrom: string,
  dateTo: string,
) {
  const fromTs = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
  const toTs = new Date(`${dateTo}T23:59:59.999Z`).getTime();

  return rows.filter((row) => {
    const startedAt = row.startedAt ? new Date(row.startedAt).getTime() : NaN;
    if (!Number.isFinite(startedAt)) return false;
    return startedAt >= fromTs && startedAt <= toTs;
  });
}
