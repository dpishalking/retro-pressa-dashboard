import type {
  ConversationDashboardMetrics,
  ConversationFactorAnalysis,
  ConversationImportFileDiagnostic,
  ConversationIntent,
  ConversationMessage,
  DialogSummary,
  DialogueOutcome,
  DialogueStage
} from "@/types/metrics";

export type ConversationFileInput = {
  filename: string;
  content: string | ArrayBuffer | Buffer;
  mimeType?: string;
  defaultChannel?: string;
};

type RawConversationRow = Record<string, unknown>;

const supportedExtensions = [".txt", ".csv", ".json", ".xlsx", ".docx", ".pdf"] as const;

const fieldAliases = {
  date: ["date", "datetime", "created_at", "created", "time", "timestamp", "дата", "время", "дата сообщения", "дата создания", "дата и время", "создано"],
  channel: ["channel", "source", "platform", "канал", "источник"],
  dialogId: ["dialog_id", "dialogid", "dialog", "chat", "chat_id", "chatid", "conversation_id", "conversation", "thread_id", "room_id", "lead_id", "id диалога", "id_диалога", "диалог", "чат", "id чата", "id_чата", "номер чата", "номер_чата", "ид чата", "ид_чата", "сделка", "id сделки", "лид", "id лида"],
  sender: ["sender", "author", "from", "name", "username", "отправитель", "автор", "автор сообщения", "кто", "имя", "имя отправителя", "от кого", "роль"],
  text: ["text", "message", "body", "content", "comment", "сообщение", "текст", "текст сообщения", "комментарий", "тело сообщения", "message text"],
  manager: ["manager", "responsible", "assigned", "assignee", "менеджер", "ответственный", "ответственный менеджер"],
  stage: ["stage", "этап", "стадия"],
  outcome: ["outcome", "result", "status", "итог", "результат", "статус"],
  amount: ["amount", "order_amount", "sum", "price", "сумма", "сумма заказа", "заказ"]
};

const intentRules: Array<{ intent: ConversationIntent; patterns: RegExp[] }> = [
  { intent: "price_question", patterns: [/цен[ауы]/i, /сколько стоит/i, /стоимость/i, /поч[её]м/i] },
  { intent: "delivery_question", patterns: [/доставк/i, /отправк/i, /курьер/i, /почт/i, /дойдет/i, /дойд[её]т/i] },
  { intent: "timing_question", patterns: [/срок/i, /когда/i, /успе/i, /дедлайн/i, /к .*числ/i] },
  { intent: "doubt", patterns: [/не уверен/i, /сомнева/i, /подума/i, /дорого/i, /не знаю/i] },
  { intent: "objection", patterns: [/дорого/i, /не подходит/i, /не устраивает/i, /далеко/i, /поздно/i, /слишком/i] },
  { intent: "ready_to_buy", patterns: [/бер[уё]м/i, /хочу заказать/i, /оформляем/i, /подходит/i, /давайте/i] },
  { intent: "gift_recommendation_request", patterns: [/что подарить/i, /посоветуйте/i, /подскажите/i, /подарок/i, /рекоменд/i] },
  { intent: "lost_interest", patterns: [/не актуально/i, /передумал/i, /передумала/i, /не надо/i, /отбой/i, /пока не будем/i] },
  { intent: "payment_transition", patterns: [/оплат/i, /ссылк[ау] на оплату/i, /счет/i, /сч[её]т/i, /карт[ауы]/i, /paypal/i] }
];

const stageRules: Array<{ stage: DialogueStage; patterns: RegExp[] }> = [
  { stage: "payment", patterns: [/оплат/i, /ссылк[ау] на оплату/i, /счет/i, /сч[её]т/i] },
  { stage: "closing", patterns: [/оформ/i, /бер[уё]м/i, /заказ/i, /подтверд/i] },
  { stage: "delivery", patterns: [/доставк/i, /отправк/i, /курьер/i] },
  { stage: "pricing", patterns: [/цен[ауы]/i, /стоимость/i, /итого/i, /полная сумма/i] },
  { stage: "recommendation", patterns: [/рекоменд/i, /подойдет/i, /вариант/i, /подарок/i] },
  { stage: "qualification", patterns: [/кому/i, /повод/i, /дата рождения/i, /юбилей/i, /город/i] },
  { stage: "follow_up", patterns: [/напом/i, /актуально/i, /возвращаюсь/i] },
  { stage: "lost", patterns: [/не актуально/i, /передум/i, /не надо/i] }
];

