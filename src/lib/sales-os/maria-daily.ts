import { MARIA_DAILY_COLUMNS } from "@/config/sales-os";
import { parseSheetNumber } from "@/lib/os-sheets/sales-metric-defs";

export type MariaDailyRow = Record<(typeof MARIA_DAILY_COLUMNS)[number], string>;

/** Known seed from Maria chat (2026-07-22) for 2026-07-21 — only inserted if date missing. */
export const MARIA_DAILY_SEED: MariaDailyRow[] = [
  {
    date: "2026-07-21",
    invoices_count: "28",
    invoices_amount: "1859",
    paid_same_day_count: "18",
    paid_same_day_amount: "1275",
    paid_total_count: "22",
    paid_total_amount: "1510",
    notes: "Maria chat 2026-07-22 — operational flueger",
    source: "maria",
    updated_at: "2026-07-22T05:25:00.000Z"
  }
];

export function emptyMariaDailyRow(): MariaDailyRow {
  return Object.fromEntries(MARIA_DAILY_COLUMNS.map((column) => [column, ""])) as MariaDailyRow;
}

export function mariaDailyFromMap(row: Record<string, string>): MariaDailyRow | null {
  const date = String(row.date ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const out = emptyMariaDailyRow();
  for (const column of MARIA_DAILY_COLUMNS) {
    out[column] = String(row[column] ?? "").trim();
  }
  out.date = date;
  return out;
}

/**
 * Preserve all existing Maria rows. Add seed dates only when missing.
 * Never overwrites a date that already exists on the sheet.
 */
export function mergeMariaDailyRows(input: {
  existing: MariaDailyRow[];
  seed?: MariaDailyRow[];
  syncedAt: string;
}): MariaDailyRow[] {
  const byDate = new Map<string, MariaDailyRow>();
  for (const row of input.existing) {
    if (row.date) byDate.set(row.date, { ...row });
  }
  for (const row of input.seed || MARIA_DAILY_SEED) {
    if (!row.date || byDate.has(row.date)) continue;
    byDate.set(row.date, {
      ...row,
      updated_at: row.updated_at || input.syncedAt
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mariaRowForDate(rows: MariaDailyRow[], date: string): MariaDailyRow | null {
  return rows.find((row) => row.date === date) || null;
}

export function mariaHasPaidFact(row: MariaDailyRow | null | undefined): boolean {
  if (!row) return false;
  return String(row.paid_total_count || "").trim() !== "" || String(row.paid_total_amount || "").trim() !== "";
}

export function sumMariaMonth(rows: MariaDailyRow[], month: string): {
  invoicesCount: number;
  invoicesAmount: number;
  paidCount: number;
  paidAmount: number;
  daysWithPaid: number;
} {
  let invoicesCount = 0;
  let invoicesAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  let daysWithPaid = 0;
  for (const row of rows) {
    if (!row.date.startsWith(month)) continue;
    invoicesCount += parseSheetNumber(row.invoices_count);
    invoicesAmount += parseSheetNumber(row.invoices_amount);
    const payC = parseSheetNumber(row.paid_total_count);
    const payA = parseSheetNumber(row.paid_total_amount);
    if (String(row.paid_total_count || "").trim() !== "" || String(row.paid_total_amount || "").trim() !== "") {
      daysWithPaid += 1;
      paidCount += payC;
      paidAmount += payA;
    }
  }
  return { invoicesCount, invoicesAmount, paidCount, paidAmount, daysWithPaid };
}
