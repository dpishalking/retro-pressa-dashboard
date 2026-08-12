/** Sheet formula builders for Predictive Sheets (USER_ENTERED). */

export function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** Settings cell refs (91_SETTINGS layout). */
export const SETTINGS_REFS = {
  selectedPeriod: "B2",
  periodLabel: "B3",
  periodStart: "B4",
  periodEnd: "B5",
  currentDate: "B6",
  currentWeek: "B7",
  elapsedDays: "B8",
  remainingDays: "B9",
  totalDays: "B10",
  currency: "B11",
  greenThreshold: "B12",
  yellowThreshold: "B13",
  useLinearWeekly: "B14",
  useWorkingDays: "B15",
  lastUpdated: "B16",
  staleHours: "B17",
  linearFallbackNote: "B18",
  w1Share: "F23",
  w2Share: "F24",
  w3Share: "F25",
  w4Share: "F26",
  w5Share: "F27"
} as const;

export function settingsRef(key: keyof typeof SETTINGS_REFS, settingsTab: string): string {
  return `${quoteTab(settingsTab)}!${SETTINGS_REFS[key]}`;
}

/**
 * Plan To Date:
 * - if weekly plans sum > 0 for elapsed weeks → use that (not auto-built here)
 * - else if linear allowed → Plan * elapsed/total
 * - else blank
 */
/** Weekly plan: additive = month plan × (days in Monday-week / days in month). Rates copy month target. */
export function formulaWeeklyPlan(opts: {
  planCell: string;
  week1to5: number;
  kind: "additive" | "rate";
  settingsTab: string;
}): string {
  const linear = settingsRef("useLinearWeekly", opts.settingsTab);
  const shareKey = (`w${opts.week1to5}Share` as keyof typeof SETTINGS_REFS);
  const share = settingsRef(shareKey, opts.settingsTab);
  if (opts.kind === "rate") {
    return `""`;
  }
  return `IF(OR(${opts.planCell}="",${linear}=FALSE),"",${opts.planCell}*${share})`;
}

export function formulaPlanToDate(opts: {
  planCell: string;
  settingsTab: string;
}): string {
  const elapsed = settingsRef("elapsedDays", opts.settingsTab);
  const total = settingsRef("totalDays", opts.settingsTab);
  const linear = settingsRef("useLinearWeekly", opts.settingsTab);
  return [
    `IF(${opts.planCell}="","",`,
    `IF(OR(${elapsed}<=0,${total}<=0),"",`,
    `IF(${linear}=TRUE,${opts.planCell}*${elapsed}/${total},`,
    `IF(${linear}=FALSE,${opts.planCell}*${elapsed}/${total},""))))`
  ].join("");
}

/** Even with Use Linear Weekly = FALSE we still need Plan To Date for MTD fairness;
 * weekly distribution stays empty; Plan To Date uses LINEAR FALLBACK always when plan exists.
 * Marked via Settings note. */

export function formulaForecastEom(opts: {
  factCell: string;
  planCell: string;
  kind: "additive" | "rate";
  settingsTab: string;
}): string {
  const elapsed = settingsRef("elapsedDays", opts.settingsTab);
  const total = settingsRef("totalDays", opts.settingsTab);
  if (opts.kind === "rate") {
    return `IF(${opts.factCell}="","",${opts.factCell})`;
  }
  return `IF(OR(${opts.factCell}="",${elapsed}<=0),"",${opts.factCell}/${elapsed}*${total})`;
}

export function formulaGap(opts: {
  forecastCell: string;
  planCell: string;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "TARGET_RANGE";
}): string {
  if (opts.direction === "LOWER_IS_BETTER") {
    // Positive gap = better (forecast below plan)
    return `IF(OR(${opts.forecastCell}="",${opts.planCell}=""),"",${opts.planCell}-${opts.forecastCell})`;
  }
  return `IF(OR(${opts.forecastCell}="",${opts.planCell}=""),"",${opts.forecastCell}-${opts.planCell})`;
}

export function formulaRequiredPace(opts: {
  planCell: string;
  factCell: string;
  kind: "additive" | "rate";
  settingsTab: string;
}): string {
  if (opts.kind === "rate") return `""`;
  const remaining = settingsRef("remainingDays", opts.settingsTab);
  const elapsed = settingsRef("elapsedDays", opts.settingsTab);
  // Avoid LET for locale safety: show "req_per_day / день · mult×"
  return [
    `IF(OR(${opts.planCell}="",${opts.factCell}="",${remaining}<=0),"",`,
    `TEXT(MAX(${opts.planCell}-${opts.factCell},0)/${remaining},"0.0")&" / день"&`,
    `IF(OR(${elapsed}<=0,${opts.factCell}=0),"",`,
    `" · "&TEXT((MAX(${opts.planCell}-${opts.factCell},0)/${remaining})/(${opts.factCell}/${elapsed}),"0.0")&"×"))`
  ].join("");
}

export function formulaPtf(opts: {
  factCell: string;
  planCell: string;
}): string {
  return `IF(OR(${opts.factCell}="",${opts.planCell}="",${opts.planCell}=0),"",${opts.factCell}/${opts.planCell}-1)`;
}

export function formulaStatus(opts: {
  factCell: string;
  planToDateCell: string;
  planCell: string;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "TARGET_RANGE";
  settingsTab: string;
}): string {
  const green = settingsRef("greenThreshold", opts.settingsTab);
  const yellow = settingsRef("yellowThreshold", opts.settingsTab);
  const fact = opts.factCell;
  const ptd = opts.planToDateCell;
  const plan = opts.planCell;

  if (opts.direction === "LOWER_IS_BETTER") {
    return [
      `IF(${plan}="","● Нет плана",`,
      `IF(${fact}="","● Нет данных",`,
      `IF(OR(${ptd}="",${ptd}=0),"● Нет данных",`,
      `IF(${ptd}/${fact}>=${green},"● В норме",`,
      `IF(${ptd}/${fact}>=${yellow},"● Риск","● Срыв")))))`
    ].join("");
  }

  return [
    `IF(${plan}="","● Нет плана",`,
    `IF(${fact}="","● Нет данных",`,
    `IF(OR(${ptd}="",${ptd}=0),"● Нет данных",`,
    `IF(${fact}/${ptd}>=${green},"● В норме",`,
    `IF(${fact}/${ptd}>=${yellow},"● Риск","● Срыв")))))`
  ].join("");
}

export function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Google Sheets ru_RU uses `;` as argument separator.
 * Convert US-style formula args without touching string literals.
 */
export function localizeFormulaArgs(formula: string, locale: "ru_RU" | "en_US" = "ru_RU"): string {
  if (locale !== "ru_RU") return formula;
  let out = "";
  let inString = false;
  for (let i = 0; i < formula.length; i += 1) {
    const ch = formula[i];
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (!inString && ch === ",") {
      out += ";";
      continue;
    }
    out += ch;
  }
  return out;
}

export function sheetFormula(body: string, locale: "ru_RU" | "en_US" = "ru_RU"): string {
  const normalized = body.startsWith("=") ? body.slice(1) : body;
  return `=${localizeFormulaArgs(normalized, locale)}`;
}
