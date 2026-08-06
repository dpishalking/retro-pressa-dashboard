import { PARTNERS_PATH } from "@/lib/auth/routes";

export type PartnerSectionId =
  | "home"
  | "catalog"
  | "materials"
  | "sales"
  | "payouts"
  | "faq"
  | "profile";

export type PartnerSection = {
  id: PartnerSectionId;
  href: string;
  title: string;
};

export const PARTNER_SECTIONS: PartnerSection[] = [
  { id: "home", href: PARTNERS_PATH, title: "Главная" },
  { id: "catalog", href: `${PARTNERS_PATH}/catalog`, title: "Каталог" },
  { id: "materials", href: `${PARTNERS_PATH}/materials`, title: "Материалы" },
  { id: "sales", href: `${PARTNERS_PATH}/sales`, title: "Продажи" },
  { id: "payouts", href: `${PARTNERS_PATH}/payouts`, title: "Выплаты" },
  { id: "faq", href: `${PARTNERS_PATH}/faq`, title: "FAQ" },
  { id: "profile", href: `${PARTNERS_PATH}/profile`, title: "Профиль" }
];
