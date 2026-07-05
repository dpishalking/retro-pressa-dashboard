"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import type { TrainingUser } from "@/types/training";

type TrainingContextValue = {
  user: TrainingUser | null;
  isAdmin: boolean;
  isSupervisor: boolean;
  loading: boolean;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

function appUserToTrainingUser(appUser: { id: string; name: string }): TrainingUser {
  return {
    id: appUser.id,
    name: appUser.name,
    role: "manager"
  };
}

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { user: appUser, loading } = useAuth();

  const user = useMemo(() => (appUser ? appUserToTrainingUser(appUser) : null), [appUser]);
  const isAdmin = appUser?.accessLevel === "admin";
  const isSupervisor = isAdmin || appUser?.accessLevel === "rop";

  return (
    <TrainingContext.Provider value={{ user, isAdmin, isSupervisor, loading }}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTrainingUser() {
  const context = useContext(TrainingContext);
  if (!context) throw new Error("useTrainingUser must be used within TrainingProvider");
  return context;
}
