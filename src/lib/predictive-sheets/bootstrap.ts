import { PM_SHEETS, getPredictiveSheetsSpreadsheetId } from "@/config/predictive-sheets";
import {
  ensureSheetRowCapacity,
  ensureSheetTab,
  getGoogleAccessToken,
  getSheetIdByTitle,
  listSheetTitles,
  writeSheetValues
} from "@/lib/google/sheets-client";
import { metricsForSheet, PM_METRIC_CATALOG, type PmCatalogMetric } from "@/lib/predictive-sheets/catalog";
import {
  colLetter,
  formulaForecastEom,
  formulaGap,
  formulaPlanToDate,
  formulaPtf,
  formulaWeeklyPlan,
  formulaRequiredPace,
  formulaStatus,
  quoteTab,
  sheetFormula
} from "@/lib/predictive-sheets/formulas";
import { applyBitrixFacts, loadCeoSeed, seedForMetricId, type CeoSeedBundle } from "@/lib/predictive-sheets/seed-from-ceo";
import { loadBitrixMonthFacts } from "@/lib/predictive-sheets/seed-from-bitrix";
import { applyChannelFacts, loadSvodChannelFacts } from "@/lib/predictive-sheets/seed-from-channels";
import {
  PM_COL,
  PM_COLORS,
  PM_COLUMN_WIDTHS,
  PM_FOCUS,
  PM_SECTION_LABEL,
  PM_STATUS,
  pmSectionLabel,
  PM_STATUS_CF,
  PM_TYPE_LABEL,
  pmHeaders,
  pmWeekHeader
} from "@/lib/predictive-sheets/theme";
import { currentMondayWeek, displayMondayWeeks } from "@/lib/predictive-sheets/weeks";

export type BootstrapResult = {
  spreadsheetId: string;
  sheetsCreated: string[];
  sheetsReused: string[];
  metricsCount: number;
  seededFrom: string;
  missingData: string[];
  period: string;
};

type CellValue = string | number | boolean | null;

function periodMeta(month: string, asOfDate?: string) {
  const [y, m] = month.split("-").map(Number);
  const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const asOf = asOfDate || new Date().toISOString().slice(0, 10);
  const asOfDay = asOf.startsWith(month) ? Number(asOf.slice(8, 10)) : totalDays;
  const elapsed = Math.min(Math.max(asOfDay, 0), totalDays);
  const remaining = Math.max(totalDays - elapsed, 0);
  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь"
  ];
  const currentWeek = currentMondayWeek(month, asOf);
  return {
    month,
    label: `${monthNames[m - 1]} ${y}`,
    start: `${month}-01`,
    end: `${month}-${String(totalDays).padStart(2, "0")}`,
    asOf,
    elapsed,
    remaining,
    totalDays,
    currentWeek
  };
}

async function batchUpdate(spreadsheetId: string, requests: unknown[]) {
  if (!requests.length) return;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  // Chunk to avoid payload limits
  for (let i = 0; i < requests.length; i += 80) {
    const chunk = requests.slice(i, i + 80);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ requests: chunk })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`batchUpdate failed: ${res.status} ${body.slice(0, 400)}`);
    }
  }
}

async function renameSheetIfNeeded(spreadsheetId: string, fromTitle: string, toTitle: string) {
  const titles = await listSheetTitles(spreadsheetId);
  if (titles.includes(toTitle)) return;
  if (!titles.includes(fromTitle)) return;
  const sheetId = await getSheetIdByTitle(spreadsheetId, fromTitle);
  if (sheetId == null) return;
  await batchUpdate(spreadsheetId, [
    {
      updateSheetProperties: {
        properties: { sheetId, title: toTitle },
        fields: "title"
      }
    }
  ]);
}

function emptyOrNum(v: number | null | undefined): CellValue {
  return v == null || !Number.isFinite(v) ? "" : v;
}

function detailSheetTitle(sheetTitle: string): string {
  if (sheetTitle.includes("PAID")) return "Маркетинг · платный";
  if (sheetTitle.includes("ORGANIC")) return "Маркетинг · органика";
  if (sheetTitle.includes("SALES")) return "Продажи";
  return "Маркетинг · общее";
}

