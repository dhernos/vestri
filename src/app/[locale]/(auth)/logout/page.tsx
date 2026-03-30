"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";

export default function LogOut() {
  const router = useRouter();
  const t = useTranslations("LogoutPage");
  const { data: session, logout } = useAuth();
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: sessionId }),
      });
      if (!res.ok && res.status !== 401 && res.status !== 404) {
        return;
      }
    } catch {
      return;
    }
  };
  useEffect(() => {
    const callbackUrl = "/login";
    const run = async () => {
      if (session?.user.sessionId) {
        await handleDeleteSession(session.user.sessionId);
      }
      await logout();
      router.push(callbackUrl);
    };
    void run();
  }, [router, session, t, logout]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-xl">{t("loggingOutMessage")}</h1>
    </div>
  );
}
