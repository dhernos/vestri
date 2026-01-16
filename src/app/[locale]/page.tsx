// src/app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SessionTTL from "@/components/profile_page/SessionTTL";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import ToggleLanguage from "@/components/language-toggle";

// Define a type for the additional session data we're fetching from the backend
interface SessionInfo {
  expires: string;
  loginTime: string;
  role: string;
  ttlInSeconds: number;
}

export default function Home() {
  const { data: session, status, logout } = useAuth();
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const { push } = useToast();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSessionInfo, setLoadingSessionInfo] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  // Handle session errors that the JWT callback might set
  useEffect(() => {
    if (session?.error) {
      push({ variant: "error", description: t("errors.invalidSession") });
    }
  }, [session, t, push]);

  // Debounce loading state to avoid flicker on fast transitions
  useEffect(() => {
    if (status === "loading") {
      const timer = setTimeout(() => setShowLoading(true), 200);
      return () => clearTimeout(timer);
    }
    setShowLoading(false);
  }, [status]);

  // Function to fetch the session details from your new API
  // This would get the actual TTLs from Redis
  const fetchSessionDetails = async () => {
    setLoadingSessionInfo(true);
    try {
      const response = await fetch("/api/sessions/current", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to retrieve session details.");
      }
      const data = await response.json();
      setSessionInfo(data);
      console.log(data);
    } catch (err) {
      console.error(err);
      push({ variant: "error", description: t("errors.sessionDetails") });
    } finally {
      setLoadingSessionInfo(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
  };

  if (status === "loading" && showLoading) {
    return <p className="p-8 text-center">{tCommon("loading")}</p>;
  }

  if (status === "loading") {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      {/* Language Switcher */}
      <ToggleLanguage />
      <h1 className="mb-8 text-4xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-lg text-center max-w-2xl">{t("subtitle")}</p>

      {session ? (
        <div className="rounded-lg p-8 shadow-md text-center max-w-xl w-full">
          <p className="mb-4 text-lg">
            {t("session.loggedInAs")}{" "}
            <span className="font-semibold">{session.user?.email}</span>
            {session.user?.role && (
              <span className="ml-2 text-sm">
                {t("session.roleLabel", { role: session.user.role })}
              </span>
            )}
          </p>

          {/* Buttons to fetch and display the Redis session information */}
          <div className="mt-6">
            <h2 className="mb-2 text-xl font-bold">
              {t("session.detailsTitle")}
            </h2>
            <button
              onClick={fetchSessionDetails}
              disabled={loadingSessionInfo}
              className="rounded-md bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
            >
              {loadingSessionInfo
                ? t("session.detailsLoading")
                : t("session.detailsCta")}
            </button>

            {sessionInfo && (
              <div className="mt-4 p-4 rounded-md text-left border border-gray-200">
                <p>
                  <span className="font-semibold">
                    {t("session.loginTime")}
                  </span>{" "}
                  {new Date(sessionInfo.loginTime).toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold">
                    {t("session.expiresAt")}
                  </span>{" "}
                  {new Date(
                    sessionInfo.expires || sessionInfo.expires
                  ).toLocaleString()}
                </p>
                <SessionTTL
                  ttlInSeconds={
                    sessionInfo.ttlInSeconds ??
                    (sessionInfo as any).ttlSeconds ??
                    0
                  }
                />
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="mt-6 rounded-md bg-red-500 px-6 py-3 font-bold text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 cursor-pointer"
          >
            {t("session.signOut")}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="mb-4 text-lg">{t("cta.notLoggedIn")}</p>
          <Link
            href="/login"
            className="rounded-md bg-blue-500 px-6 py-3 font-bold text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 cursor-pointer"
          >
            {t("cta.login")}
          </Link>
          <Link
            href="/register"
            className="ml-4 rounded-md bg-purple-500 px-6 py-3 font-bold text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 cursor-pointer"
          >
            {t("cta.register")}
          </Link>
        </div>
      )}
    </div>
  );
}
