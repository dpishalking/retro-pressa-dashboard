import type { SessionUser } from "@/types/auth";

export const SESSION_COOKIE = "retro-pressa-session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type SessionPayload = SessionUser & { exp: number };

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    console.warn("AUTH_SECRET is missing or too short; using insecure fallback.");
  }
  return "retro-pressa-dev-secret-change-me";
}

export function encodePayload(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body;
}

export function decodePayloadBody(body: string): SessionPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.id || !payload.accessLevel || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function toSessionUser(payload: SessionPayload): SessionUser {
  return {
    id: payload.id,
    login: payload.login,
    name: payload.name,
    accessLevel: payload.accessLevel
  };
}

export function createSessionPayload(user: SessionUser): SessionPayload {
  return {
    ...user,
    exp: Date.now() + SESSION_TTL_MS
  };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function extractSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return match.slice(SESSION_COOKIE.length + 1);
}
