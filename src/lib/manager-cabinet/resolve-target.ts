import { canPickCabinetManager } from "@/lib/manager-cabinet/access";
import { matchUniqueByName } from "@/lib/manager-cabinet/match";
import type { BitrixRosterEntry } from "@/lib/manager-cabinet/types";
import type { AccessLevel } from "@/types/auth";

export type CabinetTargetUser = {
  id: string;
  name: string;
  bitrixUserId?: string | null;
  accessLevel?: AccessLevel;
  active?: boolean;
};

export type CabinetTarget = {
  bitrixUserId: string | null;
  managerName: string | null;
  authUserId: string | null;
  authName: string | null;
};

export function resolveBitrixUserId(
  user: { bitrixUserId?: string | null; name: string },
  roster: BitrixRosterEntry[]
): string | null {
  const stored = user.bitrixUserId?.trim();
  if (stored) return stored;
  return matchUniqueByName(user.name, roster)?.bitrixId ?? null;
}

function fromRoster(row: BitrixRosterEntry, auth: CabinetTargetUser | null): CabinetTarget {
  return {
    bitrixUserId: row.bitrixId,
    managerName: row.name,
    authUserId: auth?.id || null,
    authName: auth?.name || row.name
  };
}

function authForBitrix(bitrixId: string, users: CabinetTargetUser[]): CabinetTargetUser | null {
  return users.find((user) => user.bitrixUserId === bitrixId) ?? null;
}

/**
 * mop → own Bitrix link. admin/rop → any roster cabinet (requested Bitrix id or first roster).
 * Never fall back to an unlinked mop login for pickers.
 */
export function resolveCabinetTarget(input: {
  accessLevel: AccessLevel;
  sessionId: string;
  requestedId: string | null;
  users: CabinetTargetUser[];
  roster: BitrixRosterEntry[];
}): CabinetTarget {
  const empty: CabinetTarget = {
    bitrixUserId: null,
    managerName: null,
    authUserId: null,
    authName: null
  };

  if (!canPickCabinetManager(input.accessLevel)) {
    const self = input.users.find((user) => user.id === input.sessionId) ?? input.users[0] ?? null;
    if (!self) return empty;
    const bitrixUserId = resolveBitrixUserId(self, input.roster);
    const row = bitrixUserId ? input.roster.find((item) => item.bitrixId === bitrixUserId) : null;
    return {
      bitrixUserId,
      managerName: row?.name || self.name,
      authUserId: self.id,
      authName: self.name
    };
  }

  const requested = input.requestedId?.trim() || null;
  if (requested) {
    const rosterHit = input.roster.find((row) => row.bitrixId === requested);
    if (rosterHit) return fromRoster(rosterHit, authForBitrix(rosterHit.bitrixId, input.users));
    const byAuth = input.users.find((user) => user.id === requested);
    if (byAuth) {
      const bitrixUserId = resolveBitrixUserId(byAuth, input.roster);
      const row = bitrixUserId ? input.roster.find((item) => item.bitrixId === bitrixUserId) : null;
      if (row) return fromRoster(row, byAuth);
    }
  }

  const firstId = firstCabinetManagerId(input.roster, null);
  const first = firstId ? input.roster.find((row) => row.bitrixId === firstId) : undefined;
  if (!first) return empty;
  return fromRoster(first, authForBitrix(first.bitrixId, input.users));
}

/** Prefer an already selected Bitrix id, otherwise the first active roster manager. */
export function firstCabinetManagerId(
  roster: BitrixRosterEntry[],
  selectedId?: string | null
): string | null {
  const selected = selectedId?.trim() || null;
  if (selected && roster.some((row) => row.bitrixId === selected)) return selected;
  return roster.find((row) => row.activeRoster)?.bitrixId ?? roster[0]?.bitrixId ?? null;
}
