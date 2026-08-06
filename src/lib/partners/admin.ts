import { updateUser } from "@/lib/auth/store";
import { findPartnerById, setPartnerStatus, updatePartner } from "@/lib/partners/store";
import type { Partner, PartnerStatus } from "@/types/partners";

export async function moderatePartner(input: {
  partnerId: string;
  status: PartnerStatus;
  commissionRate?: number;
}): Promise<Partner> {
  const partner = await findPartnerById(input.partnerId);
  if (!partner) throw new Error("Партнёр не найден");

  if (input.commissionRate !== undefined) {
    await updatePartner(partner.id, { commissionRate: input.commissionRate });
  }

  const updated = await setPartnerStatus(partner.id, input.status);
  const shouldBeActive = input.status === "active";
  await updateUser({ id: partner.userId, active: shouldBeActive });
  return updated;
}
