import { EXPORT_STALE_MINUTES } from "@/config/sales-dual-run";
import { getSalesOsSpreadsheetId, SALES_OS_SHEETS } from "@/config/sales-os";
import {
  SALES_EXPORT_COLUMNS,
  SALES_EXPORT_CONTRACT_VERSION,
  validateSalesExportHeader,
  validateSalesExportRows,
  type SalesExportRow
} from "@/lib/sales-os/export-contract";
import { listSheetTitles, readSheetValues } from "@/lib/google/sheets-client";

export type ExportReadResult = {
  ok: boolean;
  spreadsheetId: string;
  tabTitle: string;
  contractVersion: string;
  rows: SalesExportRow[];
  rowsRead: number;
  duplicateKeys: string[];
  sourceUpdatedAt: string;
  lagMinutes: number | null;
  stale: boolean;
  errors: string[];
  warnings: string[];
};

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function toNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function classifyIngestStatus(input: {
  stale: boolean;
  partial: boolean;
  schemaError: boolean;
}): "current" | "stale" | "partial" | "schema_error" {
  if (input.schemaError) return "schema_error";
  if (input.stale) return "stale";
  if (input.partial) return "partial";
  return "current";
}

export async function readSalesOsExport(options: {
  spreadsheetId?: string;
  staleMinutes?: number;
} = {}): Promise<ExportReadResult> {
  const spreadsheetId = options.spreadsheetId?.trim() || getSalesOsSpreadsheetId();
  const tabTitle = SALES_OS_SHEETS.export;
  const errors: string[] = [];
  const warnings: string[] = [];

  const titles = await listSheetTitles(spreadsheetId);
  if (!titles.includes(tabTitle)) {
    return {
      ok: false,
      spreadsheetId,
      tabTitle,
      contractVersion: "",
      rows: [],
      rowsRead: 0,
      duplicateKeys: [],
      sourceUpdatedAt: "",
      lagMinutes: null,
      stale: false,
      errors: [`Missing sheet ${tabTitle}`],
      warnings
    };
  }

  const values = await readSheetValues({
    spreadsheetId,
    range: `${quoteTab(tabTitle)}!A1:ZZ`
  });
  if (!values.length) {
    return {
      ok: false,
      spreadsheetId,
      tabTitle,
      contractVersion: "",
      rows: [],
      rowsRead: 0,
      duplicateKeys: [],
      sourceUpdatedAt: "",
      lagMinutes: null,
      stale: false,
      errors: ["Export sheet is empty"],
      warnings
    };
  }

  const [header, ...lines] = values;
  const headerCheck = validateSalesExportHeader(header.map((cell) => String(cell ?? "")));
  if (!headerCheck.ok) {
    return {
      ok: false,
      spreadsheetId,
      tabTitle,
      contractVersion: "",
      rows: [],
      rowsRead: 0,
      duplicateKeys: [],
      sourceUpdatedAt: "",
      lagMinutes: null,
      stale: false,
      errors: headerCheck.errors,
      warnings
    };
  }

  const keys = header.map((cell) => String(cell ?? "").trim());
  const rows: SalesExportRow[] = [];
  for (const line of lines) {
    if (!line.some((cell) => String(cell ?? "").trim())) continue;
    const raw: Record<string, string> = {};
    keys.forEach((key, index) => {
      if (!key) return;
      raw[key] = String(line[index] ?? "").trim();
    });
    const row = {} as SalesExportRow;
    for (const column of SALES_EXPORT_COLUMNS) {
      row[column] = raw[column] ?? "";
    }
    rows.push(row);
  }

  const rowCheck = validateSalesExportRows(rows);
  if (!rowCheck.ok) errors.push(...rowCheck.errors);

  const seen = new Set<string>();
  const duplicateKeys: string[] = [];
  for (const row of rows) {
    const key = `${row.date}|${row.manager_id}`;
    if (seen.has(key)) duplicateKeys.push(key);
    seen.add(key);
  }

  const sourceUpdatedAt = rows
    .map((row) => String(row.sync_updated_at || row.source_updated_at || ""))
    .filter(Boolean)
    .sort()
    .at(-1) || "";

  let lagMinutes: number | null = null;
  let stale = false;
  if (sourceUpdatedAt) {
    const ts = Date.parse(sourceUpdatedAt);
    if (Number.isFinite(ts)) {
      lagMinutes = Math.round((Date.now() - ts) / 60000);
      const limit = options.staleMinutes ?? EXPORT_STALE_MINUTES;
      stale = lagMinutes > limit;
      if (stale) warnings.push(`Export is stale: lag ${lagMinutes} minutes`);
    }
  }

  // numeric sanity already in validateSalesExportRows; keep toNumber for future
  void toNumber;

  return {
    ok: errors.length === 0 && duplicateKeys.length === 0,
    spreadsheetId,
    tabTitle,
    contractVersion: SALES_EXPORT_CONTRACT_VERSION,
    rows,
    rowsRead: rows.length,
    duplicateKeys,
    sourceUpdatedAt,
    lagMinutes,
    stale,
    errors: [...errors, ...duplicateKeys.map((key) => `duplicate key ${key}`)],
    warnings
  };
}
