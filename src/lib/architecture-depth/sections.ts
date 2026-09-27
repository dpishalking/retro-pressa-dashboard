export const ARCHITECTURE_PAGE_URL = "https://giftboost.website/architecture/";
export const ARCHITECTURE_HOST = "giftboost.website";
export const ARCHITECTURE_PATH = "/architecture";
export const ARCHITECTURE_HYPOTHESIS_MIN_USERS = 30;

export type LandingSectionDef = {
  id: string;
  index: number;
  title: string;
};

export type LandingDepthDef = {
  id: string;
  kicker: string;
  pageUrl: string;
  host: string;
  path: string;
  minUsers: number;
  sections: readonly LandingSectionDef[];
};

function landing(
  id: string,
  kicker: string,
  path: string,
  titles: Array<[string, string]>,
  host = ARCHITECTURE_HOST
): LandingDepthDef {
  return {
    id,
    kicker,
    pageUrl: `https://${host}${path}/`,
    host,
    path,
    minUsers: ARCHITECTURE_HYPOTHESIS_MIN_USERS,
    sections: titles.map(([sectionId, title], index) => ({
      id: sectionId,
      index: index + 1,
      title
    }))
  };
}

export const ARCHITECTURE_SECTIONS = [
  { id: "hero", index: 1, title: "Первый экран" },
  { id: "problem", index: 2, title: "Не попали" },
  { id: "cannot_buy", index: 3, title: "Не купит себе сам" },
  { id: "who_we_are", index: 4, title: "Кто мы и подарки" },
  { id: "no_idea", index: 5, title: "Не нужна готовая идея" },
  { id: "architect", index: 6, title: "Архитектор" },
  { id: "free_session", index: 7, title: "Бесплатная встреча" },
  { id: "discount", index: 8, title: "Скидка 5%" },
  { id: "objections", index: 9, title: "Возражения" },
  { id: "application", index: 10, title: "Форма заявки" }
] as const;

export const LANDING_DEPTH: Record<string, LandingDepthDef> = {
  architecture: {
    id: "architecture",
    kicker: "Лендинг архитектуры",
    pageUrl: ARCHITECTURE_PAGE_URL,
    host: ARCHITECTURE_HOST,
    path: ARCHITECTURE_PATH,
    minUsers: ARCHITECTURE_HYPOTHESIS_MIN_USERS,
    sections: ARCHITECTURE_SECTIONS
  },
  letter: landing("letter", "Письмо", "/letter", [
    ["hero", "Первый экран"],
    ["chat", "Письмо вместо чата"],
    ["kit", "Что получат близкие"],
    ["scenario", "Когда начать"],
    ["how", "Как это работает"],
    ["included", "Что входит"],
    ["delivery", "Отправка"],
    ["approval", "Сначала макет"],
    ["safety", "Данные малыша"],
    ["order", "Форма заявки"],
    ["faq", "Вопросы"],
    ["close", "Финальный призыв"]
  ]),
  lifehistory: landing("lifehistory", "Книга жизни", "/lifehistory", [
    ["hero", "Первый экран"],
    ["proof", "Интервью и архив"],
    ["unknown", "Что вы знаете о старших"],
    ["before_mom", "До того как стала мамой"],
    ["how", "Просто разговор"],
    ["alive", "Не анкета, живой человек"],
    ["ordinary", "Обычных жизней нет"],
    ["photos", "Фото без историй"],
    ["voice", "Голос в архиве"],
    ["result", "Книга и архив"],
    ["map", "Карта жизни"],
    ["quotes", "После разговора"],
    ["for_whom", "Кому подарить"],
    ["occasion", "Повод"],
    ["privacy", "История остаётся вашей"],
    ["human", "Интервьюер, не AI"],
    ["taken_care", "Берём на себя"],
    ["example", "Пример книги"],
    ["pricing", "Стоимость"],
    ["faq", "Вопросы"],
    ["order", "Заявка"]
  ]),
  pesnya: landing("pesnya", "Песня", "/pesnya", [
    ["hero", "Первый экран"],
    ["sample", "Примеры песен"],
    ["path", "Четыре шага"],
    ["recognize", "Узнает себя"],
    ["handoff", "Как вручить"],
    ["emotion", "Что слышит получатель"],
    ["reviews", "Отзывы"],
    ["pricing", "Стоимость"],
    ["complements", "Дополнить подарок"],
    ["order", "Заявка"],
    ["faq", "Вопросы"]
  ]),
  gift2man: landing("gift2man", "Журнал о мужчине", "/gift2man", [
    ["hero", "Первый экран"],
    ["reaction", "Реакция на подарок"],
    ["pain", "Боюсь не угадать"],
    ["tailored", "Журнал под него"],
    ["relic", "Признание в любви"],
    ["comparison", "Чем отличается"],
    ["editorial", "Редакция рядом"],
    ["personality", "Он узнает себя"],
    ["motion", "Оживающие фото"],
    ["process", "Как создаётся"],
    ["materials", "Сбор материалов"],
    ["pricing", "Цена за страницу"],
    ["faq", "Вопросы"],
    ["cases", "Первая полоса"],
    ["order", "Дата вручения"]
  ], "familia-studio.com")
};

export function getLandingDepth(id: string): LandingDepthDef | null {
  return LANDING_DEPTH[id] ?? null;
}

export type ArchitectureSectionId = (typeof ARCHITECTURE_SECTIONS)[number]["id"];

export type SectionFunnelRow = {
  id: string;
  index: number;
  title: string;
  users: number;
  shareOfHero: number | null;
  dropFromPrevious: number | null;
};

export function buildLandingFunnel(
  sections: readonly LandingSectionDef[],
  counts: Partial<Record<string, number>>
): SectionFunnelRow[] {
  const heroId = sections[0]?.id ?? "hero";
  return sections.map((section, position) => {
    const users = Math.max(0, Math.round(counts[section.id] ?? 0));
    const hero = Math.max(0, Math.round(counts[heroId] ?? 0));
    const previousId = position > 0 ? sections[position - 1]!.id : null;
    const previous = previousId ? Math.max(0, Math.round(counts[previousId] ?? 0)) : 0;
    return {
      id: section.id,
      index: section.index,
      title: section.title,
      users,
      shareOfHero: hero > 0 ? users / hero : null,
      dropFromPrevious: previous > 0 ? 1 - users / previous : null
    };
  });
}

export function buildSectionFunnel(counts: Partial<Record<ArchitectureSectionId, number>>): SectionFunnelRow[] {
  return buildLandingFunnel(ARCHITECTURE_SECTIONS, counts);
}
