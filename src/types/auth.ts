export type AccessLevel = "admin" | "rop" | "mop" | "partner";

/** auto = 3-day internship then 5-day trial until ROP approves. Missing on old users = regular. */
export type MopPayTrack = "auto" | "internship" | "trial" | "regular";

export type AppUser = {
  id: string;
  login: string;
  passwordHash: string;
  name: string;
  accessLevel: AccessLevel;
  /** Bitrix user id (ASSIGNED_BY_ID). Links mop login to CRM stats. */
  bitrixUserId: string | null;
  mopPayTrack: MopPayTrack | null;
  internshipStartedOn: string | null;
  approvedAt: string | null;
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
