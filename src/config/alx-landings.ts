/**
 * ALX contractor landing sheets — active landings for Marketing hub.
 * Source: https://docs.google.com/spreadsheets/d/1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM
 * Green / yellow tab colors = landings in work.
 */

export const ALX_LANDINGS_SPREADSHEET_ID = "1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM";

export type AlxLandingTag = "green" | "yellow";

export type AlxLandingDef = {
  id: string;
  /** Exact Google Sheet tab title */
  sheetTitle: string;
  gid: number;
  tag: AlxLandingTag;
  /** Short UI title */
  title: string;
  /** Path / host for subtitle */
  url: string;
};

/** Active green/yellow landing tabs currently shown in Marketing. */
export const ALX_ACTIVE_LANDINGS: readonly AlxLandingDef[] = [
  {
    id: "ru",
    sheetTitle: "https://retro-pressa.com/ru/",
    gid: 249261530,
    tag: "green",
    title: "Главная RU",
    url: "retro-pressa.com/ru/"
  },
  {
    id: "ru-new",
    sheetTitle: "https://retro-pressa.com/ru/new",
    gid: 803863448,
    tag: "green",
    title: "RU /new",
    url: "retro-pressa.com/ru/new"
  },
  {
    id: "life",
    sheetTitle: "https://retro-pressa.com/life",
    gid: 1925838060,
    tag: "green",
    title: "Life",
    url: "retro-pressa.com/life"
  },
  {
    id: "est-new",
    sheetTitle: "https://retro-pressa.com/est/new",
    gid: 1941311054,
    tag: "green",
    title: "EST /new",
    url: "retro-pressa.com/est/new"
  },
  {
    id: "de-new",
    sheetTitle: "https://retro-pressa.com/de/new",
    gid: 1656463292,
    tag: "green",
    title: "DE /new",
    url: "retro-pressa.com/de/new"
  },
  {
    id: "es-new",
    sheetTitle: "https://retro-pressa.com/es/new ",
    gid: 1330707567,
    tag: "green",
    title: "ES /new",
    url: "retro-pressa.com/es/new"
  },
  {
    id: "pesnya",
    sheetTitle: "https://giftboost.website/pesnya",
    gid: 233042124,
    tag: "green",
    title: "Песня",
    url: "giftboost.website/pesnya"
  },
  {
    id: "gift2man",
    sheetTitle: "https://familia-studio.com/gift2man",
    gid: 1921997261,
    tag: "green",
    title: "Gift2Man",
    url: "familia-studio.com/gift2man"
  },
  {
    id: "yourstory",
    sheetTitle: "https://yourstorymagazine.com/",
    gid: 809196650,
    tag: "green",
    title: "Your Story Magazine",
    url: "yourstorymagazine.com"
  }
] as const;

export function getAlxLandingById(id: string): AlxLandingDef | null {
  return ALX_ACTIVE_LANDINGS.find((l) => l.id === id) ?? null;
}
