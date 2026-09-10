"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { OfficeHubHomeButton } from "@/components/office-hub-home-button";
import type { SessionUser } from "@/types/auth";

type AuthContextValue = {
  user: SessionUser | null;
  pendingRegistrationCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pendingRegistrationCount, setPendingRegistrationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        setUser(null);
        setPendingRegistrationCount(0);
        return;
      }
      const data = (await response.json()) as { user: SessionUser; pendingRegistrationCount?: number };
      setUser(data.user);
      setPendingRegistrationCount(data.pendingRegistrationCount ?? 0);
    } catch {
      setUser(null);
      setPendingRegistrationCount(0);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setPendingRegistrationCount(0);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, pendingRegistrationCount, loading, refresh, logout }}>
      {children}
      <OfficeHubHomeButton />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
