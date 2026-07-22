import { createHash } from "node:crypto";

export type CustomerKeyType = "contact" | "phone" | "email" | "lead" | "deal" | "order";

export type CustomerIdentityInput = {
  contactId?: string | null;
  phone?: string | null;
  email?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  orderId?: string | null;
};

export type ResolvedCustomerKey = {
  customer_key: string;
  customer_key_type: CustomerKeyType;
};

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, "");
  if (digits.length < 8) return null;
  // Keep last 11–15 digits for international numbers; strip leading 00.
  let normalized = digits.replace(/^00/, "");
  if (normalized.length > 15) normalized = normalized.slice(-15);
  return normalized || null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = String(raw).trim().toLowerCase();
  if (!email.includes("@") || email.length < 5) return null;
  return email;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Stable customer identity priority:
 * contact → phone hash → email hash → lead → deal → order
 */
export function resolveCustomerIdentity(input: CustomerIdentityInput): ResolvedCustomerKey {
  const contactId = String(input.contactId ?? "").trim();
  if (contactId) {
    return { customer_key: `contact:${contactId}`, customer_key_type: "contact" };
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    return { customer_key: `phone:${sha256Hex(phone)}`, customer_key_type: "phone" };
  }

  const email = normalizeEmail(input.email);
  if (email) {
    return { customer_key: `email:${sha256Hex(email)}`, customer_key_type: "email" };
  }

  const leadId = String(input.leadId ?? "").trim();
  if (leadId) {
    return { customer_key: `lead:${leadId}`, customer_key_type: "lead" };
  }

  const dealId = String(input.dealId ?? "").trim();
  if (dealId) {
    return { customer_key: `deal:${dealId}`, customer_key_type: "deal" };
  }

  const orderId = String(input.orderId ?? "").trim();
  if (orderId) {
    return { customer_key: `order:${orderId}`, customer_key_type: "order" };
  }

  return { customer_key: "", customer_key_type: "order" };
}
