import { getGoogleAccessToken } from "@/lib/google/sheets-client";
import {
  PREDICTIVE_GRID_LAST_ROW,
  PREDICTIVE_METRICS,
  PREDICTIVE_SECTION_MICRO_ROW,
  PREDICTIVE_SECTION_SLA_ROW,
  layoutForMonth,
  type PredictiveMetricKey
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
    if ((m.startRowIndex ?? 0) < 40 && (m.startColumnIndex ?? 0) < lastCol) {
      requests.push({ unmergeCells: { range: { sheetId, ...m } } });
    }
  }

  requests.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: lastRow,
        endRowIndex: 40,
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
    style: PREDICTIVE_METRICS[key].style
  }));

  for (const m of metrics) {
    const pr = m.planRow - 1;
    const fr = m.factRow - 1;
    paint(pr, pr + 1, 0, 1, planLabel);
    paint(pr, pr + 1, 1, 2, planKind);
    paint(fr, fr + 1, 0, 1, factLabel);
    paint(fr, fr + 1, 1, 2, factKind);
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
  }

  const micro = PREDICTIVE_SECTION_MICRO_ROW - 1;
  const sla = PREDICTIVE_SECTION_SLA_ROW - 1;
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
  paint(sla, sla + 1, 0, 2, baseFormat({
    backgroundColor: { red: 0.957, green: 0.8, blue: 0.8 },
    horizontalAlignment: "CENTER",
    verticalAlignment: "MIDDLE",
    textFormat: { fontFamily: "Helvetica Neue", bold: true, fontSize: 11 }
  }));
  paint(sla, sla + 1, 3, lastCol, baseFormat({
    backgroundColor: { red: 0.957, green: 0.8, blue: 0.8 },
    textFormat: { fontFamily: "Cuprum" }
  }));

  for (const m of metrics) {
    const pr = m.planRow - 1;
    const fr = m.factRow - 1;
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
    mergeCells: {
      range: {
        sheetId,
        startRowIndex: sla,
        endRowIndex: sla + 1,
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
