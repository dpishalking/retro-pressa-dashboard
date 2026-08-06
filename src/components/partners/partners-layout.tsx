"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { PARTNER_SECTIONS } from "@/lib/partners/nav";
import { PARTNERS_PATH } from "@/lib/auth/routes";

type PartnersLayoutProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
};

export function PartnersLayout({ children, title, description }: PartnersLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <main className="mx-auto w-[min(1120px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-sm font-extrabold uppercase tracking-normal text-emerald-700">
              Партнёрская программа
            </p>
            <Link href={PARTNERS_PATH} className="text-2xl font-black text-slate-950 hover:text-emerald-700">
              Retro Pressa
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user ? <span className="text-sm font-semibold text-slate-600">{user.name}</span> : null}
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
        </div>

        <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {PARTNER_SECTIONS.map((section) => {
            const active =
              section.href === PARTNERS_PATH
                ? pathname === PARTNERS_PATH
                : pathname === section.href || pathname.startsWith(`${section.href}/`);
            return (
              <Link
                key={section.id}
                href={section.href}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {section.title}
              </Link>
            );
          })}
        </nav>

        {title ? (
          <div>
            <h1 className="text-3xl font-black text-slate-950 lg:text-4xl">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">{description}</p> : null}
          </div>
        ) : null}
      </header>
      {children}
    </main>
  );
}
