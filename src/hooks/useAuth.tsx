"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchSession,
  logout as apiLogout,
  GoSession,
  GoUser,
} from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  data: GoSession | null;
  status: AuthStatus;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<GoUser>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<GoSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setStatus("loading");
    }
    const s = await fetchSession();
    setSession(s);
    setStatus(s ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const updateUser = useCallback((patch: Partial<GoUser>) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        user: {
          ...prev.user,
          ...patch,
        },
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      data: session,
      status,
      refresh: load,
      logout: handleLogout,
      updateUser,
    }),
    [session, status, load, handleLogout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

export { loginWithPassword } from "@/lib/auth-client";
