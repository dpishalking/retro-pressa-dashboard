import {
  ALX_ACTIVE_LANDINGS,
  ALX_LANDINGS_SPREADSHEET_ID,
  ART_LANDINGS_SPREADSHEET_ID,
  parseLandingSite,
  type AlxLandingDef
} from "@/config/alx-landings";
import { spreadsheetIdFromUrl } from "@/config/google-sources";

export type ContractorBook = {
  id: string;
  spreadsheetId: string;
  title: string;
  url: string;
  seeded: boolean;
  addedAt: string;
};

export const DEFAULT_CONTRACTOR_BOOKS: readonly ContractorBook[] = [
  {
    id: "alx",
    spreadsheetId: ALX_LANDINGS_SPREADSHEET_ID,
    title: "Facebook · подрядчик ALX",
    url: `https://docs.google.com/spreadsheets/d/${ALX_LANDINGS_SPREADSHEET_ID}`,
    seeded: true,
    addedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "art",
    spreadsheetId: ART_LANDINGS_SPREADSHEET_ID,
    title: "Facebook · подрядчик ART",
    url: `https://docs.google.com/spreadsheets/d/${ART_LANDINGS_SPREADSHEET_ID}`,
    seeded: true,
    addedAt: "2026-01-01T00:00:00.000Z"
  }
];

const SUMMARY_TAB = /^(day|week|month|свод|svod|alx|art|artem|артем|sum[_ ]|итог)/i;

export function parseContractorSpreadsheetId(value: string): string {
  return spreadsheetIdFromUrl(value.trim());
}

export function isContractorLandingTabTitle(title: string): boolean {
  const text = String(title || "").trim();
  if (!text || SUMMARY_TAB.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return true;
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[\w./-]*)?\/?$/i.test(text);
}

export function landingIdForTab(spreadsheetId: string, sheetTitle: string): string {
  const known = ALX_ACTIVE_LANDINGS.find(
    (landing) => landing.sheetTitle === sheetTitle && spreadsheetId === ALX_LANDINGS_SPREADSHEET_ID
  );
  if (known) return known.id;
  const slug = sheetTitle
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${spreadsheetId.slice(0, 8).toLowerCase()}-${slug || "landing"}`;
}

export function landingFromTab(input: {
  book: Pick<ContractorBook, "id" | "spreadsheetId" | "title">;
  sheetTitle: string;
  gid: number;
}): AlxLandingDef {
  const known = ALX_ACTIVE_LANDINGS.find(
    (landing) =>
      landing.sheetTitle === input.sheetTitle && input.book.spreadsheetId === ALX_LANDINGS_SPREADSHEET_ID
  );
  const site = parseLandingSite(input.sheetTitle);
  const sourceLabel = sourceLabelForBook(input.book);
  if (known) {
    return {
      ...known,
      spreadsheetId: input.book.spreadsheetId,
      sourceLabel,
      gid: input.gid || known.gid
    };
  }
  return {
    id: landingIdForTab(input.book.spreadsheetId, input.sheetTitle),
    sheetTitle: input.sheetTitle,
    gid: input.gid,
    tag: "green",
    siteName: site.siteName,
    address: site.address,
    spreadsheetId: input.book.spreadsheetId,
    sourceLabel
  };
}

export function sourceLabelForBook(book: Pick<ContractorBook, "id" | "title">): string {
  if (book.id === "alx") return "ALX";
  if (book.id === "art") return "ART";
  const match = book.title.match(/подрядчик\s+(.+)$/i);
  if (match?.[1]) return match[1].trim().slice(0, 24);
  return book.title.replace(/^Facebook\s*[·•]\s*/i, "").trim().slice(0, 24) || "Таблица";
}

export function sheetsUrlForLanding(landing: Pick<AlxLandingDef, "spreadsheetId" | "gid">): string {
  const spreadsheetId = landing.spreadsheetId || ALX_LANDINGS_SPREADSHEET_ID;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${landing.gid || 0}`;
}
