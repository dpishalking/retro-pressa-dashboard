import { createUser } from "@/lib/auth/store";
import type { AppUserPublic } from "@/types/auth";

export type ManagerRegisterBody = {
  name?: string;
  login?: string;
  password?: string;
};

const LOGIN_PATTERN = /^[\p{L}\p{N}._-]+$/u;

export async function registerManager(body: ManagerRegisterBody): Promise<AppUserPublic> {
  const name = body.name?.trim() ?? "";
  const login = body.login?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!name || !login || !password) {
    throw new Error("Заполните имя, логин и пароль");
  }
  if (name.length > 80) {
    throw new Error("Имя — не длиннее 80 символов");
  }
  if (login.length < 3 || login.length > 32) {
    throw new Error("Логин — от 3 до 32 символов");
  }
  if (login.includes("@") || !LOGIN_PATTERN.test(login)) {
    throw new Error("Логин без почты и пробелов — буквы, цифры, точка, дефис или подчёркивание");
  }
  if (password.length > 128) {
    throw new Error("Пароль слишком длинный");
  }
  if (password.trim().length < 8 || password !== password.trim()) {
    throw new Error("Пароль — от 8 символов, без пробелов по краям");
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
