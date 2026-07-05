import { NextResponse } from "next/server";
import { findUserByLogin } from "@/lib/auth/store";
import { verifyPassword } from "@/lib/auth/password";
import { buildSessionCookie, createSessionToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { login?: string; password?: string };
    const login = body.login?.trim();
    const password = body.password ?? "";

    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
    }

    const user = await findUserByLogin(login);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const token = createSessionToken({
      id: user.id,
      login: user.login,
      name: user.name,
      accessLevel: user.accessLevel
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        accessLevel: user.accessLevel
      }
    });
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка входа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
