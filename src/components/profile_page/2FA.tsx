"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";
import { sendStepUpEmailCode } from "@/lib/step-up";

export default function TwoFactorAuthSection() {
  const { data: session, refresh } = useAuth();
  const { push } = useToast();

  const t = useTranslations("2FA");
  const tCommon = useTranslations("Common"); // <-- NEU: gemeinsame Buttons / Texte
  const tErrors = useTranslations("Errors");

  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false); // Modal für kritische Aktionen (z.B. Löschen, 2FA Deaktivieren)
  const [is2FASetupModalOpen, setIs2FASetupModalOpen] = useState(false); // Modal für 2FA-Einrichtung
  const [setupMethod, setSetupMethod] = useState<"app" | "email" | null>(null); // Gewählte Methode
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null); // Base64 QR Code URL
  const [setupSecret, setSetupSecret] = useState<string | null>(null); // Temporärer Secret Key
  const [setupCode, setSetupCode] = useState(""); // Code für die initiale Verifizierung
  const [actionToProtect, setActionToProtect] = useState<
    "disable2FA" | null // 'disable2FA' hinzugefügt
  >(null);

  // Funktion zur Zurücksetzung der Nachrichten und Fehler
  // --- NEU: Handler für 2FA-Setup starten ---
  const handleStart2FASetup = async (method: "app" | "email") => {
    setSetupMethod(method);
    setQrCodeUrl(null);
    setSetupSecret(null);
    setSetupCode("");
    setIs2FASetupModalOpen(true);

    try {
      const res = await fetch("/api/two-factor/setup-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ method }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(t("setupError"));
      }

      if (method === "app" && data.qrCodeUrl && data.secret) {
        setQrCodeUrl(data.qrCodeUrl);
        setSetupSecret(data.secret);
      } else if (method === "email") {
        push({
          variant: "success",
          description: t("emailCodeSent"),
        });
      }
    } catch (err) {
      push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
      setIs2FASetupModalOpen(false);
      console.error(err);
    }
  };

  // --- NEU: Handler für 2FA-Aktivierung abschließen ---
  const handleFinalize2FA = async (e: FormEvent) => {
    e.preventDefault();

    if (setupMethod === "app" && (!setupSecret || !setupCode)) {
      push({ variant: "error", description: t("missingCodeOrSecret") });
      return;
    }

    if (setupMethod === "email" && !setupCode) {
      push({ variant: "error", description: t("missingCode") });
      return;
    }

    try {
      const res = await fetch("/api/two-factor/setup-finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          method: setupMethod,
          code: setupCode,
        }),
      });

      if (res.ok) {
        push({
          variant: "success",
          description: t("activationSuccess"),
        });
        await refresh();
        setIs2FASetupModalOpen(false);
        setSetupCode("");
      } else {
        push({
          variant: "error",
          description: t("activationFailed"),
        });
      }
    } catch (err) {
      push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
      console.error(err);
    }
  };

  // --- NEU: Callback für die geschützte Aktion (2FA Deaktivierung) ---
  // Wird vom TwoFactorModal.tsx aufgerufen
  const handleFinalDisable2FA = async (
    code: string | null
  ): Promise<string | null> => {
    if (!code) {
      return t("missingCode");
    }

    try {
      const res = await fetch("/api/two-factor/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ totpCode: code }), // 2FA-Code senden
      });

      if (res.ok) {
        push({
          variant: "success",
          description: t("disableSuccess"),
        });
        await refresh();
        return null;
      } else {
        // Fehler, z.B. falscher 2FA-Code
        return t("disableFailed");
      }
    } catch (err) {
      console.error(err);
      return tErrors("UNEXPECTED_ERROR");
    } finally {
      setIs2FAModalOpen(false); // Modal schließen
      setActionToProtect(null);
    }
  };

  // --- NEU: Handler für 2FA deaktivieren (Startet den Schutz-Flow) ---
  const handleDisable2FA = () => {
    if (!session?.user.isTwoFactorEnabled) {
      push({ variant: "error", description: t("notEnabledError") });
      return;
    }

    void sendStepUpEmailCode(session?.user);

    // Öffne das Modal und setze die zu schützende Aktion
    setActionToProtect("disable2FA");
    setIs2FAModalOpen(true);
  };
  const setupTitle = setupMethod ? t(`setupTitle.${setupMethod}`) : "";
  const setupDescription =
    setupMethod === "app"
      ? t("setupAppDescription")
      : setupMethod === "email"
        ? t("setupEmailDescription")
        : "";
  return (
    <div>
      {/* 2FA Modal für kritische Aktionen (2FA Deaktivieren) */}
      <TwoFactorModal
        mode="stepup"
        isOpen={is2FAModalOpen && actionToProtect === "disable2FA"}
        onClose={() => setIs2FAModalOpen(false)}
        onVerify={handleFinalDisable2FA}
        actionLabel={t("buttons.disableButton")}
      />

      <section className="mb-8 p-6 border rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 flex items-center space-x-2">
          <Shield className="h-6 w-6 text-primary" />
          <span>{t("header")}</span>
        </h2>

        <p className="mb-4">
          {t("status")}:{" "}
          <span
            className={`font-bold ${
              session?.user.isTwoFactorEnabled
                ? "text-success"
                : "text-destructive"
            }`}
          >
            {session?.user.isTwoFactorEnabled ? t("enabled") : t("disabled")}
          </span>
          {session?.user.isTwoFactorEnabled && (
            <span>
              {" "}
              (
              {session?.user.twoFactorMethod === "app"
                ? t("methodApp")
                : t("methodEmail")}
              )
            </span>
          )}
        </p>

        {session?.user.isTwoFactorEnabled ? (
          <Button
            onClick={handleDisable2FA}
            className="cursor-pointer"
            variant="destructive"
          >
            {tCommon("buttons.disableButton")}
          </Button>
        ) : (
          <div className="flex space-x-4">
            <Button
              onClick={() => handleStart2FASetup("app")}
              className="bg-info text-info-foreground hover:bg-info/90 font-bold py-2 px-4 rounded cursor-pointer"
            >
              {tCommon("buttons.enableAppButton")}
            </Button>
            <Button
              onClick={() => handleStart2FASetup("email")}
              className="bg-warning text-warning-foreground hover:bg-warning/90 font-bold py-2 px-4 rounded cursor-pointer"
            >
              {tCommon("buttons.enableEmailButton")}
            </Button>
          </div>
        )}

        {/* 2FA SETUP MODAL */}
        <Dialog
          open={is2FASetupModalOpen && !session?.user.isTwoFactorEnabled}
          onOpenChange={setIs2FASetupModalOpen}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{setupTitle}</DialogTitle>
              <DialogDescription>{setupDescription}</DialogDescription>
            </DialogHeader>

            {/* QR Code Anzeige nur für App-Methode */}
            {setupMethod === "app" && qrCodeUrl && (
              <div className="text-center p-4">
                <Image
                  src={qrCodeUrl}
                  alt={t("qrCodeAlt")}
                  width={200}
                  height={200}
                  className="mx-auto border p-2"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("scanInstruction")}
                </p>
                <p className="mt-1 font-mono text-xs break-all">
                  {t("secretLabel", { secret: setupSecret || "" })}
                </p>
              </div>
            )}
            {/* Hinweis für E-Mail-Code */}
            <form onSubmit={handleFinalize2FA}>
              <div className="grid gap-4 py-4">
                <Input
                  id="setupCode"
                  placeholder={t("codePlaceholder")}
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  required
                  className="text-center text-xl tracking-[0.5em]"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIs2FASetupModalOpen(false)}
                  type="button"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/85 font-bold py-2 px-4 rounded cursor-pointer"
                >
                  {tCommon("buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded cursor-pointer"
                >
                  {tCommon("buttons.activateButton")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
