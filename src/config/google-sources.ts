export type GoogleSourceType = "facebookTraffic" | "traffic" | "finance" | "quality" | "markets" | "managers";

export type GoogleSheetSource = {
  id: string;
  title: string;
  type: GoogleSourceType;
  spreadsheetId: string;
  leadKind?: "paid" | "organic";
  gid?: string;
  sheetName?: string;
};

export function spreadsheetIdFromUrl(value?: string) {
  if (!value) return "";

  const match = value.match(/\/spreadsheets\/d\/([^/]+)/);
  if (match?.[1]) return match[1];

  return value.includes("/") ? "" : value.trim();
}

export function gidFromUrl(value?: string) {
  if (!value) return undefined;

  const hashMatch = value.match(/[#&?]gid=([^&#]+)/);
  return hashMatch?.[1];
}

const trafficSpreadsheetId =
  process.env.GOOGLE_TRAFFIC_SHEET_ID ||
  process.env.GOOGLE_SHEET_ID ||
  spreadsheetIdFromUrl(process.env.GOOGLE_TRAFFIC_CSV_URL);

const configuredSources = [
  {
    id: "facebook-contractors-summary",
    title: "Facebook · сводная подрядчиков",
    type: "facebookTraffic",
    leadKind: "paid",
    spreadsheetId: "1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M",
    gid: "1377612304"
  },
  {
    id: "organic-summary",
    title: "Органика · сводная",
    type: "traffic",
    leadKind: "organic",
    spreadsheetId: "1nItFm1eqBMVBJF1ZSBuBKZX-g03wx5v60l7h7Pqey4M",
    gid: "249261530"
  },
  {
    id: "facebook-contractor-alx",
    title: "Facebook · подрядчик ALX",
    type: "traffic",
    leadKind: "paid",
    spreadsheetId: "1Hh6U4udZXp69RVKMIF29RBHjKef5JxEbLHdmLZYIAIM",
    gid: "1464918646"
  },
  {
    id: "facebook-contractor-art",
    title: "Facebook · подрядчик ART",
    type: "traffic",
    leadKind: "paid",
    spreadsheetId: "1TW6WJFQGs-E1TUNLUYKDCULkHDLyagg8tZMCyx--yuA",
    gid: "1464918646"
  },
  {
    id: "traffic-env",
    title: "Резервный трафик из ENV",
    type: "traffic",
    leadKind: "paid",
    spreadsheetId: trafficSpreadsheetId,
    gid: gidFromUrl(process.env.GOOGLE_TRAFFIC_CSV_URL),
    sheetName: process.env.GOOGLE_TRAFFIC_SHEET_NAME || undefined
  }
] satisfies GoogleSheetSource[];

export const googleSources = configuredSources.filter((source) => Boolean(source.spreadsheetId));
