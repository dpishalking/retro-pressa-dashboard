"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { trainingUsers } from "@/data/training-seed";
import type { TrainingUser } from "@/types/training";

type TrainingContextValue = {
  user: TrainingUser | null;
  users: TrainingUser[];
  setUserId: (userId: string) => void;
  isAdmin: boolean;
  loading: boolean;
  canSwitchUser: boolean;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

const STORAGE_KEY = "retro-pressa-training-user";

function appUserToTrainingUser(appUser: { id: string; name: string }): TrainingUser {
  return {
    id: appUser.id,
    name: appUser.name,
    role: "manager"
  };
}

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { user: appUser } = useAuth();
  const [users, setUsers] = useState<TrainingUser[]>(trainingUsers);
  const [userId, setUserIdState] = useState<string>(trainingUsers[0]?.id ?? "anna");
  const [loading, setLoading] = useState(true);

  const canSwitchUser = appUser?.accessLevel === "admin";

  useEffect(() => {
    if (!canSwitchUser) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setUserIdState(stored);
  }, [canSwitchUser]);

  useEffect(() => {
    fetch("/api/training/users")
      .then((response) => response.json())
      .then((data: { users: TrainingUser[] }) => {
        if (Array.isArray(data.users) && data.users.length > 0) {
          setUsers(data.users);
        }
      })
      .catch(() => {
        setUsers(trainingUsers);
      })
      .finally(() => setLoading(false));
  }, []);

  const setUserId = (nextUserId: string) => {
    if (!canSwitchUser) return;
    setUserIdState(nextUserId);
    window.localStorage.setItem(STORAGE_KEY, nextUserId);
  };

  const user = useMemo(() => {
    if (appUser?.accessLevel === "mop") {
      return appUserToTrainingUser(appUser);
    }

    if (canSwitchUser) {
      return users.find((item) => item.id === userId) ?? users[0] ?? null;
    }

    if (appUser) {
      return appUserToTrainingUser(appUser);
    }

    return users.find((item) => item.id === userId) ?? users[0] ?? null;
  }, [appUser, canSwitchUser, users, userId]);

  const isAdmin = appUser?.accessLevel === "admin";

  return (
    <TrainingContext.Provider value={{ user, users, setUserId, isAdmin, loading, canSwitchUser }}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTrainingUser() {
  const context = useContext(TrainingContext);
  if (!context) throw new Error("useTrainingUser must be used within TrainingProvider");
  return context;
}

export function UserSwitcher() {
  const { user, users, setUserId, isAdmin, canSwitchUser } = useTrainingUser();

  if (!canSwitchUser) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm font-semibold text-slate-600">
        Менеджер
        <select
          className="ml-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-slate-900"
          value={user?.id ?? ""}
          onChange={(event) => setUserId(event.target.value)}
        >
          {users
            .filter((item) => item.role !== "admin")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      {isAdmin ? (
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
          Режим администратора
        </span>
      ) : null}
    </div>
  );
}
