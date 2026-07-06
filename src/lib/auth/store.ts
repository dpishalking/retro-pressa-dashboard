import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppUser, AppUserPublic, UsersCatalog } from "@/types/auth";
import { hashPassword } from "@/lib/auth/password";
import { generateId } from "@/lib/training/id";
import { registerTrainerManager } from "@/lib/training/trainer-api";

const usersPath = path.join(process.cwd(), "data", "auth", "users.json");
const usersBackupPath = `${usersPath}.bak`;

let catalogLock: Promise<void> = Promise.resolve();

function withCatalogLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = catalogLock.then(fn);
  catalogLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildSeedCatalog(): UsersCatalog {
  return {
    version: 1,
    users: [defaultAdminUser()],
    updatedAt: new Date().toISOString()
  };
}

function isValidCatalog(value: unknown): value is UsersCatalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<UsersCatalog>;
  return catalog.version === 1 && Array.isArray(catalog.users) && catalog.users.length > 0;
}

async function readCatalogFile(filePath: string): Promise<UsersCatalog | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isValidCatalog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readCatalogWithRetry(filePath: string, attempts = 5): Promise<UsersCatalog | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const catalog = await readCatalogFile(filePath);
    if (catalog) return catalog;
    if (attempt < attempts - 1) await sleep(40);
  }
  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return !message.includes("ENOENT");
  }
}

async function writeUsersCatalogAtomic(catalog: UsersCatalog) {
  await ensureAuthDir();
  const payload: UsersCatalog = { ...catalog, updatedAt: new Date().toISOString() };
  const content = JSON.stringify(payload, null, 2);
  const tmpPath = `${usersPath}.tmp`;

  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, usersPath);

  try {
    await copyFile(usersPath, usersBackupPath);
  } catch {
    // backup is best-effort
  }
}

async function readUsersCatalogUnsafe(): Promise<UsersCatalog> {
  await ensureAuthDir();

  const existing = await readCatalogWithRetry(usersPath);
  if (existing) return existing;

  const hasMainFile = await fileExists(usersPath);
  if (hasMainFile) {
    const backup = await readCatalogWithRetry(usersBackupPath);
    if (backup) {
      console.error("Auth users catalog is corrupt; repairing from backup");
      await writeUsersCatalogAtomic(backup);
      return backup;
    }
    throw new Error("Auth users catalog is corrupt and backup is unavailable");
  }

  const backup = await readCatalogWithRetry(usersBackupPath);
  if (backup) {
    await writeUsersCatalogAtomic(backup);
    return backup;
  }

  const seed = buildSeedCatalog();
  await writeUsersCatalogAtomic(seed);
  return seed;
}

export async function readUsersCatalog(): Promise<UsersCatalog> {
  return withCatalogLock(readUsersCatalogUnsafe);
}

export async function writeUsersCatalog(catalog: UsersCatalog) {
  return withCatalogLock(async () => {
    await writeUsersCatalogAtomic(catalog);
  });
}

export async function listPublicUsers(): Promise<AppUserPublic[]> {
  const catalog = await readUsersCatalog();
  return catalog.users.map(toPublicUser);
}

export async function listTraineeUsers(): Promise<AppUserPublic[]> {
  const catalog = await readUsersCatalog();
  return catalog.users.filter((user) => user.accessLevel === "mop").map(toPublicUser);
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
  return withCatalogLock(async () => {
    const catalog = await readUsersCatalogUnsafe();
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
    await writeUsersCatalogAtomic(catalog);

    if (user.accessLevel === "mop" || user.accessLevel === "rop") {
      void registerTrainerManager({ id: user.id, name: user.name });
    }

    return toPublicUser(user);
  });
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
  return withCatalogLock(async () => {
    const catalog = await readUsersCatalogUnsafe();
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
    await writeUsersCatalogAtomic(catalog);
    return toPublicUser(current);
  });
}

export async function deleteUser(id: string): Promise<void> {
  return withCatalogLock(async () => {
    const catalog = await readUsersCatalogUnsafe();
    const admins = catalog.users.filter((user) => user.accessLevel === "admin" && user.active);
    const target = catalog.users.find((user) => user.id === id);
    if (!target) throw new Error("Пользователь не найден");
    if (target.accessLevel === "admin" && admins.length <= 1) {
      throw new Error("Нельзя удалить последнего активного администратора");
    }

    catalog.users = catalog.users.filter((user) => user.id !== id);
    await writeUsersCatalogAtomic(catalog);
  });
}
