import { readBitrixSnapshot, listBitrixSnapshotPeriods } from "@/lib/bitrix/snapshot-store";
import { PM_SALES_MANAGERS } from "@/lib/predictive-sheets/managers";
import type { BitrixRosterEntry } from "@/lib/manager-cabinet/types";

function firstNameFromFull(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function staticRoster(): BitrixRosterEntry[] {
  return PM_SALES_MANAGERS.map((row) => ({
    bitrixId: row.bitrixId,
    name: row.fullName,
    firstName: row.firstName,
    revenuePlan: row.revenuePlan ?? null,
    activeRoster: true
  }));
}

export function revenuePlanForBitrixId(bitrixId: string, roster: BitrixRosterEntry[]): number | null {
  return roster.find((row) => row.bitrixId === bitrixId)?.revenuePlan ?? null;
}

export async function loadBitrixRoster(): Promise<BitrixRosterEntry[]> {
  const byId = new Map<string, BitrixRosterEntry>();
  for (const row of staticRoster()) byId.set(row.bitrixId, row);

  const periods = await listBitrixSnapshotPeriods();
  const latest = periods.at(-1);
  if (latest) {
    const snapshot = await readBitrixSnapshot(latest);
    if (snapshot) {
      for (const row of [...snapshot.leads, ...snapshot.paidDeals]) {
        const id = row.assignedById;
        if (!id || byId.has(id)) continue;
        const name = row.managerName || `ID ${id}`;
        if (/^ID\s+\d+$/i.test(name)) continue;
        if (/tehniskais|frigatnet|admin/i.test(name)) continue;
        byId.set(id, {
          bitrixId: id,
          name,
          firstName: firstNameFromFull(name),
          revenuePlan: null,
          activeRoster: false
        });
      }
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.activeRoster !== b.activeRoster) return a.activeRoster ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
}
