"use client";

import { useRouter } from "@/i18n/navigation";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import SessionTTL from "@/components/profile_page/SessionTTL";
import { Circle, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";

interface SessionData {
  sessionId: string;
  userId: string;
  expiresAt: string;
  loginTime: string;
  role: string;
  ttlInSeconds: number;
  ipAddress: string;
  location?: string;
  userAgent: string;
  isTwoFactorEnabled?: boolean;
  twoFactorMethod?: string;
}

type SessionResponseItem = {
  sessionId?: string;
  id?: string;
  userId?: string;
  expiresAt?: string;
  expires?: string;
  loginTime?: string;
  role?: string;
  ttlInSeconds?: number;
  ttlSeconds?: number;
  ttl?: number;
  ipAddress?: string;
  ip?: string;
  location?: string;
  userAgent?: string;
  twoFactorEnabled?: boolean;
  twoFactorMethod?: string;
};

export default function AcitveSessionsSection() {
  const { data: session, status, logout } = useAuth();
  const router = useRouter();
  const { push } = useToast();

  const t = useTranslations("ActiveSessions");
  const tCommon = useTranslations("Common");

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  // Funktion zum Abrufen aktiver Sitzungen
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) {
        throw new Error(t("errors.fetchError"));
      }
      const data = (await res.json()) as { sessions?: SessionResponseItem[] };
      const normalized = (data.sessions || []).flatMap((s): SessionData[] => {
        const sessionId = s.sessionId || s.id;
        if (!sessionId) {
          return [];
        }

        return [
          {
            sessionId,
            userId: s.userId || "",
            expiresAt: s.expiresAt || s.expires || "",
            loginTime: s.loginTime || "",
            role: s.role || "USER",
            ttlInSeconds: s.ttlInSeconds ?? s.ttlSeconds ?? s.ttl ?? 0,
            ipAddress: s.ipAddress || s.ip || "-",
            location: s.location,
            userAgent: s.userAgent || "-",
            isTwoFactorEnabled: s.twoFactorEnabled,
            twoFactorMethod: s.twoFactorMethod,
          },
        ];
      });
      setSessions(normalized);
    } catch (err: unknown) {
      push({ variant: "error", description: t("errors.fetchError") });
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [push, t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  if (status === "loading" || loading) {
    return <p>{tCommon("loading")}</p>;
  }

  // Funktion zur Zurücksetzung der Nachrichten und Fehler
  // --- Handler für Session-Löschung ---
  const handleDeleteSession = async (sessionId: string) => {
    // Wenn die aktuelle Session gelöscht werden soll
    if (sessionId === session?.user.sessionId) {
      // Beim Löschen der aktuellen Session den Benutzer ausloggen
      await logout();
      router.push("/login");
      return;
    }

    // Für alle anderen Sessions: API-Aufruf
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        throw new Error(t("errors.deleteError"));
      }
      fetchSessions(); // Session-Liste neu laden
    } catch (err: unknown) {
      push({ variant: "error", description: t("errors.deleteError") });
      console.error("Delete error:", err);
    }
  };

  return (
    <div>
      {/* Sektion für aktive Sessions */}
      <section className="mb-8 p-6 border rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">{t("activeSessions")}</h2>
        <p className="mb-4">{t("activeSessionsDescription")}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.currentSession")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.role")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.loginTime")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.expiresAt")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.timeLeft")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.ipAddress")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.location")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.userAgent")}
                </th>
                <th className="py-2 px-4 border-b text-center">
                  {t("table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const isCurrentSession =
                  s.sessionId === session?.user.sessionId;
                return (
                  <tr key={s.sessionId}>
                    <td className="py-2 px-4 border-b text-center">
                      {isCurrentSession ? (
                        <Circle className="h-4 w-4 fill-success text-success mx-auto" />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 px-4 border-b text-center">{s.role}</td>
                    <td className="py-2 px-4 border-b text-center">
                      {new Date(s.loginTime).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {new Date(s.expiresAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      <SessionTTL ttlInSeconds={s.ttlInSeconds} />
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {s.ipAddress}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {s.location || t("unknownLocation")}
                    </td>
                    <td className="py-2 px-4 border-b text-center break-all">
                      {s.userAgent}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      <Button
                        onClick={() => {
                          if (isCurrentSession) {
                            router.push("/logout");
                          } else {
                            handleDeleteSession(s.sessionId);
                          }
                        }}
                        className="bg-destructive text-destructive-foreground px-3 py-1 rounded-md text-xs hover:bg-destructive/90 transition-colors cursor-pointer flex items-center justify-center mx-auto"
                      >
                        <div className="flex items-center space-x-1">
                          <LogOut className="h-3 w-3" />
                          {isCurrentSession ? (
                            <span>{t("buttons.logoutThisDevice")}</span>
                          ) : (
                            t("table.logoutButton")
                          )}
                        </div>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
