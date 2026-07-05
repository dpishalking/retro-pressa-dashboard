"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Plus, RefreshCw, Trash2, UserCog } from "lucide-react";
import { accessLevelLabel, accessLevelScope } from "@/lib/auth/access";
import { HUB_PATH } from "@/lib/auth/routes";
import type { AccessLevel, AppUserPublic } from "@/types/auth";

type UserFormState = {
  login: string;
  password: string;
  name: string;
  accessLevel: AccessLevel;
  active: boolean;
};

const emptyForm: UserFormState = {
  login: "",
  password: "",
  name: "",
  accessLevel: "mop",
  active: true
};

function generatePassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function buildAccessMessage(input: {
  origin: string;
  login: string;
  password: string;
  name: string;
  accessLevel: AccessLevel;
  active: boolean;
  isEdit: boolean;
}): string {
  const loginUrl = input.origin || "https://rp-bi.site";
  const displayName = input.name.trim() || input.login.trim() || "—";
  const passwordLine = input.password.trim()
    ? input.password.trim()
    : input.isEdit
      ? "без изменений (если не задавали новый пароль)"
      : "— укажите пароль выше —";

  return [
    "Retro Pressa — доступ к кабинету",
    "",
    `Ссылка для входа: ${loginUrl}/`,
    `Логин: ${input.login.trim() || "—"}`,
    `Пароль: ${passwordLine}`,
    `Имя: ${displayName}`,
    `Уровень доступа: ${accessLevelLabel(input.accessLevel)}`,
    `Доступные разделы: ${accessLevelScope(input.accessLevel)}`,
    `Статус: ${input.active ? "активен" : "отключён"}`,
    "",
    "После входа откроется рабочий кабинет. Регистрация недоступна — используйте только эти данные."
  ].join("\n");
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AppUserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const accessMessage = useMemo(
    () =>
      buildAccessMessage({
        origin,
        login: form.login,
        password: form.password,
        name: form.name,
        accessLevel: form.accessLevel,
        active: form.active,
        isEdit: Boolean(editingId)
      }),
    [origin, form, editingId]
  );

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users");
      const data = (await response.json()) as { users?: AppUserPublic[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить пользователей");
      setUsers(data.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const startEdit = (user: AppUserPublic) => {
    setEditingId(user.id);
    setForm({
      login: user.login,
      password: "",
      name: user.name,
      accessLevel: user.accessLevel,
      active: user.active
    });
    setCopied(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCopied(false);
  };

  const handleGeneratePassword = () => {
    setForm((prev) => ({ ...prev, password: generatePassword() }));
    setCopied(false);
  };

  const handleCopyAccess = async () => {
    try {
      await navigator.clipboard.writeText(accessMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать текст. Скопируйте вручную из поля ниже.");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = editingId
        ? {
            id: editingId,
            login: form.login,
            name: form.name,
            accessLevel: form.accessLevel,
            active: form.active,
            ...(form.password ? { password: form.password } : {})
          }
        : {
            login: form.login,
            password: form.password,
            name: form.name,
            accessLevel: form.accessLevel,
            active: form.active
          };

      const response = await fetch("/api/admin/users", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить пользователя");

      resetForm();
      await loadUsers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить пользователя?")) return;
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось удалить пользователя");
      if (editingId === id) resetForm();
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Ошибка удаления");
    }
  };

  return (
    <main className="mx-auto w-[min(1100px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <Link href={HUB_PATH} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} />
          В кабинет
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
            <UserCog size={24} />
          </div>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-normal text-violet-600">Администрирование</p>
            <h1 className="text-3xl font-black text-slate-950">Управление доступами</h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Создавайте пользователей и назначайте уровни доступа: администратор видит всё, РОП — аналитику, инструменты РОП и обучение,
          менеджер — только обучение.
        </p>
      </header>

      <section className="mb-8 grid gap-6 lg:grid-cols-[360px,1fr]">
        <form className="card h-fit p-6" onSubmit={handleSubmit}>
          <h2 className="mb-4 text-lg font-black text-slate-950">
            {editingId ? "Редактировать пользователя" : "Новый пользователь"}
          </h2>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Логин
              <input
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={form.login}
                onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))}
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              {editingId ? "Новый пароль (необязательно)" : "Пароль"}
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required={!editingId}
                />
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  title="Сгенерировать пароль"
                >
                  <RefreshCw size={14} />
                  Сгенерировать
                </button>
              </div>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Имя
              <input
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Уровень доступа
              <select
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={form.accessLevel}
                onChange={(event) => setForm((prev) => ({ ...prev, accessLevel: event.target.value as AccessLevel }))}
              >
                <option value="admin">Администратор — все разделы</option>
                <option value="rop">РОП — аналитика, инструменты РОП, обучение</option>
                <option value="mop">Менеджер — только обучение</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Аккаунт активен
            </label>
          </div>

          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-violet-950">Сообщение для пересылки</h3>
              <button
                type="button"
                onClick={() => void handleCopyAccess()}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
              >
                <Copy size={14} />
                {copied ? "Скопировано" : "Скопировать"}
              </button>
            </div>
            <textarea
              readOnly
              rows={11}
              value={accessMessage}
              className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700"
            />
          </div>

          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <Plus size={16} />
              {saving ? "Сохранение..." : editingId ? "Сохранить" : "Создать"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Отмена
              </button>
            ) : null}
          </div>
        </form>

        <div className="card overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-4">
            <h2 className="text-lg font-black text-slate-950">Пользователи</h2>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Логин</th>
                  <th>Имя</th>
                  <th>Доступ</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>Загрузка...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Пользователей пока нет</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.login}</td>
                      <td>{user.name}</td>
                      <td>{accessLevelLabel(user.accessLevel)}</td>
                      <td>{user.active ? "Активен" : "Отключён"}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(user.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                          >
                            <Trash2 size={14} />
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
