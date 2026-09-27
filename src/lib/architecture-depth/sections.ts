export const ARCHITECTURE_PAGE_URL = "https://giftboost.website/architecture/";
export const ARCHITECTURE_HOST = "giftboost.website";
export const ARCHITECTURE_PATH = "/architecture";
export const ARCHITECTURE_HYPOTHESIS_MIN_USERS = 30;

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

export type ArchitectureSectionId = (typeof ARCHITECTURE_SECTIONS)[number]["id"];

export type SectionFunnelRow = {
  id: ArchitectureSectionId;
  index: number;
  title: string;
  users: number;
  shareOfHero: number | null;
  dropFromPrevious: number | null;
};

export function buildSectionFunnel(counts: Partial<Record<ArchitectureSectionId, number>>): SectionFunnelRow[] {
  return ARCHITECTURE_SECTIONS.map((section, position) => {
    const users = Math.max(0, Math.round(counts[section.id] ?? 0));
    const hero = Math.max(0, Math.round(counts.hero ?? 0));
    const previousId = position > 0 ? ARCHITECTURE_SECTIONS[position - 1]!.id : null;
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
