import { getGoogleAccessToken } from "@/lib/google/sheets-client";
import {
  PREDICTIVE_FIRST_WEEK_COL,
  PREDICTIVE_GRID_LAST_ROW,
  PREDICTIVE_METRICS,
  PREDICTIVE_SECTION_MICRO_ROW,
  TRAFFIC_YELLOW_MAX_RATIO_LOWER,
  TRAFFIC_YELLOW_MIN_RATIO,
  colLetter,
  layoutForMonth,
  type PredictiveMetricKey,
  type PredictivePolarity
} from "@/lib/sales-os/predictive-model";

const COLOR = {
  lagBlue: { red: 0.788, green: 0.855, blue: 0.973 },
  monthPink: { red: 0.918, green: 0.82, blue: 0.863 },
  dayBlue: { red: 0.239, green: 0.522, blue: 0.776 },
  planGray: { red: 0.937, green: 0.937, blue: 0.937 },
  leadPurple: { red: 0.851, green: 0.824, blue: 0.914 },
  white: { red: 1, green: 1, blue: 1 },
  softYellow: { red: 1, green: 0.949, blue: 0.8 }
};

const WHITE = { red: 1, green: 1, blue: 1 };
const GRAY_TEXT = { red: 0.4, green: 0.4, blue: 0.4 };

function rgb(c: { red: number; green: number; blue: number }) {
  return { red: c.red, green: c.green, blue: c.blue };
}

type CellFormat = Record<string, unknown>;

function baseFormat(partial: CellFormat): CellFormat {
  return partial;
}

