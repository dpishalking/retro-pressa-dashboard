export type AccessLevel = "admin" | "rop" | "mop";

export type AppUser = {
  id: string;
  login: string;
  passwordHash: string;
  name: string;
  accessLevel: AccessLevel;
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
