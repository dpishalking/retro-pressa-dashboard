import { NextResponse } from "next/server";
import { registerManager, type ManagerRegisterBody } from "@/lib/auth/register-manager";
import { assertRegisterRateLimit } from "@/lib/auth/register-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertRegisterRateLimit(request);
    const body = (await request.json().catch(() => ({}))) as ManagerRegisterBody;
    const user = await registerManager(body);
    return NextResponse.json(
      {
        ok: true,
        login: user.login,
        message: "Заявка отправлена. Когда РОП одобрит регистрацию, вы сможете войти с этим логином и паролем."
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось зарегистрироваться";
    const status = message.startsWith("Слишком много") ? 429 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
