"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginPage } from "@/components/login-page";
import { useAuth } from "@/components/auth-provider";
import { HUB_PATH } from "@/lib/auth/routes";

function LoginContent() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace(HUB_PATH);
    }
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <main className="mx-auto flex min-h-screen w-[min(480px,calc(100%-32px))] items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">Загрузка...</p>
      </main>
    );
  }

  return <LoginPage />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-[min(480px,calc(100%-32px))] items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Загрузка...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
