/**
 * Country normalization for Traffic OS identity layer.
 * Bitrix lead country (UF_CRM_1737995147) stores enum IDs, not names.
 * Does not invent country when raw is empty or unmapped.
 */

/** Bitrix crm.lead.fields UF_CRM_1737995147 items (synced 2026-07-22). */
export const BITRIX_COUNTRY_ENUM: Record<string, string> = {
  "1214": "Литва",
  "1216": "Эстония",
  "1218": "Польша",
  "1220": "Германия",
  "1222": "Беларусь",
  "1224": "Россия",
  "1226": "Норвегия",
  "1228": "Швеция",
  "1230": "Чехия",
  "1232": "Грузия",
  "1234": "Молдова",
  "1236": "Швейцария",
  "1238": "Испания",
  "1240": "Мальта",
  "1242": "США",
  "1244": "Черногория",
  "1246": "Новая Зеландия",
  "1248": "Люксембург",
  "1402": "Латвия",
  "1404": "Казахстан",
  "1456": "Голландия",
  "1462": "Румыния",
  "1468": "Азербайджан",
  "1474": "Израиль",
  "1528": "Армения",
  "1534": "Англия",
  "1540": "Португалия",
  "1546": "Нидерланды",
  "1560": "Франция",
  "1566": "Бельгия",
  "1576": "Туркменистан",
  "1582": "Италия",
  "1588": "Остров Гернси",
  "1594": "Украина",
  "1600": "Ирландия",
  "1606": "Хорватия",
  "1612": "Турция",
  "1618": "Финляндия",
  "1624": "Исландия",
  "1632": "Болгария",
  "1638": "Словакия",
  "1644": "Сербия",
  "2418": "Словения",
  "2426": "Австрия",
  "2432": "ОАЭ",
  "2638": "Греция",
  "2646": "Венгрия",
  "2656": "Дания",
  "2664": "Северная Ирландия",
  "2672": "Шотландия",
  "2682": "Кипр",
  "2690": "Кыргызстан",
  "2698": "Узбекистан",
  "2706": "Китай",
  "2742": "Афганистан",
  "2764": "Тайланд",
  "2780": "Австралия"
};

