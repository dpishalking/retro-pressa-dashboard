"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { canAccessRoute } from "@/lib/auth/access";
import { HUB_PATH } from "@/lib/auth/routes";

export function OfficeHubHomeButton() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "/";

  if (loading || !user) return null;
  if (!canAccessRoute(user.accessLevel, HUB_PATH)) return null;
  if (pathname === "/" || pathname === HUB_PATH) return null;

  return (
    <Link href={HUB_PATH} className="office-hub-home-btn" aria-label="В рабочий кабинет">
      <LayoutGrid size={16} aria-hidden />
      <span>Рабочий кабинет</span>
    </Link>
  );
}
