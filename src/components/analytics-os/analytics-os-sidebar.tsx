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
    title: "Overview",
    items: [{ id: "overview", label: "CEO Control Center", enabled: true, section: "overview" }]
  },
  {
    title: "Growth",
    items: [
      { id: "revenue", label: "Revenue Tree", enabled: true, section: "revenue" },
      { id: "marketing", label: "Marketing", enabled: true, section: "marketing" },
      { id: "stub", label: "Creatives", enabled: false }
    ]
  },
  {
    title: "Sales",
    items: [
      { id: "funnel", label: "Funnel", enabled: true, section: "funnel" },
      { id: "managers", label: "Managers", enabled: true, section: "managers" },
      { id: "external", label: "Conversations", enabled: true, href: "/rop/conversations" }
    ]
  },
  {
    title: "Products",
    items: [
      { id: "products", label: "Product Analytics", enabled: true, section: "products" },
      { id: "stub", label: "Cross-sell", enabled: false }
    ]
  },
  {
    title: "Customers",
    items: [
      { id: "customers", label: "Customers", enabled: true, section: "customers" },
      { id: "stub", label: "Cohorts", enabled: false },
      { id: "stub", label: "Gift Graph", enabled: false }
    ]
  },
  {
    title: "Finance",
    items: [
      { id: "unit-economics", label: "Unit Economics", enabled: true, section: "unit-economics" },
      { id: "external", label: "P&L", enabled: true, href: "/digital-twin" },
      { id: "stub", label: "Costs", enabled: false }
    ]
  },
  {
    title: "Operations",
    items: [
      { id: "production", label: "Production", enabled: true, section: "production" },
      { id: "stub", label: "Capacity", enabled: false },
      { id: "stub", label: "Quality", enabled: false }
    ]
  },
  {
    title: "Markets",
    items: [{ id: "countries", label: "Countries", enabled: true, section: "countries" }]
  },
  {
    title: "AI Analyst",
    items: [
      { id: "stub", label: "Why", enabled: false },
      { id: "stub", label: "What To Do", enabled: false },
      { id: "stub", label: "What If", enabled: false },
      { id: "stub", label: "Opportunities", enabled: false },
      { id: "stub", label: "Scale Simulator", enabled: false }
    ]
  },
  {
    title: "Management",
    items: [
      { id: "stub", label: "Daily Brief", enabled: false },
      { id: "stub", label: "Weekly Review", enabled: false },
      { id: "stub", label: "Alerts", enabled: false }
    ]
  },
  {
    title: "Data",
    items: [
      { id: "sources", label: "Sources", enabled: true, section: "sources" },
      { id: "quality", label: "Data Quality", enabled: true, section: "quality" },
      { id: "external", label: "Metric Definitions", enabled: true, href: "/md" }
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
        <div className="aos-sidebar__eyebrow">Navigation</div>
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
                        <em>soon</em>
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
          Legacy dashboard
        </a>
      </div>
    </aside>
  );
}
