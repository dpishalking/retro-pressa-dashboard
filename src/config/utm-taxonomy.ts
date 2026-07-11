export type UtmField = "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term";

export type UtmPresetOption = {
  value: string;
  label: string;
  ga4Channel?: string;
  hint?: string;
};

export const utmBaseUrlPresets = [
  { value: "https://retro-pressa.com/", label: "Главная retro-pressa.com" },
  { value: "https://retro-pressa.com/lv", label: "Латвия /lv" },
  { value: "https://retro-pressa.com/ideas", label: "Идеи подарков /ideas" },
  { value: "https://retro-pressa.com/gifts", label: "Подарки /gifts" }
] as const;

export const utmSourcePresets: UtmPresetOption[] = [
  { value: "facebook", label: "Facebook", ga4Channel: "Paid Social" },
  { value: "instagram", label: "Instagram", ga4Channel: "Paid Social" },
  { value: "meta", label: "Meta (общий)", ga4Channel: "Paid Social" },
  { value: "google", label: "Google Ads", ga4Channel: "Paid Search" },
  { value: "push", label: "Push-уведомления", ga4Channel: "Mobile Push Notifications" },
  { value: "telegram", label: "Telegram", ga4Channel: "Organic Social" },
  { value: "email", label: "Email", ga4Channel: "Email" },
  { value: "blogger", label: "Блогер", ga4Channel: "Referral" },
  { value: "tiktok", label: "TikTok", ga4Channel: "Paid Social" }
];

export const utmMediumPresets: UtmPresetOption[] = [
  { value: "paid_social", label: "Платная соцсеть", ga4Channel: "Paid Social" },
  { value: "cpc", label: "Контекст / CPC", ga4Channel: "Paid Search" },
  { value: "mobile_push", label: "Mobile push", ga4Channel: "Mobile Push Notifications" },
  { value: "email", label: "Email-рассылка", ga4Channel: "Email" },
  { value: "organic_social", label: "Органика соцсетей", ga4Channel: "Organic Social" },
  { value: "referral", label: "Партнёр / блогер", ga4Channel: "Referral" },
  { value: "banner", label: "Баннер / Paid Other", ga4Channel: "Paid Other" }
];

export const utmMarketPresets = [
  { value: "lv", label: "Латвия" },
  { value: "lt", label: "Литва" },
  { value: "ee", label: "Эстония" },
  { value: "de", label: "Германия" },
  { value: "pl", label: "Польша" },
  { value: "eu", label: "Европа (общий)" }
] as const;

export type UtmTemplate = {
  id: string;
  label: string;
  baseUrl: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
};

export const utmQuickTemplates: UtmTemplate[] = [
  {
    id: "fb-lv-gift",
    label: "Facebook → Латвия → подарок",
    baseUrl: "https://retro-pressa.com/lv",
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: "2026_07_gift_lv",
    utm_content: "ad_01",
    utm_term: "lv"
  },
  {
    id: "fb-main-gift",
    label: "Facebook → главная → подарок",
    baseUrl: "https://retro-pressa.com/",
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: "2026_07_gift_main",
    utm_content: "ad_01"
  },
  {
    id: "push-lv",
    label: "Push → Латвия",
    baseUrl: "https://retro-pressa.com/lv",
    utm_source: "push",
    utm_medium: "mobile_push",
    utm_campaign: "2026_07_push_lv",
    utm_content: "notification_01",
    utm_term: "lv"
  },
  {
    id: "ig-ideas",
    label: "Instagram → идеи подарков",
    baseUrl: "https://retro-pressa.com/ideas",
    utm_source: "instagram",
    utm_medium: "paid_social",
    utm_campaign: "2026_07_ideas",
    utm_content: "story_01"
  }
];

export const utmRequiredFields: UtmField[] = ["utm_source", "utm_medium", "utm_campaign"];
