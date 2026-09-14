const MOSCOW = "Europe/Moscow";

export function moscowDateIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function moscowHm(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
}

export function moscowMinutesNow(now = new Date()): number {
  const [hour, minute] = moscowHm(now).split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

export function isShiftLiveCut(day: string, now = new Date()): boolean {
  return moscowMinutesNow(now) < 20 * 60 && day === moscowDateIso(now);
}
