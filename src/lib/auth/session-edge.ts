import type { SessionUser } from "@/types/auth";
import {
  decodePayloadBody,
  extractSessionToken,
  getAuthSecret,
  toSessionUser
} from "@/lib/auth/session-common";

const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function timingSafeEqualStrings(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function decodeToken(token: string): Promise<SessionUser | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = await sign(body);
  if (!timingSafeEqualStrings(signature, expected)) return null;

  const payload = decodePayloadBody(body);
  return payload ? toSessionUser(payload) : null;
}

export async function readSessionCookie(cookieHeader: string | null | undefined): Promise<SessionUser | null> {
  const token = extractSessionToken(cookieHeader);
  if (!token) return null;
  return decodeToken(token);
}
