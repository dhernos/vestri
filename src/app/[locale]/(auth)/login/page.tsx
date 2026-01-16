"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/forgot-password-dialog";
import { getRemoteVersion } from "@/actions/version";
import Image from "next/image";
import { useTheme } from "next-themes";
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import { loginWithPassword, useAuth } from "@/hooks/useAuth";
import { loginWithPasskey, type PasskeyError } from "@/lib/webauthn";
import { startOAuth } from "@/lib/auth-client";
import { useToast } from "@/components/ui/toast";

const stripLocalePrefix = (target: string, locale: string) => {
  if (!target || !target.startsWith("/")) {
    return target;
  }
  const match = target.match(/^([^?#]+)(.*)$/);
  const path = match ? match[1] : target;
  const suffix = match ? match[2] : "";
  const prefix = `/${locale}`;
  if (path === prefix) {
    return `/${suffix}`;
  }
  if (path.startsWith(`${prefix}/`)) {
    return `${path.slice(prefix.length)}${suffix}`;
  }
  return target;
};

export default function LoginPage() {
  const t = useTranslations("Login");
  const tErrors = useTranslations("Errors");
  const tPasskeys = useTranslations("Passkeys");
  const locale = useLocale();
  const { push } = useToast();

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLocale = locale || "en";
  const rawCallbackUrl =
    searchParams.get("callbackUrl") || `/${activeLocale}/dashboard`;
  const callbackUrl = stripLocalePrefix(rawCallbackUrl, activeLocale);
  const { refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const [isForgotPasswordDialogOpen, setIsForgotPasswordDialogOpen] =
    useState(false);

  const signupSuccess = searchParams.get("signupSuccess");
  const verificationSuccess = searchParams.get("verificationSuccess");

  const [requires2FA, setRequires2FA] = useState(false);

  const initialMessage = signupSuccess
    ? t("messages.signupSuccess")
    : verificationSuccess
    ? t("messages.verificationSuccess")
    : null;

  const LOCAL_FILE_PATH = "/version.txt";
  const [isOutdated, setIsOutdated] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialMessage) {
      push({ variant: "success", description: initialMessage });
    }
  }, [initialMessage, push]);

  useEffect(() => {
    async function checkVersion() {
      let localVersion = "";
      const remoteVersion = await getRemoteVersion();

      try {
        const localResponse = await fetch(LOCAL_FILE_PATH);
        if (!localResponse.ok) {
          throw new Error("Failed to fetch local version file.");
        }
        localVersion = (await localResponse.text()).trim();

        if (remoteVersion !== localVersion) {
          setIsOutdated(true);
        }
      } catch (error) {
        console.error("Failed to perform version check:", error);
      }
    }

    checkVersion();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await loginWithPassword(
      email,
      password,
      undefined,
      rememberMe
    );

    if (!result.ok) {
      switch (result.message) {
        case "IP_BANNED":
          push({ variant: "error", description: tErrors("IP_BANNED") });
          break;

        case "EMAIL_NOT_VERIFIED":
          try {
            const response = await fetch("/api/resend-verification", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            await response.json();
            if (response.ok) {
              router.push(`/verify-email?email=${encodeURIComponent(email)}`);
            } else {
              push({
                variant: "error",
                description: tErrors("SEND_CODE_ERROR"),
              });
            }
          } catch (err) {
            push({ variant: "error", description: tErrors("SEND_CODE_ERROR") });
          }
          break;

        case "TWO_FACTOR_REQUIRED":
          setRequires2FA(true);
          break;

        default:
          push({
            variant: "error",
            description: tErrors("INVALID_CREDENTIALS"),
          });
      }
    } else {
      await refresh();
      router.push(callbackUrl);
    }

    setLoading(false);
  };

  const handleOAuthSignIn = (provider: "github" | "discord") => {
    setLoading(false);
    startOAuth(provider, rawCallbackUrl);
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    const result = await loginWithPasskey(email);
    if (!result.ok) {
      push({
        variant: "error",
        description: mapPasskeyError(result.error, result.fallback),
      });
      setPasskeyLoading(false);
      return;
    }
    await refresh();
    router.push(callbackUrl);
    setPasskeyLoading(false);
  };

  const mapPasskeyError = (code: PasskeyError, fallback?: string) => {
    switch (code) {
      case "UNSUPPORTED":
        return tPasskeys("errors.unsupported");
      case "LOGIN_START_FAILED":
        return fallback || tPasskeys("errors.startFailed");
      case "LOGIN_CANCELLED":
        return tPasskeys("errors.cancelled");
      case "LOGIN_FINISH_FAILED":
        return fallback || tPasskeys("errors.finishFailed");
      default:
        return fallback || tPasskeys("errors.generic");
    }
  };

  return (
    <div>
      {/* ------------------ 2FA MODAL ------------------ */}
      <TwoFactorModal
        mode="login"
        isOpen={requires2FA}
        onClose={() => setRequires2FA(false)}
        email={email}
        password={password}
        actionLabel={t("form.loginButton")}
        onSuccess={async () => {
          await refresh();
          router.push(callbackUrl);
        }}
      />

      {/* ------------------ LOGIN FORM ------------------ */}
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-auto p-4 space-y-4 shadow-lg rounded-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>

            {isOutdated && (
              <div
                style={{
                  color: "red",
                  border: "1px solid red",
                  padding: "10px",
                }}
              >
                ⚠️{" "}
                {t.rich("messages.versionOutdated", {
                  link: (chunks) => (
                    <Link
                      href="https://github.com/dhernos/auth_template"
                      target="_blank"
                      className="text-blue-500 underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit}>
              {/* EMAIL */}
              <div className="mb-4">
                <label htmlFor="email" className="mb-2 block text-sm font-bold">
                  {t("form.emailLabel")}
                </label>
                <Input
                  id="email"
                  type="email"
                  className="w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* PASSWORD */}
              <div className="mb-6">
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold"
                >
                  {t("form.passwordLabel")}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-1 right-1 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* REMEMBER / FORGOT */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    className="mr-2 h-4 w-4 cursor-pointer"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm cursor-pointer"
                  >
                    {t("form.rememberMe")}
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setIsForgotPasswordDialogOpen(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500 cursor-pointer"
                >
                  {t("form.forgotPassword")}
                </button>
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? t("form.loadingButton") : t("form.loginButton")}
              </Button>

              <Button
                className="w-full mt-3"
                type="button"
                variant="outline"
                disabled={passkeyLoading || loading || !email}
                onClick={handlePasskeyLogin}
              >
                {passkeyLoading ? t("passkeys.loading") : t("passkeys.button")}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t("form.orContinueWith")}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn("github")}
              disabled={loading}
            >
              <Image
                src="/logos/github.svg"
                alt="GitHub"
                height={4}
                width={4}
                className="mr-2 h-4 w-4"
              />
              {t("form.githubButton")}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn("discord")}
              disabled={loading}
            >
              <Image
                src={
                  mounted && resolvedTheme === "dark"
                    ? "/logos/discord-white.svg"
                    : "/logos/discord.svg"
                }
                alt="Discord"
                height={4}
                width={4}
                className="mr-2 h-4 w-4"
              />
              {t("form.discordButton")}
            </Button>

            <p className="mt-6 text-center text-sm">
              {t.rich("footer.noAccount", {
                registerLink: (chunks) => (
                  <Link
                    href="/register"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </CardContent>
        </Card>

        <ForgotPasswordDialog
          isOpen={isForgotPasswordDialogOpen}
          onClose={() => setIsForgotPasswordDialogOpen(false)}
        />
      </div>
    </div>
  );
}
