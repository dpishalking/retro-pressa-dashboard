"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { HUB_PATH } from "@/lib/auth/routes";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const denied = searchParams.get("denied") === "1";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Не удалось войти");
        return;
      }

      await refresh();
      const next = searchParams.get("next");
      const fallback = next && next.startsWith("/") && next !== "/" ? next : HUB_PATH;
      router.replace(fallback);
      router.refresh();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-[min(480px,calc(100%-32px))] flex-col justify-center py-10">
      <div className="card p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <LockKeyhole size={24} />
          </div>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-blue-600">Retro Pressa</p>
            <h1 className="text-2xl font-black text-slate-950">Вход в кабинет</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-slate-600">
          Введите логин и пароль, выданные администратором. Регистрация недоступна.
        </p>

        {denied ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            У вашего аккаунта нет доступа к этому разделу.
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            Логин
            <input
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Пароль
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </main>
  );
}
