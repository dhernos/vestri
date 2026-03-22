//(auth)/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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

export default function ResetPasswordPage() {
  const t = useTranslations("ResetPassword");
  const tErrors = useTranslations("Errors");
  const { push } = useToast();

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Updates the password strength when the password changes
  useEffect(() => {
    setPasswordStrength(validatePassword(password));
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!token) {
      push({ variant: "error", description: tErrors("MISSING_TOKEN") }); // Lokalisierte Fehlermeldung
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      push({ variant: "error", description: tErrors("PASSWORDS_DO_NOT_MATCH") }); // Lokalisierte Fehlermeldung
      setLoading(false);
      return;
    }

    if (passwordStrength < 5) {
      push({ variant: "error", description: tErrors("PASSWORD_TOO_WEAK") }); // Lokalisierte Fehlermeldung (bereits existierend)
      setLoading(false);
      return;
    }

    const response = await fetch("/api/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
    });

    await response.json();

    if (response.ok) {
      // Wir verwenden eine lokalisierte Nachricht, falls die API keine zurückgibt
      push({ variant: "success", description: t("messages.success") });
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } else {
      // Wir verwenden eine lokalisierte Nachricht, falls die API keine zurückgibt
      push({ variant: "error", description: tErrors("RESET_FAILED") });
    }

    setLoading(false);
  };

  const getStrengthColor = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return "bg-destructive"; // Schwach (Rot)
      case 2:
      case 3:
      case 4:
        return "bg-warning"; // Moderat (Gelb)
      case 5:
        return "bg-success"; // Stark (Grün)
      default:
        return "bg-muted";
    }
  };

  const getStrengthWidth = (strength: number) => {
    return `${(strength / 5) * 100}%`;
  };

  const isFormValid =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword &&
    passwordStrength === 5;

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-4 shadow-lg rounded-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-bold"
              >
                {t("form.newPasswordLabel")}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showNewPassword ? "text" : "password"}
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
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  type="button"
                >
                  {showNewPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                  <span className="sr-only">{t("form.togglePassword")}</span>
                </Button>
              </div>

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
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-bold"
              >
                {t("form.confirmPasswordLabel")}
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-1 right-1 h-7 w-7 cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  type="button"
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                  <span className="sr-only">{t("form.togglePassword")}</span>
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={loading || !isFormValid}
            >
              {loading ? t("form.loadingButton") : t("form.resetButton")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
