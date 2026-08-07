"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Handshake } from "lucide-react";
import { readJsonResponse } from "@/lib/api-response";

export function PartnersRegisterScreen() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    password: ""
  });
  const [status, setStatus] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>({
    state: "idle",
    message: ""
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ state: "loading", message: "Отправляю заявку..." });
    try {
      const response = await fetch("/api/partners/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await readJsonResponse<{ message?: string; error?: string; login?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось зарегистрироваться");
      setStatus({
        state: "ok",
        message: payload.message ?? "Заявка отправлена. После одобрения войдите с вашим email."
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка регистрации"
      });
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-[min(560px,calc(100%-32px))] flex-col justify-center py-10">
      <div className="card p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <Handshake size={24} />
          </div>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-emerald-700">Retro Pressa</p>
            <h1 className="text-2xl font-black text-slate-950">Стать партнёром</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-slate-600">
          Оставьте заявку — после модерации вы получите персональный промокод и доступ в кабинет. Реферальных ссылок
          нет: комиссия начисляется только по промокоду.
        </p>

        {status.state === "ok" ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {status.message}
            </p>
            <Link href="/" className="inline-flex font-bold text-emerald-700 hover:underline">
              Перейти ко входу →
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            {(
              [
                ["name", "Имя", "text"],
                ["email", "Email (логин)", "email"],
                ["phone", "Телефон", "tel"],
                ["country", "Страна", "text"],
                ["password", "Пароль", "password"]
              ] as const
            ).map(([key, label, type]) => (
              <label key={key} className="block text-sm font-semibold text-slate-700">
                {label}
                <input
                  type={type}
                  required={key !== "country"}
                  minLength={key === "password" ? 8 : undefined}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none ring-emerald-500 focus:ring-2"
                  value={form[key]}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                />
              </label>
            ))}

            {status.state === "error" ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{status.message}</p>
            ) : null}

            <button
              type="submit"
              disabled={status.state === "loading"}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {status.state === "loading" ? "Отправляю..." : "Отправить заявку"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-slate-500">
          Уже есть доступ?{" "}
          <Link href="/" className="font-semibold text-emerald-700 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
