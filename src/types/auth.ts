export type AccessLevel = "admin" | "rop" | "mop" | "partner";

export type AppUser = {
  id: string;
  login: string;
  passwordHash: string;
  name: string;
  accessLevel: AccessLevel;
  /** Bitrix user id (ASSIGNED_BY_ID). Links mop login to CRM stats. */
  bitrixUserId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppUserPublic = Omit<AppUser, "passwordHash">;

export type SessionUser = {
  id: string;
  login: string;
  name: string;
  accessLevel: AccessLevel;
};

export type UsersCatalog = {
  version: 1;
  users: AppUser[];
  updatedAt: string;
};