const occasionRules: Array<{ name: string; patterns: RegExp[] }> = [
  { name: "день рождения", patterns: [/день рож/i, /др\b/i] },
  { name: "юбилей", patterns: [/юбиле/i] },
  { name: "свадьба", patterns: [/свадьб/i, /годовщин/i] },
  { name: "новый год", patterns: [/новый год/i, /рождеств/i] },
  { name: "день отца", patterns: [/день отца/i, /пап[аеуы]/i] },
  { name: "день матери", patterns: [/день матери/i, /мам[аеуы]/i] },
  { name: "корпоративный подарок", patterns: [/корпоратив/i, /коллег/i, /партнер/i] }
];

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, "_");
const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

function extensionOf(filename: string) {
  const lower = filename.toLowerCase();
  return supportedExtensions.find((extension) => lower.endsWith(extension)) ?? null;
}

function asText(content: string | ArrayBuffer | Buffer) {
  if (typeof content === "string") return content;
  if (Buffer.isBuffer(content)) return content.toString("utf8");
  return Buffer.from(content).toString("utf8");
}

function parseCsv(text: string): RawConversationRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") && firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift()?.map(normalizeKey) ?? [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function parseJson(text: string): RawConversationRow[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => {
      const dialog = item as Record<string, unknown>;
      if (!Array.isArray(dialog.messages)) return [dialog as RawConversationRow];

      return dialog.messages.map((message) => ({
        ...message as RawConversationRow,
        dialog_id: dialog.dialog_id ?? dialog.id,
        lead_id: dialog.lead_id,
        deal_id: dialog.deal_id,
        contact_id: dialog.contact_id,
        manager: dialog.manager,
        source: dialog.source,
        country: dialog.country,
        stage: dialog.stage,
        outcome: dialog.outcome,
        amount: dialog.amount
      }));
    });
  }
  if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;
    if (Array.isArray(object.messages)) return object.messages as RawConversationRow[];
    if (Array.isArray(object.dialogs)) {
      return object.dialogs.flatMap((dialog) => {
        const item = dialog as Record<string, unknown>;
        const messages = Array.isArray(item.messages) ? item.messages : [];
        return messages.map((message) => ({ ...message as RawConversationRow, dialog_id: item.dialog_id ?? item.id }));
      });
    }
  }
  return [];
}

function parseTxt(text: string, defaultChannel = "manual"): RawConversationRow[] {
  const rows: RawConversationRow[] = [];
  const linePattern = /^(?:\[?(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)\]?\s*)?(?:([^:]{2,60}):\s*)?(.+)$/;

  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(linePattern);
    rows.push({
      date: match?.[1] ?? null,
      channel: defaultChannel,
      dialog_id: "txt-import",
      sender: match?.[2]?.trim() || (index % 2 === 0 ? "client" : "manager"),
      text: match?.[3] ?? trimmed
    });
  });

  return rows;
}

function parsePdfFallback(content: string | ArrayBuffer | Buffer, defaultChannel = "pdf"): RawConversationRow[] {
  const text = asText(content)
    .replace(/\\\)/g, ")")
    .replace(/\\\(/g, "(")
    .match(/\(([^()]{8,})\)/g)
    ?.map((part) => part.slice(1, -1))
    .join("\n") ?? asText(content);
  return parseTxt(text, defaultChannel);
}

function unsupportedBinary(extension: string): never {
  throw new Error(`Формат ${extension} принят загрузчиком, но для извлечения текста нужен бинарный парсер. Подключите xlsx/mammoth/pdf-parse или передайте экспорт в csv/json/txt.`);
}

function diagnosticNote(messages: number, dialogs: number) {
  const averageMessagesPerDialog = safeDiv(messages, dialogs);

  if (messages > 20 && dialogs === messages) {
    return "Каждая строка стала отдельным диалогом: не распознана колонка ID чата/диалога.";
  }
  if (messages > 100 && averageMessagesPerDialog < 3) {
    return `Диалоги выглядят слишком дробно: в среднем ${averageMessagesPerDialog.toFixed(1)} сообщения на диалог. Скорее всего, используется ID сообщения/события, а нужен стабильный ID чата, сделки или лида.`;
  }
  if (dialogs < 2 && messages > 20) {
    return "Много сообщений, но мало dialog_id: файл мог быть склеен в один диалог.";
  }
  return "Прочитан";
}

