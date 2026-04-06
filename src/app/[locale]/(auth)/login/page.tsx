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
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import { loginWithPassword, useAuth } from "@/hooks/useAuth";
import {
  loginWithPasskey,
  passkeyFallbackCodes,
  type PasskeyError,
} from "@/lib/webauthn";
import { startOAuth } from "@/lib/auth-client";
import { useToast } from "@/components/ui/toast";
import ToggleLanguage from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";

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
  const [localVersion, setLocalVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    if (initialMessage) {
      push({ variant: "success", description: initialMessage });
    }
  }, [initialMessage, push]);

  useEffect(() => {
    async function checkVersion() {
      try {
        const remoteVersionRaw = await getRemoteVersion();
        const remoteVersion =
          typeof remoteVersionRaw === "string" && remoteVersionRaw.trim()
            ? remoteVersionRaw.trim()
            : null;

        const localResponse = await fetch(LOCAL_FILE_PATH);
        if (!localResponse.ok) {
          throw new Error("Failed to fetch local version file.");
        }
        const currentVersion = (await localResponse.text()).trim();

        setLocalVersion(currentVersion || null);
        setLatestVersion(remoteVersion);

        if (remoteVersion && currentVersion && remoteVersion !== currentVersion) {
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

    const invalidCredentialsDescription = t(
      "messages.invalidCredentialsWithHashingHint"
    );

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
          } catch {
            push({ variant: "error", description: tErrors("SEND_CODE_ERROR") });
          }
          break;

        case "TWO_FACTOR_REQUIRED":
          setRequires2FA(true);
          break;

        default:
          if (result.message === "INVALID_CREDENTIALS") {
            push({
              variant: "error",
              description: invalidCredentialsDescription,
            });
            break;
          }
          if (tErrors.has(result.message as never)) {
            push({
              variant: "error",
              description: tErrors(result.message as never),
            });
            break;
          }
          push({
            variant: "error",
            description: invalidCredentialsDescription,
          });
      }
    } else {
      await refresh();
      router.push(callbackUrl);
    }

    setLoading(false);
  };

  const handleOAuthSignIn = (provider: "github") => {
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
    const mapFallback = () => {
      if (!fallback) return null;
      if (fallback === passkeyFallbackCodes.loginSecureContextRequired) {
        return tPasskeys("errors.loginSecureContextRequired");
      }
      if (fallback === passkeyFallbackCodes.loginBlocked) {
        return tPasskeys("errors.loginBlocked");
      }
      if (fallback.startsWith(`${passkeyFallbackCodes.loginRpIdMismatch}:`)) {
        const rpId = fallback.slice(
          `${passkeyFallbackCodes.loginRpIdMismatch}:`.length
        );
        return tPasskeys("errors.loginRpIdMismatch", { rpId });
      }
      if (/^[A-Z0-9_]+$/.test(fallback) && tErrors.has(fallback as never)) {
        return tErrors(fallback as never);
      }
      return null;
    };
    const fallbackMessage = mapFallback();
    switch (code) {
      case "UNSUPPORTED":
        return tPasskeys("errors.unsupported");
      case "LOGIN_START_FAILED":
        return fallbackMessage || tPasskeys("errors.startFailed");
      case "LOGIN_CANCELLED":
        return tPasskeys("errors.cancelled");
      case "LOGIN_FINISH_FAILED":
        return fallbackMessage || tPasskeys("errors.finishFailed");
      default:
        return fallbackMessage || tPasskeys("errors.generic");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
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

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <ToggleLanguage compact />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-12">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden rounded-2xl border bg-card/80 p-8 backdrop-blur-sm lg:block">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-2xl border border-primary/30 bg-card shadow-sm shadow-primary/25">
                <Image
                  src="/logos/vestri/vestri_transparent.svg"
                  alt="Vestri logo"
                  width={58}
                  height={58}
                  className="size-14 object-contain dark:invert dark:brightness-125"
                  priority
                />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.24em] text-primary">
                  {t("marketing.kicker")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("marketing.subtitle")}
                </p>
              </div>
            </div>
            <h2 className="text-3xl font-semibold leading-tight">
              {t("marketing.headline")}
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("marketing.body")}
            </p>
          </section>

          <Card className="mx-auto w-full max-w-md p-4 space-y-4 shadow-lg rounded-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-2xl border bg-card shadow-xs">
                <Image
                  src="/logos/vestri/vestri_transparent.svg"
                  alt="Vestri logo"
                  width={50}
                  height={50}
                  className="size-12 object-contain dark:invert dark:brightness-125"
                  priority
                />
              </div>
              <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>

              {isOutdated && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  ⚠️{" "}
                  {t.rich("messages.versionOutdated", {
                    currentVersion: localVersion || t("messages.unknownVersion"),
                    latestVersion: latestVersion || t("messages.unknownVersion"),
                    link: (chunks) => (
                      <Link
                        href="https://github.com/dhernos/auth_template"
                        target="_blank"
                        className="text-primary underline"
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
                      <span className="sr-only">{t("form.togglePassword")}</span>
                    </Button>
                  </div>
                </div>

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
                    className="text-sm font-medium text-primary hover:text-primary/80 cursor-pointer"
                  >
                    {t("form.forgotPassword")}
                  </button>
                </div>

                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? t("form.loadingButton") : t("form.loginButton")}
                </Button>

                <Button
                  className="mt-3 w-full"
                  type="button"
                  variant="outline"
                  disabled={passkeyLoading || loading || !email}
                  onClick={handlePasskeyLogin}
                >
                  {passkeyLoading ? t("passkeys.loading") : t("passkeys.button")}
                </Button>
              </form>

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
                  alt={t("form.githubIconAlt")}
                  height={4}
                  width={4}
                  className="mr-2 h-4 w-4 dark:invert dark:brightness-125"
                />
                {t("form.githubButton")}
              </Button>

              <p className="mt-6 text-center text-sm">
                {t.rich("footer.noAccount", {
                  registerLink: (chunks) => (
                    <Link
                      href="/register"
                      className="font-medium text-primary hover:text-primary/80"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ForgotPasswordDialog
        isOpen={isForgotPasswordDialogOpen}
        onClose={() => setIsForgotPasswordDialogOpen(false)}
      />
    </div>
  );
}
