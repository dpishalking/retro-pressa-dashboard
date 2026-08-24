const TRANSLIT_FIRST: Record<string, string> = {
  anastasija: "анастасия",
  anastasia: "анастасия",
  jelena: "елена",
  elena: "елена",
  nadezhda: "надежда",
  darija: "дарья",
  darya: "дарья",
  kristina: "кристина",
  kira: "кира",
  maria: "мария",
  marija: "мария"
};

export function normalizePersonName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
}

function firstToken(name: string): string {
  const first = normalizePersonName(name).split(" ")[0] || "";
  return TRANSLIT_FIRST[first] || first;
}

export function namesMatch(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const fa = firstToken(a);
  const fb = firstToken(b);
  return fa.length >= 3 && fa === fb;
}

export function matchUniqueByName<T extends { name: string; firstName?: string }>(
  name: string,
  rows: T[]
): T | null {
  const hits = rows.filter(
    (row) => namesMatch(name, row.name) || (row.firstName ? namesMatch(name, row.firstName) : false)
  );
  if (hits.length === 1) return hits[0]!;
  return null;
}
