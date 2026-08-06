"use client";

import { useEffect, useState } from "react";
import { PartnersLayout } from "@/components/partners/partners-layout";
import { readJsonResponse } from "@/lib/api-response";
import { eur } from "@/lib/format";
import type { PartnerMeResponse, PartnerPayout } from "@/types/partners";

function payoutStatusLabel(status: PartnerPayout["status"]): string {
  switch (status) {
    case "paid":
      return "Выплачено";
    case "pending":
      return "Ожидает";
    case "processing":
      return "В обработке";
    case "failed":
      return "Ошибка";
  }
}

export function PartnersPayoutsScreen() {
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [available, setAvailable] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [payoutsRes, meRes] = await Promise.all([fetch("/api/partners/payouts"), fetch("/api/partners/me")]);
        const payoutsPayload = await readJsonResponse<{ payouts: PartnerPayout[]; error?: string }>(payoutsRes);
        const mePayload = await readJsonResponse<PartnerMeResponse & { error?: string }>(meRes);
        if (!payoutsRes.ok) throw new Error(payoutsPayload.error ?? "Не удалось загрузить выплаты");
        if (!cancelled) {
          setPayouts(payoutsPayload.payouts);
          if (meRes.ok) setAvailable(mePayload.partner.available);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PartnersLayout title="Выплаты" description="История переводов и сумма, доступная к выводу.">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="card mb-4 border-emerald-200 bg-emerald-50/50 p-5">
        <p className="text-sm font-semibold text-emerald-800">Доступно к выводу</p>
        <p className="mt-2 text-3xl font-black text-emerald-700">
          {available === null ? "—" : eur(available)}
        </p>
      </section>

      <section className="card p-4 md:p-6">
        <div className="table-scroll">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-2 font-semibold">Дата</th>
                <th className="px-2 py-2 font-semibold">Сумма</th>
                <th className="px-2 py-2 font-semibold">Статус</th>
                <th className="px-2 py-2 font-semibold">Способ выплаты</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-t border-[var(--line)]">
                  <td className="px-2 py-3">{payout.date}</td>
                  <td className="px-2 py-3 font-bold">{eur(payout.amount)}</td>
                  <td className="px-2 py-3">{payoutStatusLabel(payout.status)}</td>
                  <td className="px-2 py-3">{payout.method}</td>
                </tr>
              ))}
              {!payouts.length ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-slate-500">
                    Выплат пока нет.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PartnersLayout>
  );
}
