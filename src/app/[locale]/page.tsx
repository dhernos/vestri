"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import SessionTTL from "@/components/profile_page/SessionTTL";
import ToggleLanguage from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";

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
  const tProfile = useTranslations("ProfilePage");
  const { push } = useToast();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSessionInfo, setLoadingSessionInfo] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (session?.error) {
      push({ variant: "error", description: t("errors.invalidSession") });
    }
  }, [session, t, push]);

  useEffect(() => {
    if (status === "loading") {
      const timer = setTimeout(() => setShowLoading(true), 200);
      return () => clearTimeout(timer);
    }
    setShowLoading(false);
  }, [status]);

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
    } catch (err) {
      console.error(err);
      push({ variant: "error", description: t("errors.sessionDetails") });
    } finally {
      setLoadingSessionInfo(false);
    }
  };

  if (status === "loading" && showLoading) {
    return <p className="p-8 text-center">{tCommon("loading")}</p>;
  }

  if (status === "loading") {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <ToggleLanguage compact />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-12">
        <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border bg-card/85 p-6 backdrop-blur-sm md:p-8">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex size-18 items-center justify-center rounded-2xl border border-primary/25 bg-card shadow-sm shadow-primary/20 md:size-20">
                <Image
                  src="/logos/vestri/vestri_transparent.svg"
                  alt="Vestri logo"
                  width={56}
                  height={56}
                  className="size-12 object-contain md:size-14 dark:invert dark:brightness-125"
                  priority
                />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-primary">
                  {t("kicker")}
                </p>
                <p className="text-sm text-muted-foreground">{t("tagline")}</p>
              </div>
            </div>

            <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              {t("subtitle")}
            </p>

            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="rounded-lg border bg-background/55 px-3 py-2">
                {t("highlights.nodeOps")}
              </div>
              <div className="rounded-lg border bg-background/55 px-3 py-2">
                {t("highlights.deployments")}
              </div>
              <div className="rounded-lg border bg-background/55 px-3 py-2">
                {t("highlights.access")}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card/88 p-6 backdrop-blur-sm">
            {session ? (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  {t("session.loggedInAs")}
                </p>
                <div className="rounded-xl border bg-background/60 p-4">
                  <p className="text-base font-semibold break-all">
                    {session.user?.email}
                  </p>
                  {session.user?.role ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("session.roleLabel", { role: session.user.role })}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button asChild>
                    <Link href="/dashboard">{t("cta.dashboard")}</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/profile">{tProfile("profilePageHeader")}</Link>
                  </Button>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/how-to">{t("cta.howTo")}</Link>
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={fetchSessionDetails}
                  disabled={loadingSessionInfo}
                >
                  {loadingSessionInfo
                    ? t("session.detailsLoading")
                    : t("session.detailsCta")}
                </Button>

                {sessionInfo ? (
                  <div className="rounded-xl border bg-background/60 p-4 text-sm">
                    <p>
                      <span className="font-semibold">{t("session.loginTime")}</span>{" "}
                      {new Date(sessionInfo.loginTime).toLocaleString()}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">{t("session.expiresAt")}</span>{" "}
                      {new Date(sessionInfo.expires).toLocaleString()}
                    </p>
                    <div className="mt-2">
                      <SessionTTL ttlInSeconds={sessionInfo.ttlInSeconds ?? 0} />
                    </div>
                  </div>
                ) : null}

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    void logout();
                  }}
                >
                  {t("session.signOut")}
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  {t("cta.notLoggedIn")}
                </p>
                <div className="rounded-xl border bg-background/60 p-4 text-sm text-muted-foreground">
                  {t("cta.preview")}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button asChild>
                    <Link href="/login">{t("cta.login")}</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/register">{t("cta.register")}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/how-to">{t("cta.howTo")}</Link>
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
