import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth/access";
import { readSessionCookie } from "@/lib/auth/session";
import { readPassportDashboardSnapshot } from "@/lib/product-hub/passport-dashboard-store";
import type { PassportDashboardProduct } from "@/types/product-passports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function stripCogs(product: PassportDashboardProduct): PassportDashboardProduct {
  return {
    ...product,
    economy: {
      retail_price: product.economy.retail_price,
      currency: product.economy.currency,
    },
  };
}

export async function GET(request: Request) {
  const session = readSessionCookie(request.headers.get("cookie"));
  if (!session) return unauthorized();
  if (!canAccessRoute(session.accessLevel, "/products")) return forbidden();

  const snapshot = await readPassportDashboardSnapshot();
  if (!snapshot) {
    return NextResponse.json(
      {
        error: "Каталог продуктов ещё не загружен. Обновите страницу или пересоберьте снимок.",
        products: [],
      },
      { status: 404 },
    );
  }

  const canSeeCogs = session.accessLevel === "admin" || session.accessLevel === "rop";
  const products = canSeeCogs
    ? snapshot.products
    : snapshot.products.map((p) => stripCogs(p));

  return NextResponse.json({
    syncedAt: snapshot.syncedAt,
    source: snapshot.source,
    productCount: products.length,
    canSeeCogs,
    products,
  });
}
