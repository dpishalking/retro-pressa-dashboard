"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, Wallet } from "lucide-react";
import { PartnersLayout } from "@/components/partners/partners-layout";
import { CopyShareButtons } from "@/components/partners/copy-share-buttons";
import { QrDownloadButton } from "@/components/partners/qr-download-button";
import { readJsonResponse } from "@/lib/api-response";
import { eur, number, pct } from "@/lib/format";
import type { PartnerMeResponse, PartnerSale } from "@/types/partners";

const steps = [
  "Поделитесь своим промокодом",
  "Клиент оформляет заказ",
  "Заказ оплачивается",
  "Вы получаете комиссию"
];

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

export function PartnersHomeScreen() {
  const searchParams = useSearchParams();
  const denied = searchParams.get("denied") === "1";
  const [data, setData] = useState<PartnerMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/partners/me");
        const payload = await readJsonResponse<PartnerMeResponse & { error?: string }>(response);
        if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить кабинет");
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const partner = data?.partner;

  return (
    <PartnersLayout>
      <section className="card mb-5 p-6 md:p-8">
        <p className="text-sm font-extrabold uppercase tracking-normal text-emerald-700">Добро пожаловать</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
          {partner ? `Привет, ${partner.name.split(" ")[0]}` : "Кабинет партнёра"}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Делитесь нашими подарками, рекомендуйте Retro Pressa друзьям или клиентам и получайте комиссию с каждого
          оплаченного заказа.
        </p>
      </section>

      {denied ? (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          У вашего аккаунта нет доступа к этому разделу.
        </p>
      ) : null}

      {error ? (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="mb-5 grid gap-4 lg:grid-cols-2">
        <article className="card p-6">
          <p className="text-sm font-semibold text-slate-500">Мой промокод</p>
          <p className="mt-3 break-all font-mono text-3xl font-black tracking-wide text-slate-950 md:text-4xl">
            {partner?.promoCode ?? "—"}
          </p>
          {partner ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CopyShareButtons
                value={partner.promoCode}
                shareTitle="Промокод Retro Pressa"
                shareText={`Мой промокод Retro Pressa: ${partner.promoCode}`}
              />
              <QrDownloadButton value={partner.referralUrl} fileName={`${partner.referralSlug}-qr.png`} />
            </div>
          ) : null}
        </article>

        <article className="card p-6">
          <p className="text-sm font-semibold text-slate-500">Реферальная ссылка</p>
          <p className="mt-3 break-all text-lg font-bold text-slate-950">{partner?.referralUrl ?? "—"}</p>
          {partner ? (
            <div className="mt-4">
              <CopyShareButtons
                value={partner.referralUrl}
                openHref={partner.referralUrl}
                showOpen
                shareTitle="Retro Pressa"
                shareText="Персональные подарки Retro Pressa"
              />
            </div>
          ) : null}
        </article>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Переходов" value={partner ? number(partner.clicks) : "—"} />
        <Kpi label="Заявок" value={partner ? number(partner.leads) : "—"} />
        <Kpi label="Оплаченных заказов" value={partner ? number(partner.paidOrders) : "—"} />
        <Kpi label="Конверсия" value={data ? pct(data.conversion) : "—"} />
        <Kpi label="Общая сумма продаж" value={partner ? eur(partner.salesTotal) : "—"} />
        <Kpi label="Начисленная комиссия" value={partner ? eur(partner.accrued) : "—"} accent />
        <Kpi label="Выплачено" value={partner ? eur(partner.paidOut) : "—"} />
        <Kpi
          label="Доступно к выводу"
          value={partner ? eur(partner.available) : "—"}
          accent
          icon
        />
      </section>

      <section className="card mb-5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="text-emerald-600" size={20} />
          <h2 className="text-xl font-black text-slate-950">Последние продажи</h2>
        </div>
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
              {(data?.recentSales ?? []).map((sale) => (
                <tr key={sale.id} className="border-t border-[var(--line)]">
                  <td className="px-2 py-3">{sale.date}</td>
                  <td className="px-2 py-3 font-semibold text-slate-900">{sale.product}</td>
                  <td className="px-2 py-3">{eur(sale.amount)}</td>
                  <td className="px-2 py-3">{saleStatusLabel(sale.status)}</td>
                  <td className="px-2 py-3 font-bold text-emerald-700">{eur(sale.commission)}</td>
                </tr>
              ))}
              {!data?.recentSales?.length ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-slate-500">
                    Пока нет продаж — поделитесь промокодом.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-black text-slate-950">Как работает программа</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="relative rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Шаг {index + 1}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{step}</p>
              {index < steps.length - 1 ? (
                <ArrowDown className="absolute -bottom-3 left-1/2 hidden -translate-x-1/2 text-emerald-500 md:block" size={18} />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </PartnersLayout>
  );
}

function Kpi({
  label,
  value,
  accent,
  icon
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: boolean;
}) {
  return (
    <article className={`card p-4 ${accent ? "border-emerald-200 bg-emerald-50/40" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-emerald-700" : "text-slate-950"}`}>
        {icon ? (
          <span className="inline-flex items-center gap-2">
            <Wallet size={20} />
            {value}
          </span>
        ) : (
          value
        )}
      </p>
    </article>
  );
}
