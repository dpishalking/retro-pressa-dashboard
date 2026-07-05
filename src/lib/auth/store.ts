import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppUser, AppUserPublic, UsersCatalog } from "@/types/auth";
import { hashPassword } from "@/lib/auth/password";
import { generateId } from "@/lib/training/id";

const usersPath = path.join(process.cwd(), "data", "auth", "users.json");

function toPublicUser(user: AppUser): AppUserPublic {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

async function ensureAuthDir() {
  await mkdir(path.dirname(usersPath), { recursive: true });
}

function defaultAdminUser(): AppUser {
  const now = new Date().toISOString();
  const login = process.env.DEFAULT_ADMIN_LOGIN ?? "admin";
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? "admin";
  return {
    id: "admin-default",
    login,
    passwordHash: hashPassword(password),
    name: "Администратор",
    accessLevel: "admin",
    active: true,
    createdAt: now,
    updatedAt: now
  };
}

export async function readUsersCatalog(): Promise<UsersCatalog> {
  try {
    const raw = await readFile(usersPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<UsersCatalog>;
    if (parsed?.version === 1 && Array.isArray(parsed.users) && parsed.users.length > 0) {
      return parsed as UsersCatalog;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read auth users catalog, using seed:", message);
    }
  }

  const seed: UsersCatalog = {
    version: 1,
    users: [defaultAdminUser()],
    updatedAt: new Date().toISOString()
  };
  await writeUsersCatalog(seed);
  return seed;
}

export async function writeUsersCatalog(catalog: UsersCatalog) {
  await ensureAuthDir();
  await writeFile(
    usersPath,
    JSON.stringify({ ...catalog, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export async function listPublicUsers(): Promise<AppUserPublic[]> {
  const catalog = await readUsersCatalog();
  return catalog.users.map(toPublicUser);
}

export async function findUserByLogin(login: string): Promise<AppUser | null> {
  const catalog = await readUsersCatalog();
  const normalized = login.trim().toLowerCase();
  return catalog.users.find((user) => user.login.toLowerCase() === normalized && user.active) ?? null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const catalog = await readUsersCatalog();
  return catalog.users.find((user) => user.id === id) ?? null;
}

type CreateUserInput = {
  login: string;
  password: string;
  name: string;
  accessLevel: AppUser["accessLevel"];
  active?: boolean;
};

export async function createUser(input: CreateUserInput): Promise<AppUserPublic> {
  const catalog = await readUsersCatalog();
  const normalizedLogin = input.login.trim().toLowerCase();
  if (!normalizedLogin) throw new Error("Логин обязателен");
  if (catalog.users.some((user) => user.login.toLowerCase() === normalizedLogin)) {
    throw new Error("Пользователь с таким логином уже существует");
  }

  const now = new Date().toISOString();
  const user: AppUser = {
    id: generateId("user"),
    login: normalizedLogin,
    passwordHash: hashPassword(input.password),
    name: input.name.trim() || normalizedLogin,
    accessLevel: input.accessLevel,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now
  };

  catalog.users.push(user);
  await writeUsersCatalog(catalog);
  return toPublicUser(user);
}

type UpdateUserInput = {
  id: string;
  login?: string;
  password?: string;
  name?: string;
  accessLevel?: AppUser["accessLevel"];
  active?: boolean;
};

export async function updateUser(input: UpdateUserInput): Promise<AppUserPublic> {
  const catalog = await readUsersCatalog();
  const index = catalog.users.findIndex((user) => user.id === input.id);
  if (index === -1) throw new Error("Пользователь не найден");

  const current = catalog.users[index]!;
  if (input.login !== undefined) {
    const normalizedLogin = input.login.trim().toLowerCase();
    if (!normalizedLogin) throw new Error("Логин обязателен");
    if (catalog.users.some((user) => user.id !== input.id && user.login.toLowerCase() === normalizedLogin)) {
      throw new Error("Пользователь с таким логином уже существует");
    }
    current.login = normalizedLogin;
  }
  if (input.name !== undefined) current.name = input.name.trim() || current.login;
  if (input.accessLevel !== undefined) current.accessLevel = input.accessLevel;
  if (input.active !== undefined) current.active = input.active;
  if (input.password) current.passwordHash = hashPassword(input.password);
  current.updatedAt = new Date().toISOString();

  catalog.users[index] = current;
  await writeUsersCatalog(catalog);
  return toPublicUser(current);
}

export async function deleteUser(id: string): Promise<void> {
  const catalog = await readUsersCatalog();
  const admins = catalog.users.filter((user) => user.accessLevel === "admin" && user.active);
  const target = catalog.users.find((user) => user.id === id);
  if (!target) throw new Error("Пользователь не найден");
  if (target.accessLevel === "admin" && admins.length <= 1) {
    throw new Error("Нельзя удалить последнего активного администратора");
  }

  catalog.users = catalog.users.filter((user) => user.id !== id);
  await writeUsersCatalog(catalog);
}
