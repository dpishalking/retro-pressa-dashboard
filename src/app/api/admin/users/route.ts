import { NextResponse } from "next/server";
import { createUser, deleteUser, listPublicUsers, updateUser } from "@/lib/auth/store";
import type { AccessLevel } from "@/types/auth";

export async function GET() {
  const users = await listPublicUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      login?: string;
      password?: string;
      name?: string;
      accessLevel?: AccessLevel;
      active?: boolean;
    };

    if (!body.login || !body.password || !body.accessLevel) {
      return NextResponse.json({ error: "Заполните логин, пароль и уровень доступа" }, { status: 400 });
    }

    const user = await createUser({
      login: body.login,
      password: body.password,
      name: body.name ?? body.login,
      accessLevel: body.accessLevel,
      active: body.active
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать пользователя";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      login?: string;
      password?: string;
      name?: string;
      accessLevel?: AccessLevel;
      active?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ error: "ID пользователя обязателен" }, { status: 400 });
    }

    const user = await updateUser({
      id: body.id,
      login: body.login,
      password: body.password,
      name: body.name,
      accessLevel: body.accessLevel,
      active: body.active
    });

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить пользователя";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "ID пользователя обязателен" }, { status: 400 });
    }

    await deleteUser(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить пользователя";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
