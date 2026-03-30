"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";
import { prepareStepUpCode } from "@/lib/step-up";

export default function DeleteProfileSection() {
  const { data: session, logout } = useAuth();
  const { push } = useToast();

  const t = useTranslations("DeleteProfile");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const stepUpPurpose = "account_delete";

  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

  const mapErrorCode = (code: unknown) => {
    if (typeof code !== "string" || !/^[A-Z0-9_]+$/.test(code)) {
      return null;
    }
    if (tErrors.has(code as never)) {
      return tErrors(code as never);
    }
    return null;
  };

  const executeDeleteAccount = async () => {
    try {
      const res = await fetch("/api/profile/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        push({
          variant: "success",
          description: t("messages.accountDeleted"),
        });
        await logout();
        return { kind: "ok" as const };
      }

      const apiCode = data?.message || data?.error;
      if (res.status === 403 && apiCode === "STEP_UP_REQUIRED") {
        return { kind: "stepup" as const };
      }

      return {
        kind: "error" as const,
        message: mapErrorCode(apiCode) || t("errors.accountDeleteError"),
      };
    } catch (err) {
      console.error(err);
      return {
        kind: "error" as const,
        message: tErrors("UNEXPECTED_ERROR"),
      };
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm(t("confirmDeleteAccount"))) {
      return;
    }

    const result = await executeDeleteAccount();
    if (result.kind === "ok") {
      return;
    }

    if (result.kind === "stepup") {
      const stepUp = await prepareStepUpCode(session?.user, stepUpPurpose);
      if (!stepUp.ok) {
        const description =
          stepUp.code && tErrors.has(stepUp.code as never)
            ? tErrors(stepUp.code as never)
            : tErrors("SEND_CODE_ERROR");
        push({ variant: "error", description });
        return;
      }
      setIs2FAModalOpen(true);
      push({
        variant: "error",
        description: t("errors.accountDeleteStepUpRequired"),
      });
      return;
    }

    push({ variant: "error", description: result.message });
  };

  return (
    <div>
      {/* 2FA Modal für kritische Aktionen (Kontolöschung) */}
      <TwoFactorModal
        mode="stepup"
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
        purpose={stepUpPurpose}
        actionLabel={tCommon("buttons.deleteAccount")}
        onSuccess={async () => {
          setIs2FAModalOpen(false);
          const result = await executeDeleteAccount();
          if (result.kind === "ok") {
            return;
          }
          if (result.kind === "stepup") {
            push({
              variant: "error",
              description: t("errors.accountDeleteStepUpRequired"),
            });
            setIs2FAModalOpen(true);
            return;
          }
          push({ variant: "error", description: result.message });
        }}
      />
      {/* Sektion für Konto löschen (Danger Zone) */}
      <section className="mb-8 p-6 border border-destructive/35 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-destructive">
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
