"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TrainingProvider, UserSwitcher } from "@/components/training/training-context";

type TrainingLayoutProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
};

export function TrainingLayout({
  children,
  title,
  description,
  backHref = "/training",
  backLabel = "К обучению",
  actions
}: TrainingLayoutProps) {
  return (
    <TrainingProvider>
      <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href={backHref}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600"
            >
              <ArrowLeft size={16} />
              {backLabel}
            </Link>
            {title ? (
              <>
                <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-rose-600">Обучение менеджеров</p>
                <h1 className="text-3xl font-black text-slate-950 lg:text-4xl">{title}</h1>
                {description ? <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description}</p> : null}
              </>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <UserSwitcher />
            {actions}
          </div>
        </div>
        {children}
      </main>
    </TrainingProvider>
  );
}
