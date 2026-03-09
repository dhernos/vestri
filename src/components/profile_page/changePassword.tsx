"use client";

import { useState, FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "@/components/ui/eye_icon";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation"; // <-- neu: für clientseitige Redirects
import { useAuth } from "@/hooks/useAuth";
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import { useToast } from "@/components/ui/toast";

export default function ChangePasswordSection() {
  const { status, data: sessData, logout } = useAuth();
  const oauthLinked = sessData?.user?.oauthLinked ?? false;
  const hasPassword = sessData?.user?.hasPassword ?? true; // default true
  const { push } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const validatePassword = (password: string) => {
    let strength = 0;
    if (password.length > 7) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/\d/.test(password)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const t = useTranslations("ChangePassword");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const tMessages = useTranslations("Messages");

  const router = useRouter();
  const [loading, setLoading] = useState(false); // startet false, sonst ist Button immer disabled
  const [needsStepUp, setNeedsStepUp] = useState(false);

  useEffect(() => {
    setPasswordStrength(validatePassword(newPassword));
  }, [newPassword]);

  if (status === "loading") {
    return <p>{tCommon("loading")}</p>;
  }

  // Wenn Nutzer per OAuth angemeldet ist: Sektion deaktiviert anzeigen
  if (oauthLinked || !hasPassword) {
    return (
      <section className="mb-8 p-6 border rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">{t("changePassword")}</h2>
        <p className="text-sm mb-4">{t("changePasswordDescription")}</p>
        <div className="p-3 mb-4 bg-yellow-50 text-yellow-800 rounded-md">
          {t("oauthAccount.cannotChangePassword")}
        </div>
        <div className="space-y-4">
          <input
            className="w-full p-2 border rounded-md"
            disabled
            placeholder="********"
          />
          <input
            className="w-full p-2 border rounded-md"
            disabled
            placeholder="********"
          />
          <Button disabled className="opacity-50 cursor-not-allowed">
            {t("buttons.changePassword")}
          </Button>
        </div>
      </section>
    );
  }

  // Funktion zur Zurücksetzung der Nachrichten und Fehler
  // --- Handler für Passwortänderung ---
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    setLoading(true);
    // ... (Logik unverändert)
    if (passwordStrength < 5) {
      push({ variant: "error", description: tErrors("PASSWORD_TOO_WEAK") }); // Lokalisierte Fehlermeldung (bereits existierend)
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        push({
          variant: "success",
          description: tMessages("PASSWORD_CHANGED"),
        });
        setCurrentPassword("");
        setNewPassword("");
        // Falls API einen Redirect-Pfad zurückliefert, clientseitig navigieren
        if (data.redirect) {
          await logout();
          router.push(data.redirect);
          return;
        }
      } else {
        if (res.status === 403 && data.message === "STEP_UP_REQUIRED") {
          if (
            sessData?.user?.twoFactorMethod === "email" &&
            sessData?.user?.email
          ) {
            await fetch("/api/two-factor/send-email-code", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ email: sessData.user.email }),
            }).catch(() => {});
          }
          setNeedsStepUp(true);
        } else {
          push({
            variant: "error",
            description: t("messages.passwordChangeError"),
          });
        }
      }
    } catch (err) {
      push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
      console.error(err);
    } finally {
      // loading immer zurücksetzen
      setLoading(false);
    }
  };

  const getStrengthColor = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return "bg-red-500"; // Schwach (Rot)
      case 2:
      case 3:
      case 4:
        return "bg-yellow-500"; // Moderat (Gelb)
      case 5:
        return "bg-green-500"; // Stark (Grün)
      default:
        return "bg-gray-200";
    }
  };

  const getStrengthWidth = (strength: number) => {
    return `${(strength / 5) * 100}%`;
  };

  const isFormValid =
    newPassword.length > 0 &&
    currentPassword.length > 0 &&
    passwordStrength === 5;

  return (
    <div>
      {/* Sektion für Passwortänderung */}
      <section className="mb-8 p-6 border rounded-lg shadow-md">
        <TwoFactorModal
          isOpen={needsStepUp}
          onClose={() => setNeedsStepUp(false)}
          mode="stepup"
          purpose="password_change"
          actionLabel={t("changePassword")}
          onSuccess={() => {
            setNeedsStepUp(false);
            // retry after successful step-up
            const fakeEvent = { preventDefault() {} } as unknown as FormEvent;
            handleChangePassword(fakeEvent);
          }}
        />
        <h2 className="text-2xl font-semibold mb-4">{t("changePassword")}</h2>
        <p className="text-sm mb-4">{t("changePasswordDescription")}</p>
        <form onSubmit={handleChangePassword}>
          <div className="max-w-90">
            <div className="mb-4">
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium"
              >
                {t("currentPassword")}
              </label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1 p-2 w-full border rounded-md"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-1 right-1 h-7 w-7 cursor-pointer"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  type="button"
                >
                  {showCurrentPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                  <span className="sr-only">{t("form.togglePassword")}</span>
                </Button>
              </div>
            </div>
            <div className="mb-4">
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium"
              >
                {t("newPassword")}
              </label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1 p-2 w-full border rounded-md"
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
              {newPassword.length > 0 && (
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
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded cursor-pointer"
              disabled={loading || !isFormValid}
            >
              {t("buttons.changePassword")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
