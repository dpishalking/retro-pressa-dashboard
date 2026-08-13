/**
 * ALX contractor landing sheets — active landings for Marketing hub.
 * Source: https://docs.google.com/spreadsheets/d/1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM
 * Green / yellow tab colors = landings in work.
 */

export const ALX_LANDINGS_SPREADSHEET_ID = "1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM";
export const ART_LANDINGS_SPREADSHEET_ID = "1TW6WJFQGs-E1TUNLUYKDCULkHDLyagg8tZMCyx--yuA";

export type AlxLandingTag = "green" | "yellow";

export type AlxLandingDef = {
  id: string;
  /** Exact Google Sheet tab title */
  sheetTitle: string;
  gid: number;
  tag: AlxLandingTag;
  /** Site host shown as the card name */
  siteName: string;
  /** Landing path / address */
  address: string;
  /** Contractor workbook. Defaults to ALX when omitted. */
  spreadsheetId?: string;
  /** Short contractor label shown on cards: ALX, ART, … */
  sourceLabel?: string;
};

/** Active green/yellow landing tabs currently shown in Marketing. */
export const ALX_ACTIVE_LANDINGS: readonly AlxLandingDef[] = [
  {
    id: "ru",
    sheetTitle: "https://retro-pressa.com/ru/",
    gid: 249261530,
    tag: "green",
    siteName: "retro-pressa.com",
    address: "/ru/"
  },
  {
    id: "ru-new",
    sheetTitle: "https://retro-pressa.com/ru/new",
    gid: 803863448,
    tag: "green",
    siteName: "retro-pressa.com",
    address: "/ru/new"
  },
  {
    id: "life",
    sheetTitle: "https://retro-pressa.com/life",
    gid: 1925838060,
    tag: "green",
    siteName: "retro-pressa.com",
    address: "/life"
  },
  {
    id: "est-new",
    sheetTitle: "https://retro-pressa.com/est/new",
    gid: 1941311054,
    tag: "green",
    siteName: "retro-pressa.com",
    address: "/est/new"
  },
  {
    id: "pesnya",
    sheetTitle: "https://giftboost.website/pesnya",
    gid: 233042124,
    tag: "green",
    siteName: "giftboost.website",
    address: "/pesnya"
  },
  {
    id: "gift2man",
    sheetTitle: "https://familia-studio.com/gift2man",
    gid: 1921997261,
    tag: "green",
    siteName: "familia-studio.com",
    address: "/gift2man"
  },
  {
    id: "yourstory",
    sheetTitle: "https://yourstorymagazine.com/",
    gid: 809196650,
    tag: "green",
    siteName: "yourstorymagazine.com",
    address: "/"
  }
] as const;

export function getAlxLandingById(id: string): AlxLandingDef | null {
  return ALX_ACTIVE_LANDINGS.find((l) => l.id === id) ?? null;
}

/** Sheet title without protocol, same as СВОД/ALX tab name: retro-pressa.com/life */
export function alxLandingDisplayName(landing: Pick<AlxLandingDef, "sheetTitle">): string {
  return landing.sheetTitle.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function parseLandingSite(sheetTitle: string): { siteName: string; address: string } {
  const display = alxLandingDisplayName({ sheetTitle });
  const slash = display.indexOf("/");
  if (slash < 0) return { siteName: display || sheetTitle, address: "/" };
  return {
    siteName: display.slice(0, slash) || display,
    address: display.slice(slash) || "/"
  };
}
