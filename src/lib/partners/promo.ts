const REFERRAL_BASE = "https://retro-pressa.com/r";

export function slugifyPartnerName(name: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya"
  };

  const lowered = name.trim().toLowerCase();
  let out = "";
  for (const char of lowered) {
    if (map[char] !== undefined) {
      out += map[char];
    } else if (/[a-z0-9]/.test(char)) {
      out += char;
    } else if (/\s|-|_/.test(char)) {
      out += "-";
    }
  }

  return out
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "partner";
}

export function promoCodeFromSlug(slug: string): string {
  return `RETRO-${slug.toUpperCase().replace(/-/g, "-")}`;
}

export function referralUrlFromSlug(slug: string): string {
  return `${REFERRAL_BASE}/${slug}`;
}

export function normalizePromoCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
