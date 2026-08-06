"use client";

import { FormEvent, useEffect, useState } from "react";
import { PartnersLayout } from "@/components/partners/partners-layout";
import { readJsonResponse } from "@/lib/api-response";
import type { PartnerMeResponse, PartnerPublicProfile } from "@/types/partners";

export function PartnersProfileScreen() {
  const [partner, setPartner] = useState<PartnerPublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>({
    state: "idle",
    message: ""
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/partners/me");
        const payload = await readJsonResponse<PartnerMeResponse & { error?: string }>(response);
        if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить профиль");
        if (!cancelled) setPartner(payload.partner);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!partner) return;
    setStatus({ state: "loading", message: "Сохраняю..." });
    try {
      const response = await fetch("/api/partners/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: partner.name,
          phone: partner.phone,
          country: partner.country,
          payoutMethod: partner.payoutMethod,
          payoutDetails: partner.payoutDetails
        })
      });
      const payload = await readJsonResponse<{ partner: PartnerPublicProfile; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось сохранить");
      setPartner(payload.partner);
      setStatus({ state: "ok", message: "Профиль сохранён" });
    } catch (err) {
      setStatus({ state: "error", message: err instanceof Error ? err.message : "Ошибка сохранения" });
    }
  };

  return (
    <PartnersLayout title="Профиль" description="Контакты и реквизиты для выплат.">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {partner ? (
        <form className="card max-w-xl space-y-4 p-6" onSubmit={onSubmit}>
          <Field label="Имя" value={partner.name} onChange={(value) => setPartner({ ...partner, name: value })} />
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-slate-50 px-4 py-3 text-sm"
              value={partner.email}
              readOnly
            />
          </label>
          <Field label="Телефон" value={partner.phone} onChange={(value) => setPartner({ ...partner, phone: value })} />
          <Field
            label="Страна"
            value={partner.country}
            onChange={(value) => setPartner({ ...partner, country: value })}
          />
          <Field
            label="Способ выплаты"
            value={partner.payoutMethod}
            onChange={(value) => setPartner({ ...partner, payoutMethod: value })}
          />
          <label className="block text-sm font-semibold text-slate-700">
            Реквизиты
            <textarea
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none ring-emerald-500 focus:ring-2"
              rows={3}
              value={partner.payoutDetails}
              onChange={(event) => setPartner({ ...partner, payoutDetails: event.target.value })}
            />
          </label>

          {status.state !== "idle" ? (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${
                status.state === "error"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : status.state === "ok"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {status.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={status.state === "loading"}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {status.state === "loading" ? "Сохраняю..." : "Сохранить"}
          </button>
        </form>
      ) : null}
    </PartnersLayout>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none ring-emerald-500 focus:ring-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
