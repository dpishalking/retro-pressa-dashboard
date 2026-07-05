import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@/types/auth";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionPayload,
  decodePayloadBody,
  encodePayload,
  extractSessionToken,
  getAuthSecret,
  getSessionCookieName,
  toSessionUser
} from "@/lib/auth/session-common";

function sign(value: string): string {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function decodeToken(token: string): SessionUser | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const actual = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actual.length !== expectedBuf.length || !timingSafeEqual(actual, expectedBuf)) {
    return null;
  }

  const payload = decodePayloadBody(body);
  return payload ? toSessionUser(payload) : null;
}

export function createSessionToken(user: SessionUser): string {
  const body = encodePayload(createSessionPayload(user));
  return `${body}.${sign(body)}`;
}

export function parseSessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  return decodeToken(token);
}

export function readSessionCookie(cookieHeader: string | null | undefined): SessionUser | null {
  return parseSessionToken(extractSessionToken(cookieHeader));
}

export { buildSessionCookie, clearSessionCookie, getSessionCookieName };
