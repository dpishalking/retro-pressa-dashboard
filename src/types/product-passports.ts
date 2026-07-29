export type PassportDashboardMeanings = {
  what_it_is?: string;
  for_whom?: string;
  client_pain?: string;
  key_idea?: string;
  why_now?: string;
  how_it_works?: string;
  benefits?: string;
  when_to_offer?: string;
  pitch_short?: string;
  pitch_one_paragraph?: string;
  role_in_line?: string;
  compare_with?: string;
  genres?: string;
  client_questions?: string;
};

export type PassportDashboardEconomy = {
  retail_price?: string;
  currency?: string;
  cost_price?: string;
  cogs_total?: string;
  cogs_margin_pct?: string;
  cogs_retail_model?: string;
};

export type PassportDashboardProduct = {
  productId: string;
  bitrixName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  meanings: PassportDashboardMeanings;
  economy: PassportDashboardEconomy;
  error?: string;
};

export type PassportDashboardSnapshot = {
  syncedAt: string;
  source: string;
  productCount: number;
  products: PassportDashboardProduct[];
};