function buildSettingsRows(meta: ReturnType<typeof periodMeta>, seededFrom: string): CellValue[][] {
  const now = new Date();
  const stamp = now.toLocaleString("ru-RU", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  return [
    ["НАСТРОЙКИ", "Значение", "Пояснение"],
    ["Период", meta.month, "YYYY-MM — менять здесь, не в формулах"],
    ["Название периода", meta.label, ""],
    ["Начало периода", meta.start, ""],
    ["Конец периода", meta.end, ""],
    ["Дата среза", meta.asOf, "На эту дату считаем факт и план на дату"],
    ["Текущая неделя", meta.currentWeek, "Пн–вс, номер недели месяца"],
    ["Прошло дней", meta.elapsed, ""],
    ["Осталось дней", meta.remaining, ""],
    ["Дней в месяце", meta.totalDays, ""],
    ["Валюта", "EUR", ""],
    ["Порог «в норме»", 0.9, "Факт / план на дату ≥ → в норме"],
    ["Порог «риск»", 0.7, "Ниже — срыв"],
    ["Резать план по неделям", true, "TRUE = план месяца × доля дней недели"],
    ["Только рабочие дни", false, "FALSE = все календарные дни"],
    ["Обновлено", stamp, ""],
    ["Устаревание, часов", 24, ""],
    [
      "Метод плана на дату",
      "LINEAR_FALLBACK",
      "Недельный план = план месяца × (дни недели / дни месяца)"
    ],
    ["Источник данных", seededFrom, ""],
    ["Ввод", "Голубые ячейки", ""],
    ["Формула", "Белые ячейки", ""],
    ["Недели (пн–вс)", "Понедельник", "Воскресенье", "В месяце", "Дней", "Доля плана"],
    ...[1, 2, 3, 4, 5].map((idx) => {
      const w = displayMondayWeeks(meta.month)[idx - 1];
      if (!w) return [`Н${idx}`, "", "", "", 0, 0];
      return [
        `Н${idx} ${w.label}`,
        w.monday,
        w.sunday,
        `${w.firstInMonth}…${w.lastInMonth}`,
        w.daysInMonth,
        Number(w.share.toFixed(6))
      ];
    })
  ];
}

function buildMetricsRows(): CellValue[][] {
  const header = [
    "metric_id",
    "category",
    "metric_name",
    "metric_type",
    "direction",
    "unit",
    "owner",
    "parent_metric_id",
    "plan_source",
    "fact_source",
    "forecast_method",
    "is_primary",
    "sheet",
    "section",
    "kind"
  ];
  const rows: CellValue[][] = [header];
  for (const m of PM_METRIC_CATALOG) {
    rows.push([
      m.metric_id,
      m.category,
      m.metric_name,
      PM_TYPE_LABEL[m.metric_type] || m.metric_type,
      m.direction,
      m.unit,
      m.owner,
      m.parent_metric_id,
      m.plan_source,
      m.fact_source,
      m.forecast_method,
      m.is_primary,
      m.sheet,
      PM_SECTION_LABEL[m.section] || m.section,
      m.kind
    ]);
  }
  return rows;
}

function buildGlossaryRows(): CellValue[][] {
  const rows: CellValue[][] = [["Метрика", "Что означает", "Формула", "Владелец", "Источник данных", "Частота обновления"]];
  for (const m of PM_METRIC_CATALOG) {
    rows.push([m.metric_name, m.glossary, m.formulaHint, m.owner, m.fact_source, "ежедневно"]);
  }
  return rows;
}

function buildActionsHeader(): CellValue[][] {
  return [
    ["ДЕЙСТВИЯ — что делать по рискам и срывам"],
    [
      "Метрика",
      "Статус метрики",
      "Проблема",
      "Причина / гипотеза",
      "Действие",
      "Владелец",
      "Срок",
      "Ожидаемый эффект",
      "Статус задачи",
      "Комментарий"
    ],
    ["", "", "", "", "", "", "", "", "не начато", "Заполнять вручную для жёлтых и красных метрик"]
  ];
}

function buildOwnersRows(): CellValue[][] {
  return [
    ["Владелец"],
    ["Маркетинг"],
    ["Маркетинг / РОП"],
    ["РОП"],
    ["—"]
  ];
}

function buildRawRows(seed: CeoSeedBundle): CellValue[][] {
  const header = [
    "metric_id",
    "sheet",
    "section",
    "metric_name",
    "metric_type",
    "direction",
    "unit",
    "kind",
    "owner",
    "is_primary",
    "plan_month",
    "fact_mtd",
    "plan_note",
    "w1_plan",
    "w1_fact",
    "w2_plan",
    "w2_fact",
    "w3_plan",
    "w3_fact",
    "w4_plan",
    "w4_fact",
    "w5_plan",
    "w5_fact",
    "parent_metric_id"
  ];
  const rows: CellValue[][] = [header];
  for (const m of PM_METRIC_CATALOG) {
    const s = seedForMetricId(m.metric_id, seed);
    rows.push([
      m.metric_id,
      m.sheet,
      m.section,
      m.metric_name,
      m.metric_type,
      m.direction,
      m.unit,
      m.kind,
      m.owner,
      m.is_primary,
      emptyOrNum(s.plan),
      emptyOrNum(s.fact),
      s.planNote || (s.plan == null ? "NO_PLAN" : ""),
      "",
      emptyOrNum(s.weekFact?.[0] ?? null),
      "",
      emptyOrNum(s.weekFact?.[1] ?? null),
      "",
      emptyOrNum(s.weekFact?.[2] ?? null),
      "",
      emptyOrNum(s.weekFact?.[3] ?? null),
      "",
      emptyOrNum(s.weekFact?.[4] ?? null),
      m.parent_metric_id
    ]);
  }
  return rows;
}

type MetricBlockLayout = {
  section: string;
  metric: PmCatalogMetric;
  planRow: number; // 1-based
  factRow: number;
  ptfRow: number;
};

type CellNote = { row: number; col: number; note: string };

type DetailLayout = {
  focusRow: number;
  headerRow: number;
  blocks: MetricBlockLayout[];
  sectionRows: number[];
};

function isLagMatrixMetric(m: PmCatalogMetric): boolean {
  return m.metric_type === "LAG" || m.section === "BUSINESS OUTCOME";
}

function layoutDetailSheet(sheetTitle: string): DetailLayout {
  const metrics = metricsForSheet(sheetTitle);
  const lagMetrics = metrics.filter(isLagMatrixMetric);
  const leadMetrics = metrics.filter((m) => !isLagMatrixMetric(m));

  const focusRow = 3;
  const headerRow = 4;
  let row = 5;
  const blocks: MetricBlockLayout[] = [];
  const sectionRows: number[] = [];

  if (lagMetrics.length) {
    sectionRows.push(row);
    row += 1;
    for (const m of lagMetrics) {
      blocks.push({
        section: m.section,
        metric: m,
        planRow: row,
        factRow: row + 1,
        ptfRow: row + 2
      });
      row += 3;
    }
  }

  let lastLabel = lagMetrics.length ? pmSectionLabel(lagMetrics[0].section) : "";
  for (const m of leadMetrics) {
    const label = pmSectionLabel(m.section);
    if (label !== lastLabel) {
      sectionRows.push(row);
      row += 1;
      lastLabel = label;
    }
    blocks.push({ section: m.section, metric: m, planRow: row, factRow: row + 1, ptfRow: row + 2 });
    row += 3;
  }
  return { focusRow, headerRow, blocks, sectionRows };
}

function fillMetricTriple(
  rows: CellValue[][],
  b: MetricBlockLayout,
  settingsTab: string,
  seed: CeoSeedBundle,
  notes: CellNote[]
) {
  const m = b.metric;
  const seedVal = seedForMetricId(m.metric_id, seed);
  const pr = b.planRow;
  const fr = b.factRow;
  const tr = b.ptfRow;
  const planLetter = colLetter(PM_COL.plan);
  const ptdLetter = colLetter(PM_COL.ptd);
  const factLetter = colLetter(PM_COL.fact);
  const forecastLetter = colLetter(PM_COL.forecast);

  rows[pr - 1][PM_COL.metric] = m.metric_name;
  rows[pr - 1][PM_COL.plan] = emptyOrNum(seedVal.plan);
  rows[pr - 1][PM_COL.ptd] =
    m.kind === "rate"
      ? sheetFormula(`IF(${planLetter}${pr}="","",${planLetter}${pr})`)
      : sheetFormula(formulaPlanToDate({ planCell: `${planLetter}${pr}`, settingsTab }));
  for (let w = 1; w <= 5; w += 1) {
    rows[pr - 1][PM_COL.w1 + w - 1] =
      m.kind === "rate"
        ? ""
        : sheetFormula(
            formulaWeeklyPlan({
              planCell: `${planLetter}${pr}`,
              week1to5: w,
              kind: m.kind,
              settingsTab
            })
          );
  }
  if (seedVal.planNote) notes.push({ row: pr, col: PM_COL.plan, note: seedVal.planNote });
  else if (seedVal.plan == null) notes.push({ row: pr, col: PM_COL.plan, note: "нет плана" });

  rows[fr - 1][PM_COL.metric] = "факт";
  for (let w = 1; w <= 5; w += 1) {
    rows[fr - 1][PM_COL.w1 + w - 1] = emptyOrNum(seedVal.weekFact?.[w - 1] ?? null);
  }
  rows[fr - 1][PM_COL.fact] = emptyOrNum(seedVal.fact);
  rows[fr - 1][PM_COL.forecast] = sheetFormula(
    formulaForecastEom({
      factCell: `${factLetter}${fr}`,
      planCell: `${planLetter}${pr}`,
      kind: m.kind,
      settingsTab
    })
  );
  rows[fr - 1][PM_COL.gap] = sheetFormula(
    formulaGap({
      forecastCell: `${forecastLetter}${fr}`,
      planCell: `${planLetter}${pr}`,
      direction: m.direction
    })
  );
  rows[fr - 1][PM_COL.pace] = sheetFormula(
    formulaRequiredPace({
      planCell: `${planLetter}${pr}`,
      factCell: `${factLetter}${fr}`,
      kind: m.kind,
      settingsTab
    })
  );
  rows[fr - 1][PM_COL.status] = sheetFormula(
    formulaStatus({
      factCell: `${factLetter}${fr}`,
      planToDateCell: `${ptdLetter}${pr}`,
      planCell: `${planLetter}${pr}`,
      direction: m.direction,
      settingsTab
    })
  );
  if (seedVal.fact == null) notes.push({ row: fr, col: PM_COL.fact, note: "нет данных" });

  rows[tr - 1][PM_COL.metric] = "%";
  rows[tr - 1][PM_COL.fact] = sheetFormula(
    formulaPtf({
      factCell: `${factLetter}${fr}`,
      planCell: m.kind === "rate" ? `${planLetter}${pr}` : `${ptdLetter}${pr}`
    })
  );
  rows[tr - 1][PM_COL.forecast] = sheetFormula(
    formulaPtf({ factCell: `${forecastLetter}${fr}`, planCell: `${planLetter}${pr}` })
  );
  for (let w = 1; w <= 5; w += 1) {
    const letter = colLetter(PM_COL.w1 + w - 1);
    rows[tr - 1][PM_COL.w1 + w - 1] = sheetFormula(
      `IF(OR(${letter}${fr}="",${letter}${pr}="",${letter}${pr}=0),"",${letter}${fr}/${letter}${pr}-1)`
    );
  }
}

function buildDetailGrid(
  sheetTitle: string,
  settingsTab: string,
  seed: CeoSeedBundle,
  meta: ReturnType<typeof periodMeta>
): { rows: CellValue[][]; layout: DetailLayout; notes: CellNote[] } {
  const layout = layoutDetailSheet(sheetTitle);
  const maxRow = Math.max(20, ...layout.blocks.map((b) => b.ptfRow), ...layout.sectionRows);
  const rows: CellValue[][] = Array.from({ length: maxRow }, () => Array(PM_COL.count).fill(""));
  const weeks = displayMondayWeeks(meta.month);
  const weekLabels = Array.from({ length: 5 }, (_, i) => {
    const w = weeks[i];
    return w ? pmWeekHeader(i + 1, w.label, meta.currentWeek === i + 1) : `Н${i + 1}`;
  });

  rows[0][0] = detailSheetTitle(sheetTitle);
  rows[1][0] = "Период:";
  rows[1][1] = `=${quoteTab(settingsTab)}!B3`;
  rows[1][2] = "Неделя:";
  rows[1][3] = `=${quoteTab(settingsTab)}!B7`;

  rows[layout.focusRow - 1][0] = PM_FOCUS[sheetTitle] || "Смотрим: выручка";
  rows[layout.headerRow - 1] = pmHeaders(weekLabels);

  for (const sectionRow of layout.sectionRows) {
    const block = layout.blocks.find((b) => b.planRow === sectionRow + 1);
    rows[sectionRow - 1][0] = pmSectionLabel(block?.section || "");
  }

  const notes: CellNote[] = [];
  for (const b of layout.blocks) {
    fillMetricTriple(rows, b, settingsTab, seed, notes);
  }

  return { rows, layout, notes };
}

function buildDashboardRows(settingsTab: string, meta: ReturnType<typeof periodMeta>): CellValue[][] {
  const S = quoteTab(settingsTab);
  const MG = quoteTab(PM_SHEETS.marketingGeneral);
  // Primary KPI cards pull from Marketing General fact rows (known layout after bootstrap).
  // Layout for MG (after section headers): computed dynamically — use INDEX/MATCH on RAW instead.
  const RAW = quoteTab(PM_SHEETS.rawData);
  const MET = quoteTab(PM_SHEETS.metrics);

  const card = (title: string, metricId: string) => {
    // RAW: metric_id col A, plan col K (11), fact col L (12)
    return {
      title,
      metricId,
      plan: `IFERROR(INDEX(${RAW}!K:K,MATCH("${metricId}",${RAW}!A:A,0)),"")`,
      fact: `IFERROR(INDEX(${RAW}!L:L,MATCH("${metricId}",${RAW}!A:A,0)),"")`
    };
  };

  const cards = [
    card("ВЫРУЧКА", "mg_revenue"),
    card("ОПЛАТЫ", "mg_payments"),
    card("ЛИДЫ", "mg_leads"),
    card("СЧЕТА", "mg_invoices"),
    card("СРЕДНИЙ ЧЕК", "mg_average_check"),
    card("КВАЛ. ЛИДЫ", "mg_qualified_leads")
  ];

  const rows: CellValue[][] = [];
  rows.push([
    "Предиктивная модель",
    "",
    "",
    "",
    "",
    "",
    "",
    PM_STATUS.onTrack,
    PM_STATUS.risk,
    PM_STATUS.offTrack,
    PM_STATUS.noData
  ]);
  rows.push([
    `=${S}!B3`,
    "",
    "",
    "Обновлено:",
    `=${S}!B16`,
    "",
    "",
    "в норме",
    "риск",
    "срыв",
    "нет данных"
  ]);
  rows.push([
    "Период:",
    `=${S}!B2`,
    "",
    "Неделя:",
    `=${S}!B7`,
    "",
    "",
    "Прошло:",
    `=${S}!B8`,
    "Осталось:",
    `=${S}!B9`
  ]);
  rows.push([]);

  // KPI card headers row 5
  const headerRow: CellValue[] = [];
  const planRow: CellValue[] = [];
  const factRow: CellValue[] = [];
  const forecastRow: CellValue[] = [];
  const gapRow: CellValue[] = [];
  const statusRow: CellValue[] = [];

  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i];
    const col = i * 2;
    headerRow[col] = c.title;
    planRow[col] = "План:";
    planRow[col + 1] = sheetFormula(c.plan);
    factRow[col] = "Факт:";
    factRow[col + 1] = sheetFormula(c.fact);
    forecastRow[col] = "Прогноз:";
    // additive run-rate from fact
    forecastRow[col + 1] = sheetFormula(
      `IF(OR(${colLetter(col + 1)}7="",${S}!B8<=0),"",IF(OR("${c.metricId}"="mg_average_check","${c.metricId}"="mg_cpl"),${colLetter(col + 1)}7,${colLetter(col + 1)}7/${S}!B8*${S}!B10))`
    );
    gapRow[col] = "Разрыв:";
    gapRow[col + 1] = sheetFormula(
      `IF(OR(${colLetter(col + 1)}8="",${colLetter(col + 1)}6=""),"",${colLetter(col + 1)}8-${colLetter(col + 1)}6)`
    );
    statusRow[col] = "Статус:";
    statusRow[col + 1] = sheetFormula(
      [
        `IF(${colLetter(col + 1)}6="","${PM_STATUS.noPlan}",`,
        `IF(${colLetter(col + 1)}7="","${PM_STATUS.noData}",`,
        `IF(${colLetter(col + 1)}7/(${colLetter(col + 1)}6*${S}!B8/${S}!B10)>=${S}!B12,"${PM_STATUS.onTrack}",`,
        `IF(${colLetter(col + 1)}7/(${colLetter(col + 1)}6*${S}!B8/${S}!B10)>=${S}!B13,"${PM_STATUS.risk}","${PM_STATUS.offTrack}"))))`
      ].join("")
    );
  }

  rows.push(headerRow); // 5
  rows.push(planRow); // 6
  rows.push(factRow); // 7
  rows.push(forecastRow); // 8
  rows.push(gapRow); // 9
  rows.push(statusRow); // 10

  rows.push(["Смотрим:", sheetFormula('IF(B22="","—",B22)'), "", "Куда:", sheetFormula('IF(B23="","—",B23)')]); // 11
  rows.push(["Цепочка драйверов", "Факт", "План на дату", "Прогноз", "Статус", "", "Главный риск"]);
  const drivers = [
    ["Бюджет", "mg_budget"],
    ["Лиды", "mg_leads"],
    ["Квал. лиды", "mg_qualified_leads"],
    ["Счета", "mg_invoices"],
    ["Оплаты", "mg_payments"],
    ["Средний чек", "mg_average_check"],
    ["Выручка", "mg_revenue"]
  ] as const;

  let r = 13;
  for (const [label, id] of drivers) {
    rows.push([
      label,
      sheetFormula(`IFERROR(INDEX(${RAW}!L:L,MATCH("${id}",${RAW}!A:A,0)),"")`),
      sheetFormula(
        `IFERROR(IF(INDEX(${RAW}!K:K,MATCH("${id}",${RAW}!A:A,0))="","",INDEX(${RAW}!K:K,MATCH("${id}",${RAW}!A:A,0))*${S}!B8/${S}!B10),"")`
      ),
      sheetFormula(
        `IF(OR(B${r}="",${S}!B8<=0),"",IF("${id}"="mg_average_check",B${r},B${r}/${S}!B8*${S}!B10))`
      ),
      sheetFormula(
        [
          `IF(IFERROR(INDEX(${RAW}!K:K,MATCH("${id}",${RAW}!A:A,0)),"")="","${PM_STATUS.noPlan}",`,
          `IF(B${r}="","${PM_STATUS.noData}",`,
          `IF(OR(C${r}="",C${r}=0),"${PM_STATUS.noData}",`,
          `IF(B${r}/C${r}>=${S}!B12,"${PM_STATUS.onTrack}",`,
          `IF(B${r}/C${r}>=${S}!B13,"${PM_STATUS.risk}","${PM_STATUS.offTrack}")))))`
        ].join("")
      )
    ]);
    r += 1;
  }

  // Driver rows occupy 13..19 (1-based). Diagnosis block starts at row 21.
  rows.push([]); // 20
  rows.push([
    "Главный риск",
    "",
    "",
    "",
    "",
    "",
    "Бюджет → лиды → квал. → счета → оплаты → чек → выручка"
  ]); // 21
  rows.push([
    "Первый сломанный драйвер:",
    sheetFormula(
      [
        `IF(AND(E16="${PM_STATUS.offTrack}",E14<>"${PM_STATUS.offTrack}"),"Счета",`,
        `IF(AND(E17="${PM_STATUS.offTrack}",E16<>"${PM_STATUS.offTrack}"),"Оплаты",`,
        `IF(E14="${PM_STATUS.offTrack}","Лиды",`,
        `IF(E19="${PM_STATUS.offTrack}","Выручка",`,
        `IF(COUNTIF(E13:E19,"${PM_STATUS.offTrack}")=0,"Нет срыва","Недостаточно данных")))))`
      ].join("")
    )
  ]); // 22
  rows.push([
    "Куда смотреть:",
    sheetFormula(
      `IF(OR(B22="Счета",B22="Оплаты"),"Продажи → 04 / 05",IF(B22="Лиды","Маркетинг → 01 / 02 / 03","04_SALES_GENERAL"))`
    )
  ]); // 23
  rows.push([
    "Что тянет вверх:",
    sheetFormula(
      [
        `IF(E18="${PM_STATUS.onTrack}","Средний чек","")&`,
        `IF(AND(E18="${PM_STATUS.onTrack}",OR(E14="${PM_STATUS.onTrack}",E15="${PM_STATUS.onTrack}")),"","")&`,
        `IF(AND(E18<>"${PM_STATUS.onTrack}",E15<>"${PM_STATUS.onTrack}",E14<>"${PM_STATUS.onTrack}"),"Нет компенсирующего драйвера","")`
      ].join("")
    )
  ]); // 24

  rows.push([]);
  rows.push(["Качество данных", sheetFormula(`IFERROR(${quoteTab(PM_SHEETS.diagnostics)}!B2,"—")`), "", "→ 94_DIAGNOSTICS"]);
  rows.push(["Замечание", "Конверсии воронки — по событиям, не когортные (дата лида ≠ дата оплаты)"]);
  rows.push([
    "Недельный план",
    "План месяца режется по неделям пн–вс пропорционально дням (больше дней — больше денег)."
  ]);
  rows.push(["Листы", "01 общее", "02 платный", "03 органика", "04 продажи", "05 менеджеры", "06 действия"]);

  void MG;
  void MET;
  void meta;
  return rows;
}

