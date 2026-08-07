"use client";

import { useEffect, useState } from "react";
import { PartnersLayout } from "@/components/partners/partners-layout";
import { readJsonResponse } from "@/lib/api-response";
import { eur } from "@/lib/format";
import type { PartnerSale } from "@/types/partners";

function saleStatusLabel(status: PartnerSale["status"]): string {
  switch (status) {
    case "paid":
      return "Оплачено";
    case "pending":
      return "Ожидает оплаты";
    case "cancelled":
      return "Отменён";
    case "refunded":
      return "Возврат";
  }
}

export function PartnersSalesScreen() {
  const [sales, setSales] = useState<PartnerSale[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/partners/sales");
        const payload = await readJsonResponse<{ sales: PartnerSale[]; error?: string }>(response);
        if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить продажи");
        if (!cancelled) setSales(payload.sales);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PartnersLayout title="История продаж" description="Заказы, закреплённые за вашим промокодом или менеджером вручную.">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <section className="card p-4 md:p-6">
        <div className="table-scroll">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-2 font-semibold">Дата</th>
                <th className="px-2 py-2 font-semibold">Продукт</th>
                <th className="px-2 py-2 font-semibold">Стоимость</th>
                <th className="px-2 py-2 font-semibold">Статус</th>
                <th className="px-2 py-2 font-semibold">Комиссия</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-t border-[var(--line)]">
                  <td className="px-2 py-3">{sale.date}</td>
                  <td className="px-2 py-3 font-semibold">{sale.product}</td>
                  <td className="px-2 py-3">{eur(sale.amount)}</td>
                  <td className="px-2 py-3">{saleStatusLabel(sale.status)}</td>
                  <td className="px-2 py-3 font-bold text-emerald-700">{eur(sale.commission)}</td>
                </tr>
              ))}
              {!sales.length ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-slate-500">
                    Продаж пока нет.
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
