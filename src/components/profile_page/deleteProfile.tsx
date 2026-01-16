"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";

export default function DeleteProfileSection() {
  const { data: session, logout } = useAuth();
  const { push } = useToast();

  const t = useTranslations("DeleteProfile");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");

  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [actionToProtect, setActionToProtect] = useState<
    "deleteAccount" | null // 'disable2FA' hinzugefügt
  >(null);

  // Funktion zur Zurücksetzung der Nachrichten und Fehler
  // --- NEU: Handler für Konto löschen (Verwendung des Modals) ---
  const handleDeleteAccount = async () => {

    // Prüfen, ob 2FA aktiviert ist
    if (!session?.user.isTwoFactorEnabled) {
      // Wenn 2FA NICHT aktiv ist, nur eine Standard-Bestätigung anzeigen
      if (confirm(t("confirmDeleteAccount"))) {
        const errorMessage = await handleFinalDeleteAccount(null);
        if (errorMessage) {
          push({ variant: "error", description: errorMessage });
        }
      }
    } else {
      // Wenn 2FA aktiv ist, Modal anzeigen
      if (session?.user.twoFactorMethod === "email" && session.user.email) {
        fetch("/api/two-factor/send-email-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: session.user.email }),
        }).catch(() => {});
      }
      setActionToProtect("deleteAccount");
      setIs2FAModalOpen(true);
    }
  };

  // --- NEU: Callback für die geschützte Aktion (Kontolöschung) ---
  // Wird vom TwoFactorModal.tsx aufgerufen
  const handleFinalDeleteAccount = async (
    code: string | null
  ): Promise<string | null> => {

    try {
      const res = await fetch("/api/profile/delete-account", {
        method: "DELETE", // Verwenden Sie DELETE für REST-Konformität (oder POST mit Body)
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          // Der Code wird nur gesendet, wenn 2FA aktiviert ist und vom Modal übergeben wurde
          ...(code && { totpCode: code }),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Erfolg: Benutzer ausloggen
        const description = data.message || t("errors.accountDeleteError");
        push({
          variant: data.message ? "success" : "error",
          description,
        });
        await logout();
        return null; // Kein Fehler
      } else {
        // Fehler, z.B. falscher 2FA-Code
        return data.message || t("errors.accountDeleteError");
      }
    } catch (err) {
      console.error(err);
      return tErrors("UNEXPECTED_ERROR");
    } finally {
      setIs2FAModalOpen(false); // Modal schließen
      setActionToProtect(null);
    }
  };

  return (
    <div>
      {/* 2FA Modal für kritische Aktionen (Kontolöschung) */}
      <TwoFactorModal
        mode="stepup"
        isOpen={is2FAModalOpen && actionToProtect === "deleteAccount"}
        onClose={() => setIs2FAModalOpen(false)}
        onVerify={handleFinalDeleteAccount}
        actionLabel={tCommon("buttons.deleteAccount")}
      />
      {/* Sektion für Konto löschen (Danger Zone) */}
      <section className="mb-8 p-6 border rounded-lg shadow-md outline-red-700">
        <h2 className="text-2xl font-semibold mb-4 text-red-700">
          {t("dangerZone")}
        </h2>
        <p className="mb-4">{t("dangerZoneDescription")}</p>
        <Button
          onClick={handleDeleteAccount}
          className="cursor-pointer"
          variant="destructive"
        >
          {tCommon("buttons.deleteAccount")}
        </Button>
      </section>
    </div>
  );
}
