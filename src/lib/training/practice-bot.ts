export type PracticeBotScenario = {
  id: string;
  title: string;
  description: string;
  role: string;
  sortOrder: number;
  /** Параметр ?start= для Telegram-бота */
  telegramStartParam: string;
};

export const TRAINING_TELEGRAM_BOT = {
  username: "dushnila12_bot",
  url: "https://t.me/dushnila12_bot",
  displayName: "@dushnila12_bot"
} as const;

export function trainingTelegramBotUrl(startParam?: string): string {
  if (!startParam) return TRAINING_TELEGRAM_BOT.url;
  return `${TRAINING_TELEGRAM_BOT.url}?start=${encodeURIComponent(startParam)}`;
}

export const PRACTICE_BOT_SCENARIOS: PracticeBotScenario[] = [
  {
    id: "gift-mom",
    title: "Подарок маме на юбилей",
    description: "Клиент хочет что-то душевное, но не понимает, чем мы отличаемся от обычного магазина.",
    role: "Клиент ищет подарок близкому человеку",
    sortOrder: 1,
    telegramStartParam: "gift_mom"
  },
  {
    id: "price-objection",
    title: "«Дорого для газеты»",
    description: "Клиент сравнивает цену с «куском бумаги» и сомневается в ценности.",
    role: "Клиент с возражением по цене",
    sortOrder: 2,
    telegramStartParam: "price_objection"
  },
  {
    id: "deadline-rush",
    title: "Срочно к дате",
    description: "Праздник через две недели, клиент боится не успеть и просит гарантии.",
    role: "Клиент под давлением срока",
    sortOrder: 3,
    telegramStartParam: "deadline_rush"
  },
  {
    id: "crm-followup",
    title: "Клиент пропал после расчёта",
    description: "Нужно вернуть разговор мягко, не давить, но и не потерять сделку.",
    role: "Клиент «думает» после КП",
    sortOrder: 4,
    telegramStartParam: "crm_followup"
  }
];

export function getPracticeScenario(id: string) {
  return PRACTICE_BOT_SCENARIOS.find((item) => item.id === id) ?? null;
}
