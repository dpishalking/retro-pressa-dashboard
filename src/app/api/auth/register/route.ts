import { NextResponse } from "next/server";
import { notifyManagerRegistered } from "@/lib/auth/registration-alert";
import { registerManager, type ManagerRegisterBody } from "@/lib/auth/register-manager";
import { assertRegisterRateLimit } from "@/lib/auth/register-rate-limit";
import { buildSessionCookie, createSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertRegisterRateLimit(request);
    const body = (await request.json().catch(() => ({}))) as ManagerRegisterBody;
    const user = await registerManager(body);
    await notifyManagerRegistered({
      name: user.name,
      login: user.login,
      createdAt: user.createdAt
    }).catch((alertError) => {
      console.warn("Registration alert failed", alertError);
    });
    const token = createSessionToken({
      id: user.id,
      login: user.login,
      name: user.name,
      accessLevel: user.accessLevel
    });
    const response = NextResponse.json(
      {
        ok: true,
        login: user.login,
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          accessLevel: user.accessLevel
        }
      },
      { status: 201 }
    );
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось зарегистрироваться";
    const status = message.startsWith("Слишком много") ? 429 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
