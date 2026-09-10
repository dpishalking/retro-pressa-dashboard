"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { GraduationCap } from "lucide-react";
import { readJsonResponse } from "@/lib/api-response";

export function ManagerRegisterScreen() {
  const [form, setForm] = useState({
    name: "",
    login: "",
    password: "",
    passwordConfirm: ""
  });
  const [status, setStatus] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>({
    state: "idle",
    message: ""
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.passwordConfirm) {
      setStatus({ state: "error", message: "Пароли не совпадают" });
      return;
    }

    setStatus({ state: "loading", message: "Отправляю заявку..." });
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          login: form.login,
          password: form.password
        })
      });
      const payload = await readJsonResponse<{ message?: string; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "Не удалось зарегистрироваться");
      setStatus({
        state: "ok",
        message: payload.message ?? "Заявка отправлена. Когда РОП одобрит регистрацию, вы сможете войти."
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Ошибка регистрации"
      });
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-[min(480px,calc(100%-32px))] flex-col justify-center py-10">
      <div className="card p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-violet-600">Retro Pressa</p>
            <h1 className="text-2xl font-black text-slate-950">Регистрация</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-slate-600">
          Привет! Чтобы получить доступ к обучению и базе знаний — пройдите простую регистрацию :)
        </p>
        <p className="mb-6 text-sm leading-6 text-slate-500">
          Почта не нужна: достаточно имени, логина и пароля. Доступ откроется после одобрения РОПа.
        </p>

        {status.state === "ok" ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {status.message}
            </p>
            <Link href="/" className="inline-flex font-bold text-violet-700 hover:underline">
              Перейти ко входу →
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm font-semibold text-slate-700">
              Имя
              <input
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-violet-500 focus:ring-2"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                autoComplete="name"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Логин
              <input
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-violet-500 focus:ring-2"
                value={form.login}
                onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))}
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Пароль
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-violet-500 focus:ring-2"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Повторите пароль
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-violet-500 focus:ring-2"
                value={form.passwordConfirm}
                onChange={(event) => setForm((prev) => ({ ...prev, passwordConfirm: event.target.value }))}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>

            {status.state === "error" ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{status.message}</p>
            ) : null}

            <button
              type="submit"
              disabled={status.state === "loading"}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {status.state === "loading" ? "Отправляю..." : "Зарегистрироваться"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-slate-500">
          Уже есть доступ?{" "}
          <Link href="/" className="font-semibold text-violet-700 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
