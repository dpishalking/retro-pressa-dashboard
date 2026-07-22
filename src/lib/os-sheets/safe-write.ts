import {
  ensureSheetTab,
  readGoogleServiceAccount,
  readSheetValues,
  writeSheetValues
} from "@/lib/google/sheets-client";

export class SchemaMismatchError extends Error {
  readonly code = "SCHEMA_MISMATCH";
  constructor(message: string) {
    super(message);
    this.name = "SchemaMismatchError";
  }
}

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim()) || /docs\.google\.com\/spreadsheets/i.test(value);
}

export function validateHeader(input: {
  actualHeader: string[];
  expectedColumns: readonly string[];
  tabTitle: string;
}): void {
  const actual = input.actualHeader.map((cell) => String(cell ?? "").trim());
  if (!actual.length) return;

  if (looksLikeUrl(actual[0] || "")) {
    throw new SchemaMismatchError(
      `${input.tabTitle}: first header cell looks like a URL ("${actual[0]?.slice(0, 80)}"). Refusing write.`
    );
  }

  const duplicates = actual.filter((name, index) => name && actual.indexOf(name) !== index);
  if (duplicates.length) {
    throw new SchemaMismatchError(
      `${input.tabTitle}: duplicate header columns: ${[...new Set(duplicates)].join(", ")}`
    );
  }

  const required = [...input.expectedColumns];
  const missing = required.filter((column) => !actual.includes(column));
  // Allow empty sheet or brand-new schema migration when sheet has no overlapping contract.
  const overlap = required.filter((column) => actual.includes(column));
  if (overlap.length === 0 && actual.some(Boolean)) {
    throw new SchemaMismatchError(
      `${input.tabTitle}: header does not match expected contract (no overlapping columns). Refusing write.`
    );
  }

  // Soft require primary key columns when sheet already populated with related schema.
  if (overlap.length > 0 && missing.length && overlap.length < Math.min(3, required.length)) {
    throw new SchemaMismatchError(
      `${input.tabTitle}: header mismatch, missing: ${missing.slice(0, 8).join(", ")}`
    );
  }
}

export function validateSchema(input: {
  header: string[];
  rows: Array<Array<string | number | boolean | null>>;
  expectedColumns: readonly string[];
  tabTitle: string;
}) {
  validateHeader({
    actualHeader: input.header,
    expectedColumns: input.expectedColumns,
    tabTitle: input.tabTitle
  });
  const width = input.expectedColumns.length;
  for (let index = 0; index < input.rows.length; index += 1) {
    if (input.rows[index].length !== width) {
      throw new SchemaMismatchError(
        `${input.tabTitle}: row ${index + 1} has ${input.rows[index].length} cells, expected ${width}`
      );
    }
  }
}

export function preserveManualColumns<T extends Record<string, string>>(input: {
  existingRows: T[];
  incomingRows: T[];
  key: keyof T;
  manualColumns: readonly (keyof T)[];
}): T[] {
  const existingByKey = new Map(input.existingRows.map((row) => [String(row[input.key]), row]));
  return input.incomingRows.map((incoming) => {
    const existing = existingByKey.get(String(incoming[input.key]));
    if (!existing) return incoming;
    const next = { ...incoming };
    for (const column of input.manualColumns) {
      const value = existing[column];
      if (typeof value === "string" && value.trim()) {
        next[column] = value;
      }
    }
    return next;
  });
}

/**
 * Safe full replace: validate existing header (if any), prepare rows in memory, then clear+write.
 * Refuses clear when header is corrupted / mismatched.
 */
export async function safeReplaceSheet(input: {
  spreadsheetId: string;
  tabTitle: string;
  expectedColumns: readonly string[];
  rows: Array<Array<string | number | boolean | null>>;
  clearRange: string;
  schemaVersion?: string;
  valueInputOption?: "RAW" | "USER_ENTERED";
}) {
  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured");
  }

  await ensureSheetTab(input.spreadsheetId, input.tabTitle);
  const existing = await readSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${quoteTab(input.tabTitle)}!A1:ZZ1`
  });
  const actualHeader = existing[0] ?? [];
  validateHeader({
    actualHeader,
    expectedColumns: input.expectedColumns,
    tabTitle: input.tabTitle
  });

  const payload = [[...input.expectedColumns], ...input.rows];
  validateSchema({
    header: [...input.expectedColumns],
    rows: input.rows,
    expectedColumns: input.expectedColumns,
    tabTitle: input.tabTitle
  });

  await writeSheetValues({
    spreadsheetId: input.spreadsheetId,
    range: `${quoteTab(input.tabTitle)}!A1`,
    clearRange: input.clearRange,
    valueInputOption: input.valueInputOption ?? "USER_ENTERED",
    rows: payload
  });

  return {
    tabTitle: input.tabTitle,
    rowsWritten: input.rows.length,
    schemaVersion: input.schemaVersion ?? "1"
  };
}
