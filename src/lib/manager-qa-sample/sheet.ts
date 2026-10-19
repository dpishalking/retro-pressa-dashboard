import { getGoogleAccessToken, writeSheetTab } from "@/lib/google/sheets-client";
import {
  QA_CATEGORIES,
  QA_CATEGORY_LABEL,
  QA_SAMPLE_PER_CATEGORY,
  type ManualCheck,
  type QaCategory
} from "@/lib/manager-qa-sample/sample";

export const QA_SETTINGS_TAB = "Настройки";
export const QA_LOG_TAB = "Журнал";
export const QA_HISTORY_TAB = "История";

export type QaReportRow = {
  managerId: string;
  category: QaCategory;
  dealId: string;
  sessionId: string;
  channel: string;
  eventAt: string;
  liveMessages: number;
  invoiceLabel: string;
  basis: string;
  crmUrl: string;
  dialogUrl: string;
  key: string;
  repeat: boolean;
};

const HEADERS = [
  "Категория",
  "№",
  "Лид / сделка",
  "Ссылка на CRM",
  "Ссылка на диалог",
  "Канал",
  "Дата события",
  "Живых сообщений",
  "Счёт / платёж",
  "Основание категории",
  "Фокус проверки",
  "Проверено",
  "Оценка по чек-листу",
  "Комментарий руководителя",
  "Дата проверки",
  "Ключ"
];

const FOCUS: Record<QaCategory, string> = {
  paid: "кросс-продукты",
  refusal: "отказ",
  invoice_unpaid: "доведение до оплаты",
  client_silent: "возврат клиента"
};

export function managerSheetTitle(managerId: string, name: string) {
  const first = (name.split(/\s+/).find(Boolean) || "manager").replace(/[\\/?*[\]:]/g, "");
  return `M_${managerId}_${first}`.slice(0, 99);
}

