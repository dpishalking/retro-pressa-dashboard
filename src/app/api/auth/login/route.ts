import { NextResponse } from "next/server";
import { findUserByLoginAny } from "@/lib/auth/store";
import { verifyPassword } from "@/lib/auth/password";
import { buildSessionCookie, createSessionToken } from "@/lib/auth/session";
import { findPartnerByUserId } from "@/lib/partners/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { login?: string; password?: string };
    const login = body.login?.trim();
    const password = body.password ?? "";

    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
    }

    const user = await findUserByLoginAny(login);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    if (user.accessLevel === "partner") {
      const partner = await findPartnerByUserId(user.id);
      if (!partner || partner.status === "pending") {
        return NextResponse.json(
          { error: "Заявка на рассмотрении. Мы откроем доступ после одобрения." },
          { status: 403 }
        );
      }
      if (partner.status === "rejected") {
        return NextResponse.json(
          { error: "Заявка отклонена. Свяжитесь с нами, если это ошибка." },
          { status: 403 }
        );
      }
      if (partner.status === "suspended" || !user.active) {
        return NextResponse.json({ error: "Аккаунт партнёра временно отключён." }, { status: 403 });
      }
    } else if (!user.active) {
      return NextResponse.json({ error: "Аккаунт отключён" }, { status: 403 });
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
