import { createUser } from "@/lib/auth/store";
import type { AppUserPublic } from "@/types/auth";

export type ManagerRegisterBody = {
  name?: string;
  login?: string;
  password?: string;
};

export async function registerManager(body: ManagerRegisterBody): Promise<AppUserPublic> {
  const name = body.name?.trim() ?? "";
  const login = body.login?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!name || !login || !password) {
    throw new Error("Заполните имя, логин и пароль");
  }
  if (login.length < 3 || login.length > 32) {
    throw new Error("Логин — от 3 до 32 символов");
  }
  if (/\s/.test(login) || login.includes("@")) {
    throw new Error("Логин без пробелов и без почты — только имя для входа");
  }
  if (password.length < 8) {
    throw new Error("Пароль должен быть не короче 8 символов");
  }

  return createUser({
    login,
    password,
    name,
    accessLevel: "mop",
    mopPayTrack: "auto",
    registrationPending: true
  });
}