function buildManagersSheet(settingsTab: string): CellValue[][] {
  const S = quoteTab(settingsTab);
  return [
    ["Менеджеры — сводка"],
    [`Период: =${S}!B3`, "", "Не сравнивать менеджеров только по выручке"],
    [
      "Менеджер",
      "План выручки",
      "Прогноз",
      "Разрыв",
      "Лиды",
      "Квал. лиды",
      "Счета",
      "Оплаты",
      "Конверсия",
      "Средний чек",
      "Активность",
      "Статус",
      "Комментарий"
    ],
    [
      "—",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      PM_STATUS.noData,
      "Планы менеджеров не подключены. Факты — через Sales OS."
    ],
    [],
    ["Детализация менеджера"],
    ["Менеджер", "—", "Список: 93_OWNERS"],
    [],
    ["Метрика", "План", "Факт", "План на дату", "Прогноз", "Разрыв", "Нужный темп", "Статус"],
    ["Назначенные лиды", "", "", "", "", "", "", PM_STATUS.noData],
    ["Обработанные лиды", "", "", "", "", "", "", PM_STATUS.noData],
    ["Квал. лиды", "", "", "", "", "", "", PM_STATUS.noData],
    ["Счета", "", "", "", "", "", "", PM_STATUS.noData],
    ["Оплаты", "", "", "", "", "", "", PM_STATUS.noData],
    ["Выручка", "", "", "", "", "", "", PM_STATUS.noData],
    ["Средний чек", "", "", "", "", "", "", PM_STATUS.noData],
    ["Активность", "", "", "", "", "", "", PM_STATUS.noData],
    ["Ёмкость", "", "", "", "", "", "", PM_STATUS.noData]
  ];
}

