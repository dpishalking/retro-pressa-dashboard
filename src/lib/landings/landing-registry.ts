import { ALX_ACTIVE_LANDINGS, ALX_LANDINGS_SPREADSHEET_ID, type AlxLandingDef } from "@/config/alx-landings";
import {
  isContractorLandingTabTitle,
  landingFromTab,
  sourceLabelForBook,
  type ContractorBook
} from "@/lib/landings/contractor-books";
import { listContractorBooks } from "@/lib/landings/contractor-books-store";
import { listSpreadsheetTabs } from "@/lib/google/sheets-client";

function withSource(landing: AlxLandingDef, book: ContractorBook): AlxLandingDef {
  return {
    ...landing,
    spreadsheetId: landing.spreadsheetId || book.spreadsheetId,
    sourceLabel: landing.sourceLabel || sourceLabelForBook(book)
  };
}

export async function discoverLandingsForBook(book: ContractorBook): Promise<AlxLandingDef[]> {
  if (book.spreadsheetId === ALX_LANDINGS_SPREADSHEET_ID) {
    return ALX_ACTIVE_LANDINGS.map((landing) => withSource(landing, book));
  }

  const tabs = await listSpreadsheetTabs(book.spreadsheetId);
  return tabs
    .filter((tab) => isContractorLandingTabTitle(tab.title))
    .map((tab) => landingFromTab({ book, sheetTitle: tab.title, gid: tab.sheetId }));
}

export async function listLandingSheets(): Promise<AlxLandingDef[]> {
  const books = await listContractorBooks();
  const groups = await Promise.all(
    books.map(async (book) => {
      try {
        return await discoverLandingsForBook(book);
      } catch (error) {
        console.warn(
          `Landing book ${book.id} skipped:`,
          error instanceof Error ? error.message : error
        );
        return book.spreadsheetId === ALX_LANDINGS_SPREADSHEET_ID
          ? ALX_ACTIVE_LANDINGS.map((landing) => withSource(landing, book))
          : [];
      }
    })
  );

  const byId = new Map<string, AlxLandingDef>();
  for (const landing of groups.flat()) {
    if (!byId.has(landing.id)) byId.set(landing.id, landing);
  }
  return [...byId.values()];
}

export async function getLandingById(id: string): Promise<AlxLandingDef | null> {
  const landings = await listLandingSheets();
  return landings.find((landing) => landing.id === id) ?? null;
}
