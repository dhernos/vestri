// src/app/(auth)/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
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
        return "bg-red-500";
      case 2:
      case 3:
      case 4:
        return "bg-yellow-500";
      case 5:
        return "bg-green-500";
      default:
        return "bg-gray-200";
    }
  };

  const getStrengthWidth = (strength: number) => {
    return `${(strength / 5) * 100}%`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md mx-auto p-4 space-y-4 shadow-lg rounded-md">
        <CardHeader className="text-center">
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

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="w-full mt-2">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>{t("form.passwordStrength")}</span>
                    <span>
                      {passwordStrength >= 5
                        ? t("form.strengthStrong")
                        : passwordStrength >= 2
                        ? t("form.strengthModerate")
                        : t("form.strengthWeak")}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${getStrengthColor(
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
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