const COUNTRY_MAP: Array<{ match: RegExp; code: string; name: string }> = [
  { match: /^(ru|rus|russia|россий|россия|russian\s*federation)$/i, code: "RU", name: "Russia" },
  { match: /^(lv|lat|latvia|латви)/i, code: "LV", name: "Latvia" },
  { match: /^(lt|ltu|lithuania|литв)/i, code: "LT", name: "Lithuania" },
  { match: /^(ee|est|estonia|эстон)/i, code: "EE", name: "Estonia" },
  { match: /^(de|deu|germany|deutschland|герман)/i, code: "DE", name: "Germany" },
  { match: /^(pl|pol|poland|польш)/i, code: "PL", name: "Poland" },
  { match: /^(es|esp|spain|испан)/i, code: "ES", name: "Spain" },
  { match: /^(by|blr|belarus|беларус|белорус)/i, code: "BY", name: "Belarus" },
  { match: /^(ua|ukr|ukraine|украин)/i, code: "UA", name: "Ukraine" },
  { match: /^(us|usa|united\s*states|america|сша)$/i, code: "US", name: "United States" },
  { match: /^(gb|uk|united\s*kingdom|england|britain|англи|великобритан)/i, code: "GB", name: "United Kingdom" },
  { match: /^(fi|fin|finland|финля)/i, code: "FI", name: "Finland" },
  { match: /^(se|swe|sweden|швец)/i, code: "SE", name: "Sweden" },
  { match: /^(cz|cze|czech|чехи)/i, code: "CZ", name: "Czechia" },
  { match: /^(il|isr|israel|израил)/i, code: "IL", name: "Israel" },
  { match: /^(kz|kaz|kazakhstan|казах)/i, code: "KZ", name: "Kazakhstan" },
  { match: /^(no|nor|norway|норвег)/i, code: "NO", name: "Norway" },
  { match: /^(ch|che|switzerland|швейцар)/i, code: "CH", name: "Switzerland" },
  { match: /^(md|mda|moldova|молдов)/i, code: "MD", name: "Moldova" },
  { match: /^(ge|geo|georgia|грузи)/i, code: "GE", name: "Georgia" },
  { match: /^(mt|mlt|malta|мальт)/i, code: "MT", name: "Malta" },
  { match: /^(me|mne|montenegro|черногор)/i, code: "ME", name: "Montenegro" },
  { match: /^(nz|nzl|new\s*zealand|новая\s*зеланди)/i, code: "NZ", name: "New Zealand" },
  { match: /^(lu|lux|luxembourg|люксембург)/i, code: "LU", name: "Luxembourg" },
  { match: /^(nl|nld|netherlands|holland|нидерланд|голланди)/i, code: "NL", name: "Netherlands" },
  { match: /^(ro|rou|romania|румын)/i, code: "RO", name: "Romania" },
  { match: /^(az|aze|azerbaijan|азербайджан)/i, code: "AZ", name: "Azerbaijan" },
  { match: /^(am|arm|armenia|армен)/i, code: "AM", name: "Armenia" },
  { match: /^(pt|prt|portugal|португал)/i, code: "PT", name: "Portugal" },
  { match: /^(fr|fra|france|франци)/i, code: "FR", name: "France" },
  { match: /^(be|bel|belgium|бельги)/i, code: "BE", name: "Belgium" },
  { match: /^(tm|tkm|turkmenistan|туркменистан)/i, code: "TM", name: "Turkmenistan" },
  { match: /^(it|ita|italy|итали)/i, code: "IT", name: "Italy" },
  { match: /^(gg|ggy|guernsey|гернси)/i, code: "GG", name: "Guernsey" },
  { match: /^(ie|irl|ireland|ирланди)/i, code: "IE", name: "Ireland" },
  { match: /^(hr|hrv|croatia|хорват)/i, code: "HR", name: "Croatia" },
  { match: /^(tr|tur|turkey|турци)/i, code: "TR", name: "Turkey" },
  { match: /^(is|isl|iceland|исланди)/i, code: "IS", name: "Iceland" },
  { match: /^(bg|bgr|bulgaria|болгар)/i, code: "BG", name: "Bulgaria" },
  { match: /^(sk|svk|slovakia|словаки)/i, code: "SK", name: "Slovakia" },
  { match: /^(rs|srb|serbia|серби)/i, code: "RS", name: "Serbia" },
  { match: /^(si|svn|slovenia|словени)/i, code: "SI", name: "Slovenia" },
  { match: /^(at|aut|austria|австри)/i, code: "AT", name: "Austria" },
  { match: /^(ae|are|uae|оаэ|объединенн)/i, code: "AE", name: "United Arab Emirates" },
  { match: /^(gr|grc|greece|греци)/i, code: "GR", name: "Greece" },
  { match: /^(hu|hun|hungary|венгри)/i, code: "HU", name: "Hungary" },
  { match: /^(dk|dnk|denmark|дани)/i, code: "DK", name: "Denmark" },
  { match: /^(северная\s*ирланди)/i, code: "GB", name: "United Kingdom" },
  { match: /^(scotland|шотланд)/i, code: "GB", name: "United Kingdom" },
  { match: /^(cy|cyp|cyprus|кипр)/i, code: "CY", name: "Cyprus" },
  { match: /^(kg|kgz|kyrgyz|кыргыз|киргиз)/i, code: "KG", name: "Kyrgyzstan" },
  { match: /^(uz|uzb|uzbekistan|узбекистан)/i, code: "UZ", name: "Uzbekistan" },
  { match: /^(cn|chn|china|китай)/i, code: "CN", name: "China" },
  { match: /^(af|afg|afghanistan|афганистан)/i, code: "AF", name: "Afghanistan" },
  { match: /^(th|tha|thailand|тайланд|таиланд)/i, code: "TH", name: "Thailand" },
  { match: /^(au|aus|australia|австрали)/i, code: "AU", name: "Australia" }
];

export function normalizeCountry(raw: string): { code: string; name: string; status: "ok" | "unknown" } {
  const text = String(raw || "").trim();
  if (!text) return { code: "", name: "", status: "unknown" };

  // Bitrix enum ID → label, then ISO
  if (/^\d+$/.test(text)) {
    const label = BITRIX_COUNTRY_ENUM[text];
    if (!label) return { code: "", name: "", status: "unknown" };
    return normalizeCountryLabel(label);
  }

  return normalizeCountryLabel(text);
}

function normalizeCountryLabel(text: string): { code: string; name: string; status: "ok" | "unknown" } {
  for (const row of COUNTRY_MAP) {
    if (row.match.test(text)) return { code: row.code, name: row.name, status: "ok" };
  }
  if (/^[A-Z]{2}$/.test(text.toUpperCase())) {
    return { code: text.toUpperCase(), name: text.toUpperCase(), status: "ok" };
  }
  return { code: "", name: "", status: "unknown" };
}

export function languageFromPath(path: string): string {
  const m = String(path || "").match(/^\/(ru|lv|lt|ee|est|de|es|en|pl|by)(\/|$)/i);
  if (!m) return "";
  const lang = m[1].toLowerCase();
  if (lang === "est") return "ee";
  return lang;
}

export function countryFromLanguageOrPath(path: string, domain: string): string {
  const lang = languageFromPath(path);
  const map: Record<string, string> = {
    lv: "LV",
    lt: "LT",
    ee: "EE",
    de: "DE",
    es: "ES",
    pl: "PL",
    by: "BY",
    ru: ""
  };
  if (lang && map[lang]) return map[lang];
  if (/\.lv$/i.test(domain)) return "LV";
  if (/\.lt$/i.test(domain)) return "LT";
  if (/\.ee$/i.test(domain)) return "EE";
  if (/\.de$/i.test(domain)) return "DE";
  return "";
}
