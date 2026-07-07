import { NextResponse } from "next/server";
import {
  assertRopCanCreateUser,
  assertRopCanDeleteUser,
  assertRopCanModifyUser,
  canAccessUserManagement
} from "@/lib/auth/admin-users-auth";
import { createUser, deleteUser, findUserById, listPublicUsers, listTraineeUsers, updateUser } from "@/lib/auth/store";
import { readSessionCookie } from "@/lib/auth/session";
import type { AccessLevel } from "@/types/auth";

function readSession(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session || !canAccessUserManagement(session.accessLevel)) {
    return null;
  }
  return session;
}

export async function GET(request: Request) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users =
    session.accessLevel === "rop" ? await listTraineeUsers() : await listPublicUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    assertRopCanCreateUser(session, body.accessLevel);

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
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    const target = await findUserById(body.id);
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    assertRopCanModifyUser(session, target.accessLevel, body.accessLevel);

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
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "ID пользователя обязателен" }, { status: 400 });
    }

    const target = await findUserById(body.id);
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    assertRopCanDeleteUser(session, target.accessLevel);

    await deleteUser(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить пользователя";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
