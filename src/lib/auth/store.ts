import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppUser, AppUserPublic, UsersCatalog } from "@/types/auth";
import { hashPassword } from "@/lib/auth/password";
import { rigaDateIso } from "@/lib/manager-cabinet/dates";
import { generateId } from "@/lib/training/id";
import { registerTrainerManager } from "@/lib/training/trainer-api";

function resolveUsersPath(): string {
  const configured = process.env.AUTH_USERS_FILE?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "auth", "users.json");
}

function resolvePersistentBackupPath(usersFile: string): string {
  const catalogDir = process.env.AUTH_CATALOG_DIR?.trim();
  if (catalogDir) return path.join(catalogDir, "users.json");
  const sharedRoot = path.resolve(path.dirname(usersFile), "..", "..");
  return path.join(sharedRoot, "auth-catalog", "users.json");
}

const usersPath = resolveUsersPath();
const usersBackupPath = `${usersPath}.bak`;
const usersPersistentBackupPath = resolvePersistentBackupPath(usersPath);

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
  return {
    ...publicUser,
    bitrixUserId: user.bitrixUserId ?? null,
    mopPayTrack: user.mopPayTrack ?? (user.accessLevel === "mop" ? "regular" : null),
    internshipStartedOn: user.internshipStartedOn ?? null,
    approvedAt: user.approvedAt ?? null,
    registrationPending: user.registrationPending ?? false,
    registrationRejected: user.registrationRejected ?? false
  };
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
    bitrixUserId: null,
    mopPayTrack: null,
    internshipStartedOn: null,
    approvedAt: null,
    registrationPending: false,
    registrationRejected: false,
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

function normalizeCatalog(catalog: UsersCatalog): UsersCatalog {
  return {
    ...catalog,
    users: catalog.users.map((user) => ({
      ...user,
      bitrixUserId: user.bitrixUserId ?? null,
      mopPayTrack: user.mopPayTrack ?? (user.accessLevel === "mop" ? "regular" : null),
      internshipStartedOn: user.internshipStartedOn ?? null,
      approvedAt: user.approvedAt ?? null,
      registrationPending: user.registrationPending ?? false,
      registrationRejected: user.registrationRejected ?? false
    }))
  };
}

async function readCatalogFile(filePath: string): Promise<UsersCatalog | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isValidCatalog(parsed) ? normalizeCatalog(parsed) : null;
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

  try {
    await mkdir(path.dirname(usersPersistentBackupPath), { recursive: true });
    await copyFile(usersPath, usersPersistentBackupPath);
  } catch {
    // persistent backup is best-effort
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
    const persistentBackup = await readCatalogWithRetry(usersPersistentBackupPath);
    if (persistentBackup) {
      console.error("Auth users catalog is corrupt; repairing from persistent backup");
      await writeUsersCatalogAtomic(persistentBackup);
      return persistentBackup;
    }
    throw new Error("Auth users catalog is corrupt and backup is unavailable");
  }

  const backup = await readCatalogWithRetry(usersBackupPath);
  if (backup) {
    await writeUsersCatalogAtomic(backup);
    return backup;
  }

  const persistentBackup = await readCatalogWithRetry(usersPersistentBackupPath);
  if (persistentBackup) {
    console.error("Auth users catalog missing; repairing from persistent backup");
    await writeUsersCatalogAtomic(persistentBackup);
    return persistentBackup;
  }

  console.error(
    "Auth users catalog missing with no backup — creating admin-only seed",
    { usersPath, persistentBackupPath: usersPersistentBackupPath }
  );
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

export async function countPendingRegistrations(): Promise<number> {
  const catalog = await readUsersCatalog();
  return catalog.users.filter((user) => user.registrationPending).length;
}

export async function findUserByLogin(login: string): Promise<AppUser | null> {
  const catalog = await readUsersCatalog();
  const normalized = login.trim().toLowerCase();
  return catalog.users.find((user) => user.login.toLowerCase() === normalized && user.active) ?? null;
}

/** Finds a user by login regardless of active flag (login flow / partner moderation). */
export async function findUserByLoginAny(login: string): Promise<AppUser | null> {
  const catalog = await readUsersCatalog();
  const normalized = login.trim().toLowerCase();
  return catalog.users.find((user) => user.login.toLowerCase() === normalized) ?? null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const catalog = await readUsersCatalog();
  return catalog.users.find((user) => user.id === id) ?? null;
}

