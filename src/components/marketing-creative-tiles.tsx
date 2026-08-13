"use client";

import { useState } from "react";
import { MARKETING_CREATIVE_OFFERS } from "@/lib/marketing/creative-offers";

export function MarketingCreativeTiles() {
  const [openId, setOpenId] = useState<string | null>(MARKETING_CREATIVE_OFFERS[0]?.id ?? null);

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">Креативы и офферы</h2>
        <p className="mt-1 text-sm text-slate-600">
          Работа, которую закрывает каждый оффер. Нажмите плитку — внутри jobs to be done.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MARKETING_CREATIVE_OFFERS.map((offer) => {
          const open = offer.id === openId;
          return (
            <article
              key={offer.id}
              className={`rounded-xl border bg-white p-4 transition ${
                open ? "border-blue-300 shadow-sm" : "border-[var(--line)] hover:border-slate-300"
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setOpenId(open ? null : offer.id)}
                aria-expanded={open}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{offer.stage}</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{offer.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{offer.job}</p>
              </button>
              {open ? (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Jobs</p>
                  <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
                    {offer.jobs.map((job) => (
                      <li key={job}>{job}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Для кого</p>
                  <p className="mt-1 text-sm text-slate-700">{offer.audience}</p>
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-900">
                    {offer.talk}
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
