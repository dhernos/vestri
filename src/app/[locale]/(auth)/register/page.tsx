// src/app/(auth)/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "@/components/ui/eye_icon";
import { useToast } from "@/components/ui/toast";
import ToggleLanguage from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";

// This function evaluates the strength of a password
const validatePassword = (password: string) => {
  let strength = 0;
  if (password.length > 7) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/\d/.test(password)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
  return strength;
};

export default function SignUpPage() {
  // Initialisiere die Übersetzungsfunktionen
  const t = useTranslations("Register");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const { push } = useToast();

  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Updates the password strength when the password changes
  useEffect(() => {
    setPasswordStrength(validatePassword(password));
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!name || !email || !password) {
      // Lokalisierter Fehler
      push({ variant: "error", description: tErrors("ALL_FIELDS_REQUIRED") });
      setLoading(false);
      return;
    }

    if (passwordStrength < 5) {
      // Lokalisierter Fehler
      push({ variant: "error", description: tErrors("PASSWORD_TOO_WEAK") });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const emailVerificationRequired =
          data?.emailVerificationRequired ?? true;
        // Lokalisierte Erfolgsmeldung
        push({
          variant: "success",
          description: emailVerificationRequired
            ? t("messages.success")
            : t("messages.successNoVerify"),
        });

        setTimeout(() => {
          if (emailVerificationRequired) {
            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          } else {
            router.push("/login");
          }
        }, 2000);
      } else {
        // Lokalisierter Fallback-Fehler
        push({ variant: "error", description: tErrors("REGISTRATION_FAILED") });
        console.error("Registration failed:", data.message);
      }
    } catch (err) {
      console.error("Error during registration:", err);
      // Lokalisierter unerwarteter Fehler
      push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = name && email && passwordStrength === 5;

  const getStrengthColor = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return "bg-destructive";
      case 2:
      case 3:
      case 4:
        return "bg-warning";
      case 5:
        return "bg-success";
      default:
        return "bg-muted";
    }
  };

  const getStrengthWidth = (strength: number) => {
    return `${(strength / 5) * 100}%`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
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
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="name" className="mb-2 block text-sm font-bold">
                    {t("form.nameLabel")}
                  </label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="email" className="mb-2 block text-sm font-bold">
                    {t("form.emailLabel")}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="email"
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
                      name="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-1 right-1 h-7 w-7 cursor-pointer"
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

                  {password.length > 0 && (
                    <div className="mt-2 w-full">
                      <div className="mb-1 flex justify-between text-xs font-semibold">
                        <span>{t("form.passwordStrength")}</span>
                        <span>
                          {passwordStrength >= 5
                            ? t("form.strengthStrong")
                            : passwordStrength >= 2
                            ? t("form.strengthModerate")
                            : t("form.strengthWeak")}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getStrengthColor(
                            passwordStrength
                          )}`}
                          style={{ width: getStrengthWidth(passwordStrength) }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full cursor-pointer disabled:cursor-not-allowed"
                  disabled={loading || !isFormValid}
                >
                  {loading ? t("form.loadingButton") : t("form.registerButton")}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm">
                {t.rich("footer.haveAccount", {
                  loginLink: (chunks) => (
                    <Link
                      href="/login"
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
    </div>
  );
}
