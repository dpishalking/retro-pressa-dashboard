import { createUser } from "@/lib/auth/store";
import { createPendingPartner, toPublicPartner } from "@/lib/partners/store";
import type { PartnerPublicProfile } from "@/types/partners";

export type PartnerRegisterBody = {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  password?: string;
};

export async function registerPartner(body: PartnerRegisterBody): Promise<{
  partner: PartnerPublicProfile;
  login: string;
}> {
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const country = body.country?.trim() ?? "";
  const password = body.password ?? "";

  if (!name || !email || !phone || !password) {
    throw new Error("Заполните имя, email, телефон и пароль");
  }
  if (password.length < 8) {
    throw new Error("Пароль должен быть не короче 8 символов");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Укажите корректный email");
  }

  const user = await createUser({
    login: email,
    password,
    name,
    accessLevel: "partner",
    active: false
  });

  try {
    const partner = await createPendingPartner({
      userId: user.id,
      name,
      email,
      phone,
      country,
      passwordLogin: email
    });
    return { partner: toPublicPartner(partner), login: email };
  } catch (error) {
    const { deleteUser } = await import("@/lib/auth/store");
    await deleteUser(user.id).catch(() => undefined);
    throw error;
  }
}