/** Apply sales-funnel visual design to predictive tab. */
export async function applyPredictiveTemplateDesign(input: {
  spreadsheetId: string;
  sheetId: number;
  month?: string;
}): Promise<void> {
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const sheetId = input.sheetId;
  const layout = layoutForMonth(input.month || new Date().toISOString().slice(0, 7));
  const { weekBlocks, monthCol } = layout;
  const lastCol = monthCol + 1;
  const lastRow = PREDICTIVE_GRID_LAST_ROW;
  const requests: unknown[] = [];

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}?fields=sheets(properties(sheetId,title),merges)`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  const meta = (await metaRes.json()) as {
    sheets?: Array<{
      properties?: { sheetId?: number };
      merges?: Array<{
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      }>;
    }>;
  };
  const sheet = meta.sheets?.find((s) => s.properties?.sheetId === sheetId);
  for (const m of sheet?.merges || []) {
    if ((m.startRowIndex ?? 0) < lastRow + 5 && (m.startColumnIndex ?? 0) < lastCol) {
      requests.push({ unmergeCells: { range: { sheetId, ...m } } });
    }
  }

  requests.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: lastRow,
        endRowIndex: lastRow + 5,
        startColumnIndex: 0,
        endColumnIndex: lastCol
      },
      fields: "userEnteredValue,userEnteredFormat"
    }
  });

  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 140 },
      fields: "pixelSize"
    }
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 70 },
      fields: "pixelSize"
    }
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
      properties: { pixelSize: 56 },
      fields: "pixelSize"
    }
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: lastCol },
      properties: { pixelSize: 92 },
      fields: "pixelSize"
    }
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 36 },
      fields: "pixelSize"
    }
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 3 },
      properties: { pixelSize: 24 },
      fields: "pixelSize"
    }
  });

  const paint = (
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
    format: CellFormat
  ) => {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: startRow,
          endRowIndex: endRow,
          startColumnIndex: startCol,
          endColumnIndex: endCol
        },
        cell: { userEnteredFormat: format },
        fields: "userEnteredFormat"
      }
    });
  };

  paint(0, 1, 0, 2, baseFormat({
    backgroundColor: rgb(COLOR.lagBlue),
    horizontalAlignment: "CENTER",
    verticalAlignment: "MIDDLE",
    textFormat: { fontFamily: "Helvetica Neue", bold: true, fontSize: 11 }
  }));
  paint(0, 1, 2, 3, baseFormat({
    backgroundColor: rgb(COLOR.monthPink),
    horizontalAlignment: "CENTER",
    verticalAlignment: "MIDDLE",
    wrapStrategy: "WRAP",
    textFormat: { fontFamily: "Arial", bold: true, fontSize: 10 }
  }));
  paint(0, 1, 3, lastCol, baseFormat({
    backgroundColor: rgb(COLOR.lagBlue),
    horizontalAlignment: "CENTER",
    verticalAlignment: "MIDDLE",
    textFormat: { fontFamily: "Cuprum", bold: true }
  }));

  paint(1, 2, 0, 3, baseFormat({
    backgroundColor: rgb(COLOR.white),
    textFormat: { fontFamily: "Cuprum" }
  }));
  for (const block of weekBlocks) {
    paint(1, 2, block.totalCol, block.totalCol + 1, baseFormat({
      backgroundColor: rgb(COLOR.lagBlue),
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE",
      textFormat: { fontFamily: "Cuprum", bold: true }
    }));
    paint(1, 2, block.dayCols[0], block.dayCols[6] + 1, baseFormat({
      backgroundColor: rgb(COLOR.dayBlue),
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE",
      textFormat: { fontFamily: "Cuprum", bold: true, foregroundColor: WHITE }
    }));
  }
  paint(1, 2, monthCol, lastCol, baseFormat({
    backgroundColor: rgb(COLOR.lagBlue),
    horizontalAlignment: "CENTER",
    verticalAlignment: "MIDDLE",
    textFormat: { fontFamily: "Cuprum", bold: true }
  }));

  paint(2, 3, 0, lastCol, baseFormat({
    backgroundColor: rgb(COLOR.white),
    horizontalAlignment: "CENTER",
    textFormat: { fontFamily: "Cuprum", fontSize: 9 }
  }));
  // Day cells hold Sheets date serials after USER_ENTERED — show as DD.MM, not 46204.
  for (const block of weekBlocks) {
    paint(2, 3, block.dayCols[0], block.dayCols[6] + 1, baseFormat({
      backgroundColor: rgb(COLOR.white),
      horizontalAlignment: "CENTER",
      numberFormat: { type: "DATE", pattern: "DD.MM" },
      textFormat: { fontFamily: "Cuprum", fontSize: 9 }
    }));
  }

  const planLabel = baseFormat({
    backgroundColor: rgb(COLOR.planGray),
    verticalAlignment: "MIDDLE",
    textFormat: { fontFamily: "Helvetica Neue", bold: true, fontSize: 10 }
  });
  const planKind = baseFormat({
    backgroundColor: rgb(COLOR.planGray),
    horizontalAlignment: "RIGHT",
    textFormat: { fontFamily: "Caveat", fontSize: 12, foregroundColor: GRAY_TEXT }
  });
  const factLabel = baseFormat({
    backgroundColor: rgb(COLOR.white),
    textFormat: { fontFamily: "Helvetica Neue", fontSize: 10 }
  });
  const factKind = baseFormat({
    backgroundColor: rgb(COLOR.white),
    horizontalAlignment: "RIGHT",
    textFormat: { fontFamily: "Caveat", fontSize: 12, foregroundColor: GRAY_TEXT }
  });

  const numberPattern = (style: string) => {
    if (style === "currency") return { type: "CURRENCY", pattern: "[$€]#,##0.00" };
    if (style === "percent") return { type: "PERCENT", pattern: "0%" };
    return { type: "NUMBER", pattern: "#,##0" };
  };

  const metrics = (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).map((key) => ({
    planRow: PREDICTIVE_METRICS[key].planRow,
    factRow: PREDICTIVE_METRICS[key].factRow,
    ptfRow: PREDICTIVE_METRICS[key].ptfRow,
    style: PREDICTIVE_METRICS[key].style
  }));

  const ptfKind = baseFormat({
    backgroundColor: { red: 0.9, green: 0.93, blue: 0.98 },
    horizontalAlignment: "RIGHT",
    textFormat: { fontFamily: "Caveat", fontSize: 12, foregroundColor: GRAY_TEXT }
  });
  const ptfLabel = baseFormat({
    backgroundColor: { red: 0.9, green: 0.93, blue: 0.98 },
    textFormat: { fontFamily: "Helvetica Neue", fontSize: 10, italic: true }
  });

  for (const m of metrics) {
    const pr = m.planRow - 1;
    const fr = m.factRow - 1;
    const ptf = m.ptfRow - 1;
    paint(pr, pr + 1, 0, 1, planLabel);
    paint(pr, pr + 1, 1, 2, planKind);
    paint(fr, fr + 1, 0, 1, factLabel);
    paint(fr, fr + 1, 1, 2, factKind);
    paint(ptf, ptf + 1, 0, 1, ptfLabel);
    paint(ptf, ptf + 1, 1, 2, ptfKind);
    paint(pr, pr + 1, 3, lastCol, baseFormat({
      backgroundColor: rgb(COLOR.planGray),
      horizontalAlignment: "CENTER",
      numberFormat: numberPattern(m.style),
      textFormat: { fontFamily: "Cuprum", fontSize: 10 }
    }));
    paint(fr, fr + 1, 3, lastCol, baseFormat({
      backgroundColor: rgb(COLOR.white),
      horizontalAlignment: "CENTER",
      numberFormat: numberPattern(m.style),
      textFormat: { fontFamily: "Cuprum", bold: true, fontSize: 10 }
    }));
    paint(ptf, ptf + 1, 3, lastCol, baseFormat({
      backgroundColor: { red: 0.9, green: 0.93, blue: 0.98 },
      horizontalAlignment: "CENTER",
      numberFormat: { type: "PERCENT", pattern: "0.0%" },
      textFormat: { fontFamily: "Cuprum", italic: true, fontSize: 10 }
    }));
  }

  const micro = PREDICTIVE_SECTION_MICRO_ROW - 1;
  paint(micro, micro + 1, 0, 2, baseFormat({
    backgroundColor: rgb(COLOR.leadPurple),
    horizontalAlignment: "CENTER",
    verticalAlignment: "MIDDLE",
    textFormat: { fontFamily: "Helvetica Neue", bold: true, fontSize: 11 }
  }));
  paint(micro, micro + 1, 3, lastCol, baseFormat({
    backgroundColor: rgb(COLOR.leadPurple),
    textFormat: { fontFamily: "Cuprum" }
  }));

  for (const m of metrics) {
    const pr = m.planRow - 1;
    const fr = m.factRow - 1;
    const ptf = m.ptfRow - 1;
    for (const block of weekBlocks) {
      paint(pr, pr + 1, block.totalCol, block.totalCol + 1, baseFormat({
        backgroundColor: { red: 0.953, green: 0.953, blue: 0.953 },
        horizontalAlignment: "CENTER",
        numberFormat: numberPattern(m.style),
        textFormat: { fontFamily: "Cuprum", bold: true, fontSize: 10 }
      }));
      paint(fr, fr + 1, block.totalCol, block.totalCol + 1, baseFormat({
        backgroundColor: rgb(COLOR.softYellow),
        horizontalAlignment: "CENTER",
        numberFormat: numberPattern(m.style),
        textFormat: { fontFamily: "Cuprum", bold: true, fontSize: 10 }
      }));
      paint(ptf, ptf + 1, block.totalCol, block.totalCol + 1, baseFormat({
        backgroundColor: { red: 0.86, green: 0.91, blue: 0.97 },
        horizontalAlignment: "CENTER",
        numberFormat: { type: "PERCENT", pattern: "0.0%" },
        textFormat: { fontFamily: "Cuprum", italic: true, bold: true, fontSize: 10 }
      }));
    }
    paint(pr, pr + 1, monthCol, lastCol, baseFormat({
      backgroundColor: { red: 0.953, green: 0.953, blue: 0.953 },
      horizontalAlignment: "CENTER",
      numberFormat: numberPattern(m.style),
      textFormat: { fontFamily: "Cuprum", bold: true, fontSize: 10 }
    }));
    paint(fr, fr + 1, monthCol, lastCol, baseFormat({
      backgroundColor: rgb(COLOR.softYellow),
      horizontalAlignment: "CENTER",
      numberFormat: numberPattern(m.style),
      textFormat: { fontFamily: "Cuprum", bold: true, fontSize: 10 }
    }));
    paint(ptf, ptf + 1, monthCol, lastCol, baseFormat({
      backgroundColor: { red: 0.86, green: 0.91, blue: 0.97 },
      horizontalAlignment: "CENTER",
      numberFormat: { type: "PERCENT", pattern: "0.0%" },
      textFormat: { fontFamily: "Cuprum", italic: true, bold: true, fontSize: 10 }
    }));
  }

  paint(0, lastRow, 2, 3, baseFormat({
    backgroundColor: rgb(COLOR.monthPink),
    horizontalAlignment: "CENTER",
    verticalAlignment: "MIDDLE",
    textFormat: { fontFamily: "Arial", bold: true }
  }));

  requests.push({
    mergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
      mergeType: "MERGE_ALL"
    }
  });
  requests.push({
    mergeCells: {
      range: {
        sheetId,
        startRowIndex: micro,
        endRowIndex: micro + 1,
        startColumnIndex: 0,
        endColumnIndex: 2
      },
      mergeType: "MERGE_ALL"
    }
  });
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount: 3, frozenColumnCount: 2 }
      },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
    }
  });
  requests.push({
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: lastRow,
        startColumnIndex: 0,
        endColumnIndex: lastCol
      },
      top: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
      bottom: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
      left: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
      right: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
      innerHorizontal: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } },
      innerVertical: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } }
    }
  });

  const chunkSize = 80;
  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ requests: chunk })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`design batchUpdate failed: ${res.status} ${body.slice(0, 400)}`);
    }
  }

  await applyPredictiveTrafficLights({
    spreadsheetId: input.spreadsheetId,
    sheetId,
    month: input.month || new Date().toISOString().slice(0, 7)
  });
}

const TRAFFIC_COLORS = {
  green: { red: 0.78, green: 0.9, blue: 0.79 },
  yellow: { red: 1, green: 0.95, blue: 0.7 },
  red: { red: 0.96, green: 0.8, blue: 0.8 }
};

function trafficFormulas(input: {
  planRow1: number;
  factRow1: number;
  startColLetter: string;
  polarity: PredictivePolarity;
}): { green: string; yellow: string; red: string } {
  const F = `${input.startColLetter}${input.factRow1}`;
  const P = `${input.startColLetter}${input.planRow1}`;
  // Workbook locale is ru_RU: use ";" arg sep and "," decimal.
  const yellowMin = String(TRAFFIC_YELLOW_MIN_RATIO).replace(".", ",");
  const yellowMaxLower = String(TRAFFIC_YELLOW_MAX_RATIO_LOWER).replace(".", ",");
  const base = `AND(ISNUMBER(${F});ISNUMBER(${P});${P}>0`;
  if (input.polarity === "higher_better") {
    return {
      green: `=${base};${F}/${P}>=1)`,
      yellow: `=${base};${F}/${P}>=${yellowMin};${F}/${P}<1)`,
      red: `=${base};${F}/${P}<${yellowMin})`
    };
  }
  return {
    green: `=${base};${F}/${P}<=1)`,
    yellow: `=${base};${F}/${P}>1;${F}/${P}<=${yellowMaxLower})`,
    red: `=${base};${F}/${P}>${yellowMaxLower})`
  };
}

function ptfTrafficFormulas(input: {
  ptfRow1: number;
  startColLetter: string;
  polarity: PredictivePolarity;
}): { green: string; yellow: string; red: string } {
  const C = `${input.startColLetter}${input.ptfRow1}`;
  const yellowMin = String(TRAFFIC_YELLOW_MIN_RATIO).replace(".", ",");
  const yellowMaxLower = String(TRAFFIC_YELLOW_MAX_RATIO_LOWER).replace(".", ",");
  const base = `AND(ISNUMBER(${C})`;
  if (input.polarity === "higher_better") {
    return {
      green: `=${base};${C}>=1)`,
      yellow: `=${base};${C}>=${yellowMin};${C}<1)`,
      red: `=${base};${C}<${yellowMin})`
    };
  }
  return {
    green: `=${base};${C}<=1)`,
    yellow: `=${base};${C}>1;${C}<=${yellowMaxLower})`,
    red: `=${base};${C}>${yellowMaxLower})`
  };
}

/** Conditional formatting: fact vs plan + PTF% vs 100% on day / week / month columns. */
export async function applyPredictiveTrafficLights(input: {
  spreadsheetId: string;
  sheetId: number;
  month: string;
  metricDefs?: Array<{
    planRow: number;
    factRow: number;
    ptfRow: number;
    polarity: PredictivePolarity;
  }>;
}): Promise<void> {
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
  const layout = layoutForMonth(input.month);
  const startCol = PREDICTIVE_FIRST_WEEK_COL;
  const endCol = layout.monthCol + 1;
  const startL = colLetter(startCol);

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}?fields=sheets(properties(sheetId),conditionalFormats)`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  const meta = (await metaRes.json()) as {
    sheets?: Array<{
      properties?: { sheetId?: number };
      conditionalFormats?: unknown[];
    }>;
  };
  const sheet = meta.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
  const existingCount = sheet?.conditionalFormats?.length ?? 0;
  const requests: unknown[] = [];
  for (let i = existingCount - 1; i >= 0; i -= 1) {
    requests.push({
      deleteConditionalFormatRule: { sheetId: input.sheetId, index: i }
    });
  }

  const addRules = (
    row1: number,
    formulas: { green: string; yellow: string; red: string }
  ) => {
    const range = {
      sheetId: input.sheetId,
      startRowIndex: row1 - 1,
      endRowIndex: row1,
      startColumnIndex: startCol,
      endColumnIndex: endCol
    };
    for (const [light, formula] of [
      ["green", formulas.green],
      ["yellow", formulas.yellow],
      ["red", formulas.red]
    ] as const) {
      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [range],
            booleanRule: {
              condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: formula }] },
              format: { backgroundColor: TRAFFIC_COLORS[light] }
            }
          },
          index: 0
        }
      });
    }
  };

  const defs =
    input.metricDefs ||
    (Object.keys(PREDICTIVE_METRICS) as PredictiveMetricKey[]).map((key) => ({
      planRow: PREDICTIVE_METRICS[key].planRow,
      factRow: PREDICTIVE_METRICS[key].factRow,
      ptfRow: PREDICTIVE_METRICS[key].ptfRow,
      polarity: PREDICTIVE_METRICS[key].polarity as PredictivePolarity
    }));

  for (const metaM of defs) {
    addRules(
      metaM.factRow,
      trafficFormulas({
        planRow1: metaM.planRow,
        factRow1: metaM.factRow,
        startColLetter: startL,
        polarity: metaM.polarity
      })
    );
    addRules(
      metaM.ptfRow,
      ptfTrafficFormulas({
        ptfRow1: metaM.ptfRow,
        startColLetter: startL,
        polarity: metaM.polarity
      })
    );
  }

  const chunkSize = 40;
  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ requests: chunk })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`traffic lights batchUpdate failed: ${res.status} ${body.slice(0, 400)}`);
    }
  }
}

export async function getSheetIdByTitle(spreadsheetId: string, title: string): Promise<number | null> {
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly");
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  const data = (await res.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };
  const match = data.sheets?.find((s) => s.properties?.title === title);
  return match?.properties?.sheetId ?? null;
}