function buildDiagnostics(seed: CeoSeedBundle): { rows: CellValue[][]; issues: string[] } {
  const issues: string[] = [];
  for (const m of PM_METRIC_CATALOG) {
    const s = seedForMetricId(m.metric_id, seed);
    if (s.plan == null) issues.push(`NO_PLAN: ${m.metric_id}`);
    if (s.fact == null) issues.push(`NO_FACT: ${m.metric_id}`);
  }
  issues.push("Недельный план: пропорционально дням пн–вс");
  issues.push("Планы менеджеров не подключены");
  issues.push("Конверсии воронки — по событиям, не когортные");

  const rows: CellValue[][] = [
    ["Диагностика", "Значение"],
    ["Замечаний", issues.length],
    ["Статус", issues.length ? `${issues.length} замечаний` : "ок"],
    [],
    ["Код", "Деталь"]
  ];
  for (const issue of issues) {
    const [code, ...rest] = issue.split(": ");
    rows.push([code, rest.join(": ")]);
  }
  return { rows, issues };
}

async function clearConditionalFormats(spreadsheetId: string, sheetId: number) {
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties.sheetId,conditionalFormats)`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return;
  const data = (await res.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number }; conditionalFormats?: unknown[] }>;
  };
  const sheet = data.sheets?.find((s) => s.properties?.sheetId === sheetId);
  const count = sheet?.conditionalFormats?.length ?? 0;
  if (!count) return;
  const requests = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  }
  await batchUpdate(spreadsheetId, requests);
}

async function applyCellNotes(spreadsheetId: string, sheetTitle: string, notes: CellNote[]) {
  if (!notes.length) return;
  const sheetId = await getSheetIdByTitle(spreadsheetId, sheetTitle);
  if (sheetId == null) return;
  await batchUpdate(
    spreadsheetId,
    notes.map((n) => ({
      updateCells: {
        start: { sheetId, rowIndex: n.row - 1, columnIndex: n.col },
        rows: [{ values: [{ note: n.note }] }],
        fields: "note"
      }
    }))
  );
}

function weekHeatmapRules(sheetId: number, blocks: MetricBlockLayout[]): unknown[] {
  const groups = [
    { lowerIsBetter: false, items: blocks.filter((b) => b.metric.direction !== "LOWER_IS_BETTER") },
    { lowerIsBetter: true, items: blocks.filter((b) => b.metric.direction === "LOWER_IS_BETTER") }
  ];
  const out: unknown[] = [];
  for (const group of groups) {
    if (!group.items.length) continue;
    const factRow = group.items[0].factRow;
    const planRow = group.items[0].planRow;
    const factA1 = `${colLetter(PM_COL.w1)}${factRow}`;
    const planA1 = `${colLetter(PM_COL.w1)}${planRow}`;
    const ratio = group.lowerIsBetter ? `${planA1}/${factA1}` : `${factA1}/${planA1}`;
    const denom = group.lowerIsBetter ? factA1 : planA1;
    const ranges = group.items.map((b) => ({
      sheetId,
      startRowIndex: b.factRow - 1,
      endRowIndex: b.factRow,
      startColumnIndex: PM_COL.w1,
      endColumnIndex: PM_COL.w1 + 5
    }));
    const base = `И(ЕЧИСЛО(${factA1});ЕЧИСЛО(${planA1});${denom}<>0`;
    const specs = [
      { formula: `=${base};${ratio}>=0,9)`, bg: PM_COLORS.greenBg, fg: PM_COLORS.greenText },
      {
        formula: `=${base};${ratio}>=0,7;${ratio}<0,9)`,
        bg: PM_COLORS.yellowBg,
        fg: PM_COLORS.yellowText
      },
      { formula: `=${base};${ratio}<0,7)`, bg: PM_COLORS.redBg, fg: PM_COLORS.redText }
    ];
    for (const spec of specs) {
      out.push({
        addConditionalFormatRule: {
          rule: {
            ranges,
            booleanRule: {
              condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: spec.formula }] },
              format: { backgroundColor: spec.bg, textFormat: { foregroundColor: spec.fg } }
            }
          },
          index: 0
        }
      });
    }
  }
  return out;
}

async function applyDetailFormatting(
  spreadsheetId: string,
  sheetTitle: string,
  layout: ReturnType<typeof layoutDetailSheet>,
  meta: ReturnType<typeof periodMeta>
) {
  const sheetId = await getSheetIdByTitle(spreadsheetId, sheetTitle);
  if (sheetId == null) return;

  await clearConditionalFormats(spreadsheetId, sheetId);

  const lastDataRow = Math.max(10, ...layout.blocks.map((b) => b.ptfRow));
  const clearToRow = Math.max(lastDataRow + 15, 80);

  const paint = (
    r1: number,
    r2: number,
    c1: number,
    c2: number,
    format: Record<string, unknown>,
    fields: string
  ) => ({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: r1,
        endRowIndex: r2,
        startColumnIndex: c1,
        endColumnIndex: c2
      },
      cell: { userEnteredFormat: format },
      fields
    }
  });

  const requests: unknown[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: layout.headerRow,
            frozenColumnCount: 0,
            hideGridlines: true
          }
        },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount,gridProperties.hideGridlines"
      }
    },
    paint(0, clearToRow, 0, 20, {}, "userEnteredFormat")
  ];

  for (let i = 0; i < PM_COLUMN_WIDTHS.length; i += 1) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: PM_COLUMN_WIDTHS[i] },
        fields: "pixelSize"
      }
    });
  }

  requests.push(
    paint(layout.focusRow - 1, layout.focusRow, 0, PM_COL.count, {
      backgroundColor: PM_COLORS.yellowBg,
      textFormat: { bold: true, fontFamily: "Roboto", fontSize: 11, foregroundColor: PM_COLORS.yellowText },
      verticalAlignment: "MIDDLE"
    }, "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)")
  );

  for (const row of layout.sectionRows) {
    const block = layout.blocks.find((b) => b.planRow === row + 1);
    const label = pmSectionLabel(block?.section || "");
    requests.push({
      updateCells: {
        start: { sheetId, rowIndex: row - 1, columnIndex: 0 },
        rows: [{ values: [{ userEnteredValue: { stringValue: label } }] }],
        fields: "userEnteredValue"
      }
    });
    requests.push(
      paint(row - 1, row, 0, PM_COL.count, {
        backgroundColor: PM_COLORS.sectionHeader,
        textFormat: { bold: true, fontFamily: "Roboto", fontSize: 11, foregroundColor: PM_COLORS.white },
        verticalAlignment: "MIDDLE"
      }, "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)")
    );
  }

  requests.push(
    paint(layout.headerRow - 1, layout.headerRow, 0, PM_COL.count, {
      backgroundColor: PM_COLORS.headerBg,
      textFormat: { bold: true, fontFamily: "Roboto", fontSize: 10, foregroundColor: PM_COLORS.text },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE"
    }, "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)")
  );

  for (const b of layout.blocks) {
    requests.push(
      paint(b.planRow - 1, b.planRow, 0, PM_COL.count, {
        backgroundColor: PM_COLORS.planRow,
        textFormat: { fontFamily: "Roboto", fontSize: 10 },
        verticalAlignment: "MIDDLE"
      }, "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)")
    );
    requests.push(
      paint(b.planRow - 1, b.planRow, PM_COL.metric, PM_COL.metric + 1, {
        textFormat: { bold: true, fontSize: 11 }
      }, "userEnteredFormat.textFormat")
    );
    requests.push(
      paint(b.factRow - 1, b.factRow, 0, PM_COL.count, {
        backgroundColor: PM_COLORS.white,
        textFormat: { fontFamily: "Roboto", fontSize: 10, foregroundColor: PM_COLORS.text },
        verticalAlignment: "MIDDLE"
      }, "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)")
    );
    requests.push(
      paint(b.factRow - 1, b.factRow, PM_COL.metric, PM_COL.metric + 1, {
        textFormat: { fontFamily: "Roboto", fontSize: 10, foregroundColor: PM_COLORS.textSecondary }
      }, "userEnteredFormat.textFormat")
    );
    requests.push(
      paint(b.ptfRow - 1, b.ptfRow, 0, PM_COL.count, {
        backgroundColor: PM_COLORS.ptfRow,
        textFormat: { fontFamily: "Roboto", fontSize: 10, foregroundColor: PM_COLORS.textSecondary },
        borders: { bottom: { style: "SOLID", width: 1, color: PM_COLORS.border } }
      }, "userEnteredFormat(backgroundColor,textFormat,borders)")
    );
    requests.push(
      paint(b.planRow - 1, b.ptfRow, PM_COL.plan, PM_COL.status, {
        horizontalAlignment: "RIGHT"
      }, "userEnteredFormat.horizontalAlignment")
    );
    requests.push(
      paint(b.ptfRow - 1, b.ptfRow, PM_COL.w1, PM_COL.forecast + 1, {
        numberFormat: { type: "PERCENT", pattern: "0.0%" }
      }, "userEnteredFormat.numberFormat")
    );
    const unitPattern =
      b.metric.unit === "eur" ? "#,##0.00 €" : b.metric.unit === "percent" ? '0.0" %"' : "#,##0.##";
    requests.push(
      paint(b.planRow - 1, b.factRow, PM_COL.plan, PM_COL.pace + 1, {
        numberFormat: { type: "NUMBER", pattern: unitPattern }
      }, "userEnteredFormat.numberFormat")
    );
  }
  requests.push(...weekHeatmapRules(sheetId, layout.blocks));

  const weekCol = PM_COL.w1 + meta.currentWeek - 1;
  requests.push(
    paint(layout.headerRow - 1, layout.headerRow, weekCol, weekCol + 1, {
      backgroundColor: PM_COLORS.currentWeek,
      textFormat: { bold: true, foregroundColor: PM_COLORS.blueAccent }
    }, "userEnteredFormat(backgroundColor,textFormat)")
  );

  const statusRange = {
    sheetId,
    startRowIndex: layout.headerRow,
    endRowIndex: lastDataRow,
    startColumnIndex: PM_COL.status,
    endColumnIndex: PM_COL.status + 1
  };
  for (const rule of PM_STATUS_CF) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [statusRange],
          booleanRule: {
            condition: { type: "TEXT_CONTAINS", values: [{ userEnteredValue: rule.text }] },
            format: {
              backgroundColor: rule.bg,
              textFormat: { foregroundColor: rule.fg, bold: true }
            }
          }
        },
        index: 0
      }
    });
  }

  await batchUpdate(spreadsheetId, requests);
}

async function applyDashboardFormatting(spreadsheetId: string) {
  const sheetId = await getSheetIdByTitle(spreadsheetId, PM_SHEETS.dashboard);
  if (sheetId == null) return;
  await clearConditionalFormats(spreadsheetId, sheetId);
  const requests: unknown[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { hideGridlines: true, frozenRowCount: 3 }
        },
        fields: "gridProperties.hideGridlines,gridProperties.frozenRowCount"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            textFormat: {
              fontFamily: "Roboto",
              fontSize: 18,
              bold: true,
              foregroundColor: PM_COLORS.dark
            }
          }
        },
        fields: "userEnteredFormat.textFormat"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 12 },
        cell: {
          userEnteredFormat: {
            backgroundColor: PM_COLORS.dark,
            textFormat: { bold: true, fontSize: 12, foregroundColor: PM_COLORS.white, fontFamily: "Roboto" },
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            backgroundColor: PM_COLORS.yellowBg,
            textFormat: { bold: true, fontSize: 11, foregroundColor: PM_COLORS.yellowText, fontFamily: "Roboto" },
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)"
      }
    },
    // Legend colors
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 7, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: PM_COLORS.greenBg,
            textFormat: { foregroundColor: PM_COLORS.greenText, bold: true }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 8, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            backgroundColor: PM_COLORS.yellowBg,
            textFormat: { foregroundColor: PM_COLORS.yellowText, bold: true }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 9, endColumnIndex: 10 },
        cell: {
          userEnteredFormat: {
            backgroundColor: PM_COLORS.redBg,
            textFormat: { foregroundColor: PM_COLORS.redText, bold: true }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 10, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: PM_COLORS.noDataBg,
            textFormat: { foregroundColor: PM_COLORS.noDataText, bold: true }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    }
  ];

  // Status CF on dashboard
  for (const rule of PM_STATUS_CF) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            { sheetId, startRowIndex: 9, endRowIndex: 20, startColumnIndex: 0, endColumnIndex: 12 },
            { sheetId, startRowIndex: 12, endRowIndex: 20, startColumnIndex: 4, endColumnIndex: 5 }
          ],
          booleanRule: {
            condition: { type: "TEXT_CONTAINS", values: [{ userEnteredValue: rule.text }] },
            format: {
              backgroundColor: rule.bg,
              textFormat: { foregroundColor: rule.fg, bold: true }
            }
          }
        },
        index: 0
      }
    });
  }

  for (let i = 0; i < 12; i += 1) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: i % 2 === 0 ? 140 : 110 },
        fields: "pixelSize"
      }
    });
  }

  await batchUpdate(spreadsheetId, requests);
}

async function clearFrozenColumns(spreadsheetId: string, titles: string[]) {
  const requests: unknown[] = [];
  for (const title of titles) {
    const sheetId = await getSheetIdByTitle(spreadsheetId, title);
    if (sheetId == null) continue;
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenColumnCount: 0 } },
        fields: "gridProperties.frozenColumnCount"
      }
    });
  }
  await batchUpdate(spreadsheetId, requests);
}

async function writeTab(
  spreadsheetId: string,
  tabTitle: string,
  rows: CellValue[][],
  clearCols = "A:Z"
) {
  await ensureSheetTab(spreadsheetId, tabTitle);
  await ensureSheetRowCapacity({
    spreadsheetId,
    tabTitle,
    requiredRows: Math.max(rows.length + 20, 100)
  });
  await writeSheetValues({
    spreadsheetId,
    range: `${quoteTab(tabTitle)}!A1`,
    clearRange: `${quoteTab(tabTitle)}!${clearCols}`,
    rows,
    valueInputOption: "USER_ENTERED"
  });
}

export async function bootstrapPredictiveSheets(input?: {
  spreadsheetId?: string;
  period?: string;
  asOfDate?: string;
  skipFormatting?: boolean;
  formatOnly?: boolean;
}): Promise<BootstrapResult> {
  const spreadsheetId = input?.spreadsheetId || getPredictiveSheetsSpreadsheetId();
  const period = input?.period || "2026-08";
  const meta = periodMeta(period, input?.asOfDate);
  const detailTitles = [
    PM_SHEETS.marketingGeneral,
    PM_SHEETS.marketingPaid,
    PM_SHEETS.marketingOrganic,
    PM_SHEETS.salesGeneral
  ];

  if (input?.formatOnly) {
    await clearFrozenColumns(spreadsheetId, [...detailTitles, PM_SHEETS.salesManagers]);
    await applyDashboardFormatting(spreadsheetId);
    for (const title of detailTitles) {
      await applyDetailFormatting(spreadsheetId, title, layoutDetailSheet(title), meta);
    }
    return {
      spreadsheetId,
      sheetsCreated: [],
      sheetsReused: detailTitles,
      metricsCount: PM_METRIC_CATALOG.length,
      seededFrom: "format-only",
      missingData: [],
      period
    };
  }

  const ceoSeed = await loadCeoSeed(period);
  let seed = ceoSeed;
  try {
    const bitrix = await loadBitrixMonthFacts(period);
    seed = applyBitrixFacts(seed, bitrix);
  } catch (err) {
    console.warn(
      `[predictive-sheets] Bitrix facts unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  try {
    const channels = await loadSvodChannelFacts({ month: period, throughDate: meta.asOf });
    seed = applyChannelFacts(seed, channels);
  } catch (err) {
    console.warn(
      `[predictive-sheets] СВОД channel facts unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const existing = await listSheetTitles(spreadsheetId);
  const sheetsCreated: string[] = [];
  const sheetsReused: string[] = [];

  // Reuse empty Лист1 as dashboard if present
  if (existing.includes("Лист1") && !existing.includes(PM_SHEETS.dashboard)) {
    await renameSheetIfNeeded(spreadsheetId, "Лист1", PM_SHEETS.dashboard);
  }

  const allTabs = [
    PM_SHEETS.dashboard,
    PM_SHEETS.marketingGeneral,
    PM_SHEETS.marketingPaid,
    PM_SHEETS.marketingOrganic,
    PM_SHEETS.salesGeneral,
    PM_SHEETS.salesManagers,
    PM_SHEETS.actions,
    PM_SHEETS.metrics,
    PM_SHEETS.settings,
    PM_SHEETS.glossary,
    PM_SHEETS.owners,
    PM_SHEETS.diagnostics,
    PM_SHEETS.rawData
  ];

  const titlesNow = await listSheetTitles(spreadsheetId);
  for (const tab of allTabs) {
    if (titlesNow.includes(tab)) sheetsReused.push(tab);
    else {
      await ensureSheetTab(spreadsheetId, tab);
      sheetsCreated.push(tab);
    }
  }

  const diagnostics = buildDiagnostics(seed);

  await writeTab(spreadsheetId, PM_SHEETS.settings, buildSettingsRows(meta, seed.source));
  await writeTab(spreadsheetId, PM_SHEETS.metrics, buildMetricsRows(), "A:O");
  await writeTab(spreadsheetId, PM_SHEETS.glossary, buildGlossaryRows(), "A:F");
  await writeTab(spreadsheetId, PM_SHEETS.owners, buildOwnersRows(), "A:A");
  await writeTab(spreadsheetId, PM_SHEETS.actions, buildActionsHeader(), "A:J");
  await writeTab(spreadsheetId, PM_SHEETS.rawData, buildRawRows(seed), "A:X");
  await writeTab(spreadsheetId, PM_SHEETS.diagnostics, diagnostics.rows, "A:B");
  await writeTab(spreadsheetId, PM_SHEETS.salesManagers, buildManagersSheet(PM_SHEETS.settings), "A:M");

  const detailLayouts: Array<{ title: string; layout: ReturnType<typeof layoutDetailSheet> }> = [];
  for (const title of [
    PM_SHEETS.marketingGeneral,
    PM_SHEETS.marketingPaid,
    PM_SHEETS.marketingOrganic,
    PM_SHEETS.salesGeneral
  ]) {
    const { rows, layout, notes } = buildDetailGrid(title, PM_SHEETS.settings, seed, meta);
    await writeTab(spreadsheetId, title, rows, "A:Z");
    await applyCellNotes(spreadsheetId, title, notes);
    detailLayouts.push({ title, layout });
  }

  await writeTab(
    spreadsheetId,
    PM_SHEETS.dashboard,
    buildDashboardRows(PM_SHEETS.settings, meta),
    "A:L"
  );

  await clearFrozenColumns(spreadsheetId, [
    PM_SHEETS.marketingGeneral,
    PM_SHEETS.marketingPaid,
    PM_SHEETS.marketingOrganic,
    PM_SHEETS.salesGeneral,
    PM_SHEETS.salesManagers
  ]);

  // Formatting
  if (!input?.skipFormatting) {
    await applyDashboardFormatting(spreadsheetId);
    for (const { title, layout } of detailLayouts) {
      await applyDetailFormatting(spreadsheetId, title, layout, meta);
    }

    // Data validation for Actions status
    const actionsId = await getSheetIdByTitle(spreadsheetId, PM_SHEETS.actions);
    if (actionsId != null) {
      await batchUpdate(spreadsheetId, [
        {
          setDataValidation: {
            range: {
              sheetId: actionsId,
              startRowIndex: 2,
              endRowIndex: 100,
              startColumnIndex: 8,
              endColumnIndex: 9
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [
                  { userEnteredValue: "не начато" },
                  { userEnteredValue: "в работе" },
                  { userEnteredValue: "готово" },
                  { userEnteredValue: "блок" }
                ]
              },
              showCustomUi: true,
              strict: true
            }
          }
        },
        {
          updateSheetProperties: {
            properties: { sheetId: actionsId, gridProperties: { frozenRowCount: 2, hideGridlines: true } },
            fields: "gridProperties.frozenRowCount,gridProperties.hideGridlines"
          }
        }
      ]);
    }

    // Hide technical sheets somewhat — keep accessible but tab color
    for (const tech of [PM_SHEETS.rawData, PM_SHEETS.diagnostics]) {
      const id = await getSheetIdByTitle(spreadsheetId, tech);
      if (id == null) continue;
      await batchUpdate(spreadsheetId, [
        {
          updateSheetProperties: {
            properties: { sheetId: id, hidden: false, tabColorStyle: { rgbColor: PM_COLORS.headerBg } },
            fields: "hidden,tabColorStyle"
          }
        }
      ]);
    }

    // Reorder sheets
    const order = allTabs;
    const reorder: unknown[] = [];
    for (let i = 0; i < order.length; i += 1) {
      const id = await getSheetIdByTitle(spreadsheetId, order[i]);
      if (id == null) continue;
      reorder.push({
        updateSheetProperties: {
          properties: { sheetId: id, index: i },
          fields: "index"
        }
      });
    }
    await batchUpdate(spreadsheetId, reorder);
  }

  return {
    spreadsheetId,
    sheetsCreated,
    sheetsReused,
    metricsCount: PM_METRIC_CATALOG.length,
    seededFrom: seed.source,
    missingData: diagnostics.issues,
    period
  };
}
