import { NextResponse } from "next/server";
import { registerPartner, type PartnerRegisterBody } from "@/lib/partners/register";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PartnerRegisterBody;
    const result = await registerPartner(body);
    return NextResponse.json(
      {
        ok: true,
        login: result.login,
        partner: result.partner,
        message: "Заявка отправлена. После одобрения вы сможете войти в кабинет."
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось зарегистрироваться";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