function link(url: string, label: string) {
  if (!url) return "";
  const safe = url.replace(/"/g, "");
  return `=HYPERLINK("${safe}";"${label}")`;
}

export function buildManagerSheet(input: {
  managerName: string;
  managerId: string;
  weekLabel: string;
  period: string;
  syncedAt: string;
  rows: QaReportRow[];
  manual: Map<string, ManualCheck>;
}) {
  const counts = Object.fromEntries(QA_CATEGORIES.map((category) => [category, 0])) as Record<QaCategory, number>;
  for (const row of input.rows) counts[row.category] += 1;
  const scoreLine = QA_CATEGORIES.map((category) => `${QA_CATEGORY_LABEL[category].slice(0, 1)} ${counts[category]}/${QA_SAMPLE_PER_CATEGORY}`).join(" | ");
  const ordered = [...input.rows].sort(
    (left, right) => QA_CATEGORIES.indexOf(left.category) - QA_CATEGORIES.indexOf(right.category) || left.eventAt.localeCompare(right.eventAt)
  );
  const numbers = new Map<QaCategory, number>();
  const data = ordered.map((row) => {
    const number = (numbers.get(row.category) || 0) + 1;
    numbers.set(row.category, number);
    const manual = input.manual.get(row.key);
    return [
      QA_CATEGORY_LABEL[row.category],
      String(number),
      `Сделка ${row.dealId}`,
      link(row.crmUrl, "CRM"),
      link(row.dialogUrl, "Диалог"),
      row.channel,
      row.eventAt.slice(0, 16).replace("T", " "),
      String(row.liveMessages),
      row.invoiceLabel,
      row.repeat ? `${row.basis}; повтор` : row.basis,
      FOCUS[row.category],
      manual?.checked || "Нет",
      manual?.score || "",
      manual?.comment || "",
      manual?.checkedAt || "",
      row.key
    ];
  });
  return [
    ["Менеджер", input.managerName, "ID", input.managerId],
    ["Период", input.period, "Сформировано", `${input.syncedAt} МСК`],
    ["Выбрано", scoreLine],
    [],
    HEADERS,
    ...data
  ];
}

export function buildSummarySheet(input: {
  weekLabel: string;
  period: string;
  syncedAt: string;
  managers: Array<{
    id: string;
    name: string;
    counts: Record<QaCategory, number>;
    checked: number;
    sheetTitle: string;
    gid: number | null;
    spreadsheetId: string;
    problem: string;
  }>;
}) {
  const header = [
    "Менеджер",
    "ID",
    "Неделя",
    ...QA_CATEGORIES.map((category) => QA_CATEGORY_LABEL[category]),
    "Всего",
    "Проверено",
    "Не проверено",
    "Лист",
    "Проблемы"
  ];
  const rows = input.managers
    .sort((left, right) => left.name.localeCompare(right.name, "ru"))
    .map((manager) => {
      const total = QA_CATEGORIES.reduce((sum, category) => sum + manager.counts[category], 0);
      const sheetUrl = manager.gid == null
        ? ""
        : `https://docs.google.com/spreadsheets/d/${manager.spreadsheetId}/edit#gid=${manager.gid}`;
      return [
        manager.name,
        manager.id,
        input.weekLabel,
        ...QA_CATEGORIES.map((category) => `${manager.counts[category]}/${QA_SAMPLE_PER_CATEGORY}`),
        `${total}/12`,
        String(manager.checked),
        String(Math.max(0, total - manager.checked)),
        link(sheetUrl, manager.sheetTitle),
        manager.problem
      ];
    });
  return [
    ["Еженедельная выборка диалогов", input.weekLabel],
    ["Период", input.period, "Сформировано", `${input.syncedAt} МСК`],
    ["Правило", "До 3 содержательных диалогов в категории. Оценку ставит руководитель, выгрузка её не считает."],
    [],
    header,
    ...rows
  ];
}

export function defaultSettingsRows(managers: Array<{ id: string; name: string }>) {
  return [
    ["Параметр", "Значение", "Комментарий"],
    ["min_messages", "5", "Живых сообщений после первого ответа клиента"],
    ["silence_hours", "48", "Порог молчания для категории D, часы"],
    ["per_category", "3", "Сколько диалогов брать в категорию"],
    [],
    ["manager_id", "Имя", "Включён"],
    ...managers.map((manager) => [manager.id, manager.name, "Да"])
  ];
}

export function parseSettings(rows: string[][]) {
  let minMessages = 5;
  let silenceHours = 48;
  const enabled = new Map<string, boolean>();
  const names = new Map<string, string>();
  for (const row of rows) {
    if (row[0] === "min_messages" && row[1]) minMessages = Number(row[1]) || minMessages;
    if (row[0] === "silence_hours" && row[1]) silenceHours = Number(row[1]) || silenceHours;
    if (/^\d+$/.test(String(row[0] || ""))) {
      enabled.set(String(row[0]), !/^нет$/i.test(String(row[2] || "Да")));
      if (row[1]) names.set(String(row[0]), String(row[1]));
    }
  }
  return { minMessages, silenceHours, enabled, names };
}

export function recentEpisodeKeys(rows: string[][], currentWeek: string) {
  const headerIndex = rows.findIndex((row) => row.includes("report_week") && row.includes("episode"));
  if (headerIndex < 0) return new Set<string>();
  const header = rows[headerIndex] || [];
  const weekCol = header.indexOf("report_week");
  const episodeCol = header.indexOf("episode");
  const weeks = [...new Set(rows.slice(headerIndex + 1).map((row) => String(row[weekCol] || "")).filter((week) => week && week !== currentWeek))];
  weeks.sort();
  const keep = new Set(weeks.slice(-4));
  const keys = new Set<string>();
  for (const row of rows.slice(headerIndex + 1)) {
    const week = String(row[weekCol] || "");
    const episode = String(row[episodeCol] || "");
    if (keep.has(week) && episode) keys.add(episode);
  }
  return keys;
}

export function historyHeader() {
  return ["report_week", "manager_id", "crm_entity_id", "session_id", "category", "checked", "score", "comment", "checked_at", "episode", "key"];
}

function historyRecord(key: string, category: string, manual: ManualCheck) {
  const [, managerId = "", , dealId = "", sessionId = ""] = key.split("|");
  return [
    key.split("|")[0] || "",
    managerId,
    dealId,
    sessionId,
    category,
    manual.checked,
    manual.score,
    manual.comment,
    manual.checkedAt,
    `${managerId}|${dealId}|${sessionId}`,
    key
  ];
}

export function historyRowsFromSheet(rows: string[][], currentWeek: string) {
  const checks = new Map<string, ManualCheck>();
  const previous: string[][] = [];
  const current: string[][] = [];
  const headerIndex = rows.findIndex((row) => row.includes("Ключ") && row.includes("Проверено"));
  if (headerIndex < 0) return { previous, checks, current };
  const header = rows[headerIndex] || [];
  const keyCol = header.indexOf("Ключ");
  const categoryCol = header.indexOf("Категория");
  const checkedCol = header.indexOf("Проверено");
  const scoreCol = header.indexOf("Оценка по чек-листу");
  const commentCol = header.indexOf("Комментарий руководителя");
  const dateCol = header.indexOf("Дата проверки");
  for (const row of rows.slice(headerIndex + 1)) {
    const key = String(row[keyCol] || "");
    const week = key.split("|")[0] || "";
    const manual = {
      checked: checkedCol >= 0 ? String(row[checkedCol] || "") : "",
      score: scoreCol >= 0 ? String(row[scoreCol] || "") : "",
      comment: commentCol >= 0 ? String(row[commentCol] || "") : "",
      checkedAt: dateCol >= 0 ? String(row[dateCol] || "") : ""
    };
    const category = categoryCol >= 0 ? String(row[categoryCol] || "") : "";
    if (key && week === currentWeek) {
      if (manual.checked || manual.score || manual.comment || manual.checkedAt) checks.set(key, manual);
      current.push(historyRecord(key, category, manual));
      continue;
    }
    if (!key || !week) continue;
    previous.push(historyRecord(key, category, manual));
  }
  return { previous, checks, current };
}

function quote(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function writeQaSheet(input: {
  spreadsheetId: string;
  tabTitle: string;
  rows: Array<Array<string | number | null>>;
  columns: string;
}) {
  await writeSheetTab({
    spreadsheetId: input.spreadsheetId,
    tabTitle: input.tabTitle,
    rows: input.rows,
    clearRange: `${quote(input.tabTitle)}!A:${input.columns}`,
    valueInputOption: "USER_ENTERED"
  });
}

export async function formatQaSheets(spreadsheetId: string, titles: string[], headerRow: number) {
  if (!titles.length) return;
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const metaResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title),conditionalFormats)`,
    { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  const meta = (await metaResponse.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string }; conditionalFormats?: unknown[] }>;
  };
  const wanted = new Set(titles);
  const colors = [
    ["A.", { red: 0.85, green: 0.94, blue: 0.84 }],
    ["B.", { red: 0.98, green: 0.88, blue: 0.86 }],
    ["C.", { red: 1, green: 0.95, blue: 0.8 }],
    ["D.", { red: 0.85, green: 0.91, blue: 0.98 }]
  ] as const;
  const requests: object[] = [];
  for (const tab of meta.sheets || []) {
    const title = tab.properties?.title || "";
    const sheetId = tab.properties?.sheetId;
    if (sheetId == null || !wanted.has(title)) continue;
    const existingRules = tab.conditionalFormats?.length || 0;
    for (let index = existingRules - 1; index >= 0; index -= 1) {
      requests.push({ deleteConditionalFormatRule: { sheetId, index } });
    }
    requests.push(
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: headerRow } },
          fields: "gridProperties.frozenRowCount"
        }
      },
      {
        setBasicFilter: {
          filter: { range: { sheetId, startRowIndex: headerRow - 1, startColumnIndex: 0, endColumnIndex: 16 } }
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 16 },
          properties: { pixelSize: 148 },
          fields: "pixelSize"
        }
      },
      ...colors.map(([text, color], index) => ({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId, startRowIndex: headerRow, startColumnIndex: 0, endColumnIndex: 1 }],
            booleanRule: {
              condition: { type: "TEXT_CONTAINS", values: [{ userEnteredValue: text }] },
              format: { backgroundColor: color }
            }
          },
          index
        }
      }))
    );
  }
  if (!requests.length) return;
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ requests })
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: { message?: string } };
    throw new Error(`Google Sheets format failed: ${data.error?.message || response.status}`);
  }
}
