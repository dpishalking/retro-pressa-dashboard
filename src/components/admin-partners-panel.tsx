"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HUB_PATH } from "@/lib/auth/routes";
import { readJsonResponse } from "@/lib/api-response";
import { eur, pct } from "@/lib/format";
import type { PartnerPublicProfile, PartnerStatus } from "@/types/partners";

function statusLabel(status: PartnerStatus): string {
  switch (status) {
    case "pending":
      return "На модерации";
    case "active":
      return "Активен";
    case "suspended":
      return "Приостановлен";
    case "rejected":
      return "Отклонён";
  }
}

export function AdminPartnersPanel() {
  const [partners, setPartners] = useState<PartnerPublicProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{ id: string; message: string } | null>(null);

  const load = async () => {
    const response = await fetch("/api/admin/partners");
    const payload = await readJsonResponse<{ partners: PartnerPublicProfile[]; error?: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить партнёров");
    setPartners(payload.partners);
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"));
  }, []);

  const moderate = async (partnerId: string, status: PartnerStatus) => {
    setActionStatus({ id: partnerId, message: "Обновляю..." });
    try {
      const response = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, status })
      });
      const payload = await readJsonResponse<{ partner: PartnerPublicProfile; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось обновить");
      setPartners((prev) => prev.map((item) => (item.id === partnerId ? payload.partner : item)));
      setActionStatus({ id: partnerId, message: "Готово" });
    } catch (err) {
      setActionStatus({
        id: partnerId,
        message: err instanceof Error ? err.message : "Ошибка"
      });
    }
  };

  const saveCommission = async (partnerId: string, commissionRate: number) => {
    setActionStatus({ id: partnerId, message: "Сохраняю комиссию..." });
    try {
      const response = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, commissionRate })
      });
      const payload = await readJsonResponse<{ partner: PartnerPublicProfile; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось сохранить");
      setPartners((prev) => prev.map((item) => (item.id === partnerId ? payload.partner : item)));
      setActionStatus({ id: partnerId, message: "Комиссия сохранена" });
    } catch (err) {
      setActionStatus({
        id: partnerId,
        message: err instanceof Error ? err.message : "Ошибка"
      });
    }
  };

  return (
    <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
      <Link href={HUB_PATH} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600">
        <ArrowLeft size={16} />
        В кабинет
      </Link>
      <h1 className="text-3xl font-black text-slate-950">Партнёры</h1>
      <p className="mt-2 text-sm text-slate-600">Модерация заявок, комиссия и балансы.</p>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="card mt-6 p-4">
        <div className="table-scroll">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-2 font-semibold">Партнёр</th>
                <th className="px-2 py-2 font-semibold">Промокод</th>
                <th className="px-2 py-2 font-semibold">Статус</th>
                <th className="px-2 py-2 font-semibold">Комиссия</th>
                <th className="px-2 py-2 font-semibold">Оборот</th>
                <th className="px-2 py-2 font-semibold">Баланс</th>
                <th className="px-2 py-2 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} className="border-t border-[var(--line)] align-top">
                  <td className="px-2 py-3">
                    <p className="font-bold text-slate-900">{partner.name}</p>
                    <p className="text-xs text-slate-500">{partner.email}</p>
                    <p className="text-xs text-slate-500">{partner.phone}</p>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs font-semibold">{partner.promoCode}</td>
                  <td className="px-2 py-3">{statusLabel(partner.status)}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className="w-20 rounded-lg border border-[var(--line)] px-2 py-1"
                        defaultValue={Math.round(partner.commissionRate * 100)}
                        onBlur={(event) => {
                          const next = Number(event.target.value) / 100;
                          if (!Number.isFinite(next) || next === partner.commissionRate) return;
                          void saveCommission(partner.id, next);
                        }}
                      />
                      <span className="text-xs text-slate-500">% ({pct(partner.commissionRate)})</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">{eur(partner.salesTotal)}</td>
                  <td className="px-2 py-3 font-bold text-emerald-700">{eur(partner.available)}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {partner.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white"
                            onClick={() => void moderate(partner.id, "active")}
                          >
                            Одобрить
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700"
                            onClick={() => void moderate(partner.id, "rejected")}
                          >
                            Отклонить
                          </button>
                        </>
                      ) : null}
                      {partner.status === "active" ? (
                        <button
                          type="button"
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800"
                          onClick={() => void moderate(partner.id, "suspended")}
                        >
                          Приостановить
                        </button>
                      ) : null}
                      {partner.status === "suspended" || partner.status === "rejected" ? (
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white"
                          onClick={() => void moderate(partner.id, "active")}
                        >
                          Активировать
                        </button>
                      ) : null}
                    </div>
                    {actionStatus?.id === partner.id ? (
                      <p className="mt-2 text-xs text-slate-500">{actionStatus.message}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!partners.length ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-slate-500">
                    Партнёров пока нет.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
