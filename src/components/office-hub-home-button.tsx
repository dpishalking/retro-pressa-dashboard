"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { canAccessRoute } from "@/lib/auth/access";
import { pendingRegistrationPhrase, USER_MANAGEMENT_PATH } from "@/lib/auth/admin-users-auth";
import { HUB_PATH } from "@/lib/auth/routes";

export function OfficeHubHomeButton() {
  const { user, pendingRegistrationCount, loading } = useAuth();
  const pathname = usePathname() || "/";

  if (loading || !user) return null;
  if (!canAccessRoute(user.accessLevel, HUB_PATH)) return null;

  const showHub = pathname !== "/" && pathname !== HUB_PATH;
  const showPending =
    pendingRegistrationCount > 0 && !pathname.startsWith(USER_MANAGEMENT_PATH);

  if (!showHub && !showPending) return null;

  return (
    <>
      {showPending ? (
        <Link
          href={USER_MANAGEMENT_PATH}
          className={`office-hub-pending-btn${showHub ? "" : " office-hub-pending-btn--solo"}`}
          aria-label={pendingRegistrationPhrase(pendingRegistrationCount)}
        >
          <span className="office-hub-pending-btn__count">{pendingRegistrationCount}</span>
          <span>Заявки на доступ</span>
        </Link>
      ) : null}
      {showHub ? (
        <Link href={HUB_PATH} className="office-hub-home-btn" aria-label="В рабочий кабинет">
          <LayoutGrid size={16} aria-hidden />
          <span>Рабочий кабинет</span>
        </Link>
      ) : null}
    </>
  );
}
