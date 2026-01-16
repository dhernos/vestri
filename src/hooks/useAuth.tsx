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
  loginWithPassword,
  logout as apiLogout,
  GoSession,
} from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  data: GoSession | null;
  status: AuthStatus;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<GoSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const load = useCallback(async () => {
    setStatus("loading");
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

  const value = useMemo(
    () => ({
      data: session,
      status,
      refresh: load,
      logout: handleLogout,
    }),
    [session, status, load, handleLogout]
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
