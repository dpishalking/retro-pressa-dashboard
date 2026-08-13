import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateId } from "@/lib/training/id";
import {
  DEFAULT_CONTRACTOR_BOOKS,
  parseContractorSpreadsheetId,
  type ContractorBook
} from "@/lib/landings/contractor-books";

const booksDir = process.env.LANDING_CONTRACTOR_BOOKS_DIR?.trim()
  ? path.resolve(process.env.LANDING_CONTRACTOR_BOOKS_DIR.trim())
  : path.join(process.cwd(), "data", "landing-contractor-books");
const catalogPath = path.join(booksDir, "catalog.json");

let catalogLock: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = catalogLock.then(fn);
  catalogLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

type Catalog = { version: 1; books: ContractorBook[] };

function isBook(value: unknown): value is ContractorBook {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<ContractorBook>;
  return (
    typeof book.id === "string" &&
    typeof book.spreadsheetId === "string" &&
    book.spreadsheetId.length > 8 &&
    typeof book.title === "string" &&
    typeof book.url === "string"
  );
}

function normalizeBook(book: ContractorBook): ContractorBook {
  return {
    id: book.id,
    spreadsheetId: book.spreadsheetId,
    title: book.title.trim() || "Таблица подрядчика",
    url: book.url,
    seeded: Boolean(book.seeded),
    addedAt: book.addedAt || new Date().toISOString()
  };
}

async function ensureDir() {
  await mkdir(booksDir, { recursive: true });
}

async function readCatalog(): Promise<Catalog> {
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<Catalog>;
    if (parsed.version === 1 && Array.isArray(parsed.books)) {
      const extras = parsed.books.filter(isBook).map(normalizeBook).filter((book) => !book.seeded);
      return { version: 1, books: extras };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read contractor landing books:", message);
    }
  }
  return { version: 1, books: [] };
}

async function writeCatalog(catalog: Catalog) {
  await ensureDir();
  const payload = `${JSON.stringify(catalog, null, 2)}\n`;
  const tempPath = `${catalogPath}.${process.pid}.tmp`;
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, catalogPath);
}

export async function listContractorBooks(): Promise<ContractorBook[]> {
  const catalog = await readCatalog();
  const bySpreadsheet = new Map<string, ContractorBook>();
  for (const book of DEFAULT_CONTRACTOR_BOOKS) {
    bySpreadsheet.set(book.spreadsheetId, book);
  }
  for (const book of catalog.books) {
    if (!bySpreadsheet.has(book.spreadsheetId)) {
      bySpreadsheet.set(book.spreadsheetId, book);
    }
  }
  return [...bySpreadsheet.values()];
}

export async function addContractorBook(input: {
  url: string;
  title?: string;
}): Promise<ContractorBook> {
  const spreadsheetId = parseContractorSpreadsheetId(input.url);
  if (!spreadsheetId) {
    throw new Error("Вставьте ссылку на Google Таблицу подрядчика");
  }

  return withLock(async () => {
    const existing = await listContractorBooks();
    const duplicate = existing.find((book) => book.spreadsheetId === spreadsheetId);
    if (duplicate) return duplicate;

    const catalog = await readCatalog();
    const book: ContractorBook = {
      id: generateId("book"),
      spreadsheetId,
      title: (input.title || "").trim() || "Таблица подрядчика",
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      seeded: false,
      addedAt: new Date().toISOString()
    };
    catalog.books.push(book);
    await writeCatalog(catalog);
    return book;
  });
}

export async function removeContractorBook(id: string): Promise<"missing" | "seeded" | "ok"> {
  if (DEFAULT_CONTRACTOR_BOOKS.some((book) => book.id === id)) return "seeded";
  return withLock(async () => {
    const catalog = await readCatalog();
    const book = catalog.books.find((item) => item.id === id);
    if (!book) return "missing";
    catalog.books = catalog.books.filter((item) => item.id !== id);
    await writeCatalog(catalog);
    return "ok";
  });
}
