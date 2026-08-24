const RIGA = "Europe/Riga";

export function rigaDateIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RIGA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function rigaYesterdayIso(now = new Date()): string {
  const today = rigaDateIso(now);
  const [year, month, day] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

export function messageDayIso(date: string | null | undefined): string | null {
  if (!date) return null;
  const iso = date.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1] ?? null;
  const ru = date.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  const parsed = Date.parse(date);
  if (!Number.isFinite(parsed)) return null;
  return rigaDateIso(new Date(parsed));
}

export function firstNameFrom(name: string | null | undefined): string {
  const token = (name || "").trim().split(/\s+/)[0];
  return token || "коллега";
}
