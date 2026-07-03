export const eur = (value: number, compact = false) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: compact ? 0 : 0
  }).format(value);

export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);

export const pct = (value: number) => `${number(value * 100, 1)}%`;

export const pp = (value: number) => `${value >= 0 ? "+" : ""}${number(value * 100, 1)} п.п.`;