function normalizeBitrixUserId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeIsoDay(value: string | null | undefined): string | null {
  const day = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function normalizePayTrack(value: AppUser["mopPayTrack"] | undefined, accessLevel: AppUser["accessLevel"]): AppUser["mopPayTrack"] {
  if (value === "auto" || value === "internship" || value === "trial" || value === "regular") return value;
  return accessLevel === "mop" ? "regular" : null;
}

type CreateUserInput = {
  login: string;
  password: string;
  name: string;
  accessLevel: AppUser["accessLevel"];
  active?: boolean;
  bitrixUserId?: string | null;
  mopPayTrack?: AppUser["mopPayTrack"];
  internshipStartedOn?: string | null;
  approvedAt?: string | null;
  registrationPending?: boolean;
};

export async function createUser(input: CreateUserInput): Promise<AppUserPublic> {
  return withCatalogLock(async () => {
    const catalog = await readUsersCatalogUnsafe();
    const normalizedLogin = input.login.trim().toLowerCase();
    if (!normalizedLogin) throw new Error("Логин обязателен");
    const existing = catalog.users.find((user) => user.login.toLowerCase() === normalizedLogin);
    if (existing) {
      if (input.registrationPending && existing.registrationRejected && existing.accessLevel === "mop") {
        const index = catalog.users.findIndex((user) => user.id === existing.id);
        if (index === -1) throw new Error("Пользователь не найден");
        const now = new Date().toISOString();
        const mopTrack = normalizePayTrack(input.mopPayTrack ?? "auto", "mop");
        existing.passwordHash = hashPassword(input.password);
        existing.name = input.name.trim() || normalizedLogin;
        existing.mopPayTrack = mopTrack;
        existing.internshipStartedOn = null;
        existing.approvedAt = null;
        existing.registrationPending = true;
        existing.registrationRejected = false;
        existing.active = false;
        existing.updatedAt = now;
        catalog.users[index] = existing;
        await writeUsersCatalogAtomic(catalog);
        return toPublicUser(existing);
      }
      throw new Error("Пользователь с таким логином уже существует");
    }

    const now = new Date().toISOString();
    const pending = Boolean(input.registrationPending);
    const mopTrack =
      input.accessLevel === "mop" ? normalizePayTrack(input.mopPayTrack ?? "auto", "mop") : null;
    const user: AppUser = {
      id: generateId("user"),
      login: normalizedLogin,
      passwordHash: hashPassword(input.password),
      name: input.name.trim() || normalizedLogin,
      accessLevel: input.accessLevel,
      bitrixUserId: normalizeBitrixUserId(input.bitrixUserId),
      mopPayTrack: mopTrack,
      internshipStartedOn: pending
        ? null
        : mopTrack && mopTrack !== "regular"
          ? normalizeIsoDay(input.internshipStartedOn) || rigaDateIso()
          : normalizeIsoDay(input.internshipStartedOn),
      approvedAt: pending ? null : mopTrack === "regular" ? input.approvedAt || now : null,
      registrationPending: pending,
      registrationRejected: false,
      active: pending ? false : (input.active ?? true),
      createdAt: now,
      updatedAt: now
    };

    catalog.users.push(user);
    await writeUsersCatalogAtomic(catalog);

    if (!pending && (user.accessLevel === "mop" || user.accessLevel === "rop")) {
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
  bitrixUserId?: string | null;
  mopPayTrack?: AppUser["mopPayTrack"];
  internshipStartedOn?: string | null;
  approvedAt?: string | null;
};

export async function updateUser(input: UpdateUserInput): Promise<AppUserPublic> {
  return withCatalogLock(async () => {
    const catalog = await readUsersCatalogUnsafe();
    const index = catalog.users.findIndex((user) => user.id === input.id);
    if (index === -1) throw new Error("Пользователь не найден");

    const current = catalog.users[index]!;
    let shouldRegisterTrainer = false;
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
    if (input.active === true && current.registrationPending) {
      current.registrationPending = false;
      current.registrationRejected = false;
      if (current.accessLevel === "mop" && current.mopPayTrack && current.mopPayTrack !== "regular" && !current.internshipStartedOn) {
        current.internshipStartedOn = rigaDateIso();
      }
      if (current.accessLevel === "mop" || current.accessLevel === "rop") {
        shouldRegisterTrainer = true;
      }
    }
    if (input.bitrixUserId !== undefined) current.bitrixUserId = normalizeBitrixUserId(input.bitrixUserId);
    if (input.mopPayTrack !== undefined || input.internshipStartedOn !== undefined || input.approvedAt !== undefined) {
      const nextLevel = input.accessLevel ?? current.accessLevel;
      if (nextLevel === "mop") {
        if (input.mopPayTrack !== undefined) current.mopPayTrack = normalizePayTrack(input.mopPayTrack, "mop");
        if (input.internshipStartedOn !== undefined && !current.registrationPending) {
          current.internshipStartedOn = normalizeIsoDay(input.internshipStartedOn);
        }
        if (input.approvedAt !== undefined) current.approvedAt = input.approvedAt;
        if (current.mopPayTrack === "regular" && !current.approvedAt) current.approvedAt = new Date().toISOString();
        if (current.mopPayTrack === "auto" && !current.internshipStartedOn && !current.registrationPending) {
          current.internshipStartedOn = rigaDateIso();
        }
      } else {
        current.mopPayTrack = null;
        current.internshipStartedOn = null;
        current.approvedAt = null;
      }
    }
    if (input.password) current.passwordHash = hashPassword(input.password);
    current.updatedAt = new Date().toISOString();

    catalog.users[index] = current;
    await writeUsersCatalogAtomic(catalog);
    if (shouldRegisterTrainer) {
      void registerTrainerManager({ id: current.id, name: current.name });
    }
    return toPublicUser(current);
  });
}

export async function approveUserRegistration(id: string): Promise<AppUserPublic> {
  const target = await findUserById(id);
  if (!target) throw new Error("Пользователь не найден");
  if (!target.registrationPending) {
    throw new Error("У этого пользователя нет заявки на регистрацию");
  }
  return updateUser({ id, active: true });
}

export async function rejectUserRegistration(id: string): Promise<AppUserPublic> {
  return withCatalogLock(async () => {
    const catalog = await readUsersCatalogUnsafe();
    const index = catalog.users.findIndex((user) => user.id === id);
    if (index === -1) throw new Error("Пользователь не найден");
    const target = catalog.users[index]!;
    if (!target.registrationPending) {
      throw new Error("У этого пользователя нет заявки на регистрацию");
    }

    target.registrationPending = false;
    target.registrationRejected = true;
    target.active = false;
    target.updatedAt = new Date().toISOString();
    catalog.users[index] = target;
    await writeUsersCatalogAtomic(catalog);
    return toPublicUser(target);
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
