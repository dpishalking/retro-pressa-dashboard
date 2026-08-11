"use client";

export type AnalyticsOsSection =
  | "overview"
  | "revenue"
  | "marketing"
  | "funnel"
  | "managers"
  | "products"
  | "customers"
  | "unit-economics"
  | "production"
  | "countries"
  | "sources"
  | "quality";

type NavItem = {
  id: AnalyticsOsSection | "external" | "stub";
  label: string;
  enabled: boolean;
  href?: string;
  section?: AnalyticsOsSection;
};

type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Обзор",
    items: [{ id: "overview", label: "Главный экран", enabled: true, section: "overview" }]
  },
  {
    title: "Рост",
    items: [
      { id: "revenue", label: "Выручка", enabled: true, section: "revenue" },
      { id: "marketing", label: "Маркетинг", enabled: true, section: "marketing" },
      { id: "stub", label: "Креативы", enabled: false }
    ]
  },
  {
    title: "Продажи",
    items: [
      { id: "funnel", label: "Воронка", enabled: true, section: "funnel" },
      { id: "managers", label: "Менеджеры", enabled: true, section: "managers" },
      { id: "external", label: "Диалоги", enabled: true, href: "/rop/conversations" }
    ]
  },
  {
    title: "Продукты",
    items: [
      { id: "products", label: "Продукты", enabled: true, section: "products" },
      { id: "stub", label: "Допродажи", enabled: false }
    ]
  },
  {
    title: "Клиенты",
    items: [
      { id: "customers", label: "Клиенты", enabled: true, section: "customers" },
      { id: "external", label: "Когорты", enabled: true, href: "/os/cohorts" },
      { id: "stub", label: "Подарки", enabled: false }
    ]
  },
  {
    title: "Финансы",
    items: [
      { id: "unit-economics", label: "Юнит-экономика", enabled: true, section: "unit-economics" },
      { id: "external", label: "P&L", enabled: true, href: "/digital-twin" },
      { id: "stub", label: "Затраты", enabled: false }
    ]
  },
  {
    title: "Операции",
    items: [
      { id: "production", label: "Производство", enabled: true, section: "production" },
      { id: "stub", label: "Мощность", enabled: false },
      { id: "stub", label: "Качество", enabled: false }
    ]
  },
  {
    title: "Рынки",
    items: [{ id: "countries", label: "Страны", enabled: true, section: "countries" }]
  },
  {
    title: "AI",
    items: [
      { id: "stub", label: "Почему", enabled: false },
      { id: "stub", label: "Что делать", enabled: false },
      { id: "stub", label: "Что если", enabled: false },
      { id: "stub", label: "Возможности", enabled: false },
      { id: "stub", label: "×10", enabled: false }
    ]
  },
  {
    title: "Управление",
    items: [
      { id: "stub", label: "День", enabled: false },
      { id: "stub", label: "Неделя", enabled: false },
      { id: "stub", label: "Алерты", enabled: false }
    ]
  },
  {
    title: "Данные",
    items: [
      { id: "sources", label: "Источники", enabled: true, section: "sources" },
      { id: "quality", label: "Качество данных", enabled: true, section: "quality" },
      { id: "external", label: "Метрики", enabled: true, href: "/md" }
    ]
  }
];

export function AnalyticsOsSidebar({
  active,
  onNavigate
}: {
  active: AnalyticsOsSection;
  onNavigate: (section: AnalyticsOsSection) => void;
}) {
  return (
    <aside className="aos-sidebar">
      <div className="aos-sidebar__brand">
        <div className="aos-sidebar__eyebrow">Меню</div>
      </div>
      <nav className="aos-sidebar__nav">
        {NAV.map((group) => (
          <div key={group.title} className="aos-sidebar__group">
            <div className="aos-sidebar__group-title">{group.title}</div>
            <ul>
              {group.items.map((item, index) => {
                const key = `${group.title}-${item.label}-${index}`;
                if (!item.enabled) {
                  return (
                    <li key={key}>
                      <span className="aos-sidebar__link aos-sidebar__link--disabled">
                        {item.label}
                        <em>скоро</em>
                      </span>
                    </li>
                  );
                }
                if (item.href) {
                  return (
                    <li key={key}>
                      <a className="aos-sidebar__link" href={item.href}>
                        {item.label}
                      </a>
                    </li>
                  );
                }
                const section = item.section!;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`aos-sidebar__link ${active === section ? "is-active" : ""}`}
                      onClick={() => onNavigate(section)}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="aos-sidebar__footer">
        <a href="/analytics/legacy" className="aos-sidebar__legacy">
          Старый экран
        </a>
      </div>
    </aside>
  );
}