export function parseConversationFile(file: ConversationFileInput): ConversationMessage[] {
  const extension = extensionOf(file.filename);
  if (!extension) {
    throw new Error(`Неподдерживаемый формат файла: ${file.filename}`);
  }

  const defaultChannel = file.defaultChannel ?? extension.slice(1);
  let rows: RawConversationRow[];

  if (extension === ".csv") rows = parseCsv(asText(file.content));
  else if (extension === ".json") rows = parseJson(asText(file.content));
  else if (extension === ".txt") rows = parseTxt(asText(file.content), defaultChannel);
  else if (extension === ".pdf") rows = parsePdfFallback(file.content, defaultChannel);
  else unsupportedBinary(extension);

  return rows.map((row, index) => normalizeRow(row, index, defaultChannel)).filter((message) => message.text.trim());
}

function valueByAliases(row: RawConversationRow, aliases: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of aliases) {
    const value = normalized.get(normalizeKey(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function parseAmount(value: unknown, text: string) {
  const explicit = Number(String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const match = text.match(/(?:€|eur|евро)?\s*(\d{2,5}(?:[.,]\d{1,2})?)\s*(?:€|eur|евро)/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function inferSenderRole(sender: string, manager: string | null): ConversationMessage["senderRole"] {
  const normalized = sender.toLowerCase();
  if (manager && normalized.includes(manager.toLowerCase())) return "manager";
  if (/менеджер|manager|admin|оператор|retro|анна|илья|мария|софия|даниил/i.test(sender)) return "manager";
  if (/system|bot|система|бот/i.test(sender)) return "system";
  if (/client|customer|клиент|покупатель/i.test(sender)) return "client";
  return "unknown";
}

export function classifyMessage(text: string): ConversationIntent[] {
  return intentRules.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map((rule) => rule.intent);
}

function inferStage(text: string, intents: ConversationIntent[], provided: unknown): DialogueStage {
  const providedStage = String(provided ?? "").toLowerCase();
  const direct = stageRules.find((rule) => rule.stage === providedStage || rule.patterns.some((pattern) => pattern.test(providedStage)));
  if (direct) return direct.stage;
  const match = stageRules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  if (match) return match.stage;
  if (intents.includes("ready_to_buy")) return "closing";
  if (intents.includes("lost_interest")) return "lost";
  return "first_touch";
}

function inferOutcome(text: string, provided: unknown): DialogueOutcome {
  const value = String(provided ?? "").toLowerCase();
  if (/paid|order|won|оплачен|заказ|успех/.test(value) || /оплатил|оплатила|оплачено|заказ оформлен/i.test(text)) return "order";
  if (/invoice|счет|счёт|выставлен/.test(value) || /счет отправил|счёт отправил/i.test(text)) return "invoice";
  if (/lost|fail|отказ|потер/.test(value) || /не актуально|передум/i.test(text)) return "lost";
  if (/progress|open|в работе/.test(value)) return "in_progress";
  return "unknown";
}

function normalizeRow(row: RawConversationRow, index: number, defaultChannel: string): ConversationMessage {
  const text = String(valueByAliases(row, fieldAliases.text) ?? "");
  const manager = valueByAliases(row, fieldAliases.manager);
  const sender = String(valueByAliases(row, fieldAliases.sender) ?? "");
  const intents = classifyMessage(text);
  return {
    date: valueByAliases(row, fieldAliases.date) ? new Date(String(valueByAliases(row, fieldAliases.date))).toISOString() : null,
    channel: String(valueByAliases(row, fieldAliases.channel) ?? defaultChannel),
    dialogId: String(valueByAliases(row, fieldAliases.dialogId) ?? `dialog-${index + 1}`),
    sender: sender || "unknown",
    senderRole: inferSenderRole(sender, manager ? String(manager) : null),
    text,
    manager: manager ? String(manager) : null,
    stage: inferStage(text, intents, valueByAliases(row, fieldAliases.stage)),
    outcome: inferOutcome(text, valueByAliases(row, fieldAliases.outcome)),
    orderAmount: parseAmount(valueByAliases(row, fieldAliases.amount), text),
    intents
  };
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function countBy<T extends string>(items: T[]) {
  const counts = new Map<T, number>();
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function minutesBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.max(0, (second - first) / 60000);
}

function detectOccasion(text: string) {
  return occasionRules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)))?.name ?? null;
}

export function summarizeDialogs(messages: ConversationMessage[]): DialogSummary[] {
  const groups = new Map<string, ConversationMessage[]>();
  messages.forEach((message) => groups.set(message.dialogId, [...(groups.get(message.dialogId) ?? []), message]));

  return Array.from(groups.entries()).map(([dialogId, group]) => {
    const sorted = [...group].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    const allText = sorted.map((message) => message.text).join("\n");
    const managerMessages = sorted.filter((message) => message.senderRole === "manager");
    const outcome = sorted.find((message) => message.outcome === "order")?.outcome
      ?? sorted.find((message) => message.outcome === "invoice")?.outcome
      ?? sorted.find((message) => message.outcome === "lost")?.outcome
      ?? (hasAny(allText, [/оплат/i, /заказ оформ/i]) ? "order" : hasAny(allText, [/не актуально/i, /передум/i]) ? "lost" : "in_progress");
    const responseTimes = sorted.flatMap((message, index) => {
      if (message.senderRole !== "client") return [];
      const response = sorted.slice(index + 1).find((next) => next.senderRole === "manager");
      const minutes = response ? minutesBetween(message.date, response.date) : null;
      return minutes === null ? [] : [minutes];
    });
    const intents = Array.from(new Set(sorted.flatMap((message) => message.intents)));
    const objections = countBy(sorted.filter((message) => message.intents.includes("objection")).map((message) => {
      if (/дорого/i.test(message.text)) return "дорого";
      if (/срок|поздно|успе/i.test(message.text)) return "не успеваем по срокам";
      if (/достав/i.test(message.text)) return "сомнение по доставке";
      return "другое возражение";
    })).map((item) => item.name);
    const lossReasons = outcome === "lost" ? [
      ...(/дорого/i.test(allText) ? ["цена"] : []),
      ...(/достав/i.test(allText) ? ["доставка"] : []),
      ...(/срок|успе|поздно/i.test(allText) ? ["сроки"] : []),
      ...(/не актуально|передум/i.test(allText) ? ["потеря интереса"] : [])
    ] : [];
    const hadDeliveryQuestion = sorted.some((message) => message.intents.includes("delivery_question") && message.senderRole !== "manager");
    const hadFullDeliveryAnswer = managerMessages.some((message) => /доставк/i.test(message.text) && /стоим|цен|срок|дн|дней|числ|адрес/i.test(message.text));
    const followUp = managerMessages.some((message, index) => {
      const previous = sorted.slice(0, sorted.indexOf(message)).reverse().find((item) => item.senderRole === "client");
      const gap = previous ? minutesBetween(previous.date, message.date) : null;
      return gap !== null && gap >= 720 && hasAny(message.text, [/актуально/i, /напом/i, /возвращаюсь/i]);
    });

    return {
      dialogId,
      channel: sorted[0]?.channel ?? "unknown",
      manager: sorted.find((message) => message.manager)?.manager ?? sorted.find((message) => message.senderRole === "manager")?.sender ?? null,
      messageCount: sorted.length,
      startedAt: sorted[0]?.date ?? null,
      lastMessageAt: sorted[sorted.length - 1]?.date ?? null,
      outcome,
      orderAmount: sorted.reduce((max, message) => Math.max(max, message.orderAmount ?? 0), 0),
      occasion: detectOccasion(allText),
      averageResponseMinutes: responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null,
      hadRecommendation: managerMessages.some((message) => /рекоменд|совет|лучше|подойдет|подойдёт/i.test(message.text)),
      hadConcreteGiftOffer: managerMessages.some((message) => /газет|номер|выпуск|комплект|рамк|вариант/i.test(message.text)),
      hadPriceMention: managerMessages.some((message) => /цен|стоим|€|eur|евро/i.test(message.text)),
      hadDeliveryMention: managerMessages.some((message) => /доставк|отправк|курьер|почт/i.test(message.text)),
      hadFullCalculation: managerMessages.some((message) => /итого|полная сумма|вместе|доставка включ|финальн/i.test(message.text)),
      hadDeadlineConstraint: hasAny(allText, [/успе/i, /срок/i, /до \d{1,2}/i, /к \d{1,2}/i]),
      hadFollowUp: followUp,
      deliveryQuestionWithoutFullAnswer: hadDeliveryQuestion && !hadFullDeliveryAnswer,
      objections,
      lossReasons: lossReasons.length ? lossReasons : outcome === "lost" ? ["не указано"] : [],
      stages: Array.from(new Set(sorted.map((message) => message.stage))),
      intents
    };
  });
}

function factorRow(factor: string, segment: string, dialogs: DialogSummary[], baselineConversion: number, averageOrder: number): ConversationFactorAnalysis {
  const conversion = safeDiv(dialogs.filter((dialog) => dialog.outcome === "order").length, dialogs.length);
  return {
    factor,
    segment,
    dialogs: dialogs.length,
    conversion,
    baselineConversion,
    influencePp: conversion - baselineConversion,
    estimatedRevenueImpact: Math.round((conversion - baselineConversion) * dialogs.length * averageOrder)
  };
}

export function analyzeConversationFactors(dialogs: DialogSummary[]): ConversationFactorAnalysis[] {
  const baselineConversion = safeDiv(dialogs.filter((dialog) => dialog.outcome === "order").length, dialogs.length);
  const averageOrder = dialogs.filter((dialog) => dialog.orderAmount > 0).reduce((sum, dialog) => sum + dialog.orderAmount, 0) / Math.max(1, dialogs.filter((dialog) => dialog.orderAmount > 0).length) || 75;
  const factors: ConversationFactorAnalysis[] = [];
  const booleanFactors: Array<[string, (dialog: DialogSummary) => boolean]> = [
    ["скорость ответа ≤5 минут", (dialog) => (dialog.averageResponseMinutes ?? 999) <= 5],
    ["есть рекомендация", (dialog) => dialog.hadRecommendation],
    ["названа цена", (dialog) => dialog.hadPriceMention],
    ["названа доставка", (dialog) => dialog.hadDeliveryMention],
    ["полный расчет", (dialog) => dialog.hadFullCalculation],
    ["конкретный подарок", (dialog) => dialog.hadConcreteGiftOffer],
    ["ограничение по срокам", (dialog) => dialog.hadDeadlineConstraint],
    ["follow-up", (dialog) => dialog.hadFollowUp]
  ];

  for (const channel of Array.from(new Set(dialogs.map((dialog) => dialog.channel)))) {
    factors.push(factorRow("канал", channel, dialogs.filter((dialog) => dialog.channel === channel), baselineConversion, averageOrder));
  }
  for (const occasion of Array.from(new Set(dialogs.map((dialog) => dialog.occasion).filter(Boolean)))) {
    factors.push(factorRow("повод подарка", String(occasion), dialogs.filter((dialog) => dialog.occasion === occasion), baselineConversion, averageOrder));
  }
  for (const [name, predicate] of booleanFactors) {
    factors.push(factorRow(name, "да", dialogs.filter(predicate), baselineConversion, averageOrder));
    factors.push(factorRow(name, "нет", dialogs.filter((dialog) => !predicate(dialog)), baselineConversion, averageOrder));
  }

  return factors.filter((factor) => factor.dialogs > 0).sort((a, b) => Math.abs(b.influencePp) - Math.abs(a.influencePp));
}

export function buildConversationDashboard(dialogs: DialogSummary[]): ConversationDashboardMetrics {
  const orders = dialogs.filter((dialog) => dialog.outcome === "order");
  const minimumReliableDialogs = 50;
  const sampleReliability = dialogs.length < 10
    ? "small"
    : dialogs.length < 30
      ? "directional"
      : dialogs.length < minimumReliableDialogs
        ? "directional"
        : "reliable";
  const averageOrder = orders.reduce((sum, dialog) => sum + dialog.orderAmount, 0) / Math.max(1, orders.filter((dialog) => dialog.orderAmount > 0).length) || 75;
  const channels = Array.from(new Set(dialogs.map((dialog) => dialog.channel))).map((channel) => {
    const rows = dialogs.filter((dialog) => dialog.channel === channel);
    return { channel, dialogs: rows.length, orders: rows.filter((dialog) => dialog.outcome === "order").length, conversion: safeDiv(rows.filter((dialog) => dialog.outcome === "order").length, rows.length) };
  }).sort((a, b) => b.dialogs - a.dialogs);
  const scenarios = [
    { name: "Рекомендация + полный расчет", rows: dialogs.filter((dialog) => dialog.hadRecommendation && dialog.hadFullCalculation) },
    { name: "Конкретный подарок + доставка", rows: dialogs.filter((dialog) => dialog.hadConcreteGiftOffer && dialog.hadDeliveryMention) },
    { name: "Быстрый ответ + переход к оплате", rows: dialogs.filter((dialog) => (dialog.averageResponseMinutes ?? 999) <= 5 && dialog.intents.includes("payment_transition")) },
    { name: "Follow-up после паузы", rows: dialogs.filter((dialog) => dialog.hadFollowUp) }
  ].map((scenario) => ({
    name: scenario.name,
    dialogs: scenario.rows.length,
    conversion: safeDiv(scenario.rows.filter((dialog) => dialog.outcome === "order").length, scenario.rows.length),
    averageOrder: scenario.rows.reduce((sum, dialog) => sum + dialog.orderAmount, 0) / Math.max(1, scenario.rows.length)
  })).filter((scenario) => scenario.dialogs > 0).sort((a, b) => b.conversion - a.conversion);
  const worstPoints = [
    { name: "нет конкретной рекомендации", count: dialogs.filter((dialog) => !dialog.hadConcreteGiftOffer).length },
    { name: "вопрос о доставке без полного ответа", count: dialogs.filter((dialog) => dialog.deliveryQuestionWithoutFullAnswer).length },
    { name: "не назван полный расчет", count: dialogs.filter((dialog) => !dialog.hadFullCalculation).length },
    { name: "нет follow-up", count: dialogs.filter((dialog) => !dialog.hadFollowUp && dialog.outcome !== "order").length }
  ].map((point) => ({ ...point, lostRevenue: Math.round(point.count * averageOrder * 0.22) })).sort((a, b) => b.lostRevenue - a.lostRevenue);
  const recommendationMissingShare = safeDiv(dialogs.filter((dialog) => !dialog.hadConcreteGiftOffer).length, dialogs.length);
  const deliveryRiskShare = safeDiv(dialogs.filter((dialog) => dialog.deliveryQuestionWithoutFullAnswer).length, dialogs.length);

  return {
    totalDialogs: dialogs.length,
    sampleReliability,
    minimumReliableDialogs,
    orderConversion: safeDiv(orders.length, dialogs.length),
    conversionByChannel: channels,
    topObjections: countBy(dialogs.flatMap((dialog) => dialog.objections)).slice(0, 5),
    topLossReasons: countBy(dialogs.flatMap((dialog) => dialog.lossReasons)).slice(0, 5),
    bestSalesScenarios: scenarios.slice(0, 4),
    worstDialoguePoints: worstPoints,
    potentialLostRevenue: worstPoints.reduce((sum, point) => sum + point.lostRevenue, 0),
    recommendationMissingShare,
    deliveryRiskShare,
    qualityScore: Math.round((1 - recommendationMissingShare * 0.35 - deliveryRiskShare * 0.25 - safeDiv(dialogs.filter((dialog) => !dialog.hadFullCalculation).length, dialogs.length) * 0.25) * 100),
    factors: analyzeConversationFactors(dialogs)
  };
}

export function importAndAnalyzeConversations(files: ConversationFileInput[]) {
  const messages = files.flatMap(parseConversationFile);
  const dialogs = summarizeDialogs(messages);
  return {
    messages,
    dialogs,
    dashboard: buildConversationDashboard(dialogs)
  };
}

export function importAndAnalyzeConversationsWithDiagnostics(files: ConversationFileInput[]) {
  const diagnostics: ConversationImportFileDiagnostic[] = [];
  const messages = files.flatMap((file) => {
    try {
      const parsed = parseConversationFile(file);
      const dialogs = summarizeDialogs(parsed);
      diagnostics.push({
        filename: file.filename,
        messages: parsed.length,
        dialogs: dialogs.length,
        status: "ok",
        note: diagnosticNote(parsed.length, dialogs.length)
      });
      return parsed;
    } catch (error) {
      diagnostics.push({
        filename: file.filename,
        messages: 0,
        dialogs: 0,
        status: "error",
        note: error instanceof Error ? error.message : "Не удалось прочитать файл"
      });
      return [];
    }
  });
  const dialogs = summarizeDialogs(messages);

  return {
    messages,
    dialogs,
    dashboard: buildConversationDashboard(dialogs),
    diagnostics
  };
}
