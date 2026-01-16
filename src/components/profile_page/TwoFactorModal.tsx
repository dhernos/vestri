// src/components/TwoFactorModal.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginWithPassword } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;

  mode: "login" | "stepup" | "setup-finalize" | "oauth";
  provider?: string;
  pendingId?: string;
  purpose?: string;
  method?: "app" | "email";

  email?: string;
  password?: string;

  onVerify?: (code: string) => Promise<string | null>;
  actionLabel: string;

  onSuccess?: () => void;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({
  isOpen,
  onClose,
  mode,
  purpose,
  method,
  provider,
  pendingId,
  onVerify,
  email,
  password,
  actionLabel,
  onSuccess,
}) => {
  const t = useTranslations("TwoFactorModal");
  const tCommon = useTranslations("Common"); // <-- NEU: gemeinsame Buttons / Texte
  const { push } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const internalVerify = async (code: string): Promise<string | null> => {
    try {
      // 👉 OAuth second factor (after provider sign-in)
      if (mode === "oauth") {
        if (!provider || !pendingId)
          return "Internal error: missing OAuth verification data.";

        const res = await fetch(
          `/api/oauth/${provider}/two-factor?pending=${encodeURIComponent(pendingId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ code }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return data?.message || "Verification failed";
        }
        return null;
      }

      // 👉 1) LOGIN / FIRST FACTOR
      if (mode === "login") {
        if (!email || !password)
          return "Internal error: email/password missing";

        const result = await loginWithPassword(email, password, code);

        if (!result.ok && result.message === "INVALID_2FA_CODE") {
          return t("invalidCode");
        }

        if (!result.ok) {
          return result.message || "Login failed";
        }

        return null;
      }

      // 👉 2) STEP-UP
      if (mode === "stepup") {
        if (!purpose) return "Step-Up purpose missing (internal error).";

        const res = await fetch("/api/two-factor/step-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, purpose }),
        });

        const data = await res.json();
        if (!res.ok) return data.error || "Invalid Step-Up code";
        return null;
      }

      if (mode === "setup-finalize") {
        if (!method) return "2FA setup method missing (internal error).";

        const res = await fetch("/api/two-factor/setup-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, method }),
        });

        const data = await res.json();
        if (!res.ok) return data.error || "Setup verification failed";
        return null;
      }

      return "Unhandled verification mode.";
    } catch (err) {
      return "Network error while verifying code.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      push({ variant: "error", description: t("codeLengthError") });
      return;
    }

    setLoading(true);

    const errorMessage = onVerify
      ? await onVerify(code)
      : await internalVerify(code);

    if (errorMessage) {
      push({ variant: "error", description: errorMessage });
      setLoading(false);
      return;
    }

    push({ variant: "success", description: t("successMessage") });
    setCode("");

    setTimeout(() => {
      onClose();
      onSuccess?.();
    }, 600);

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "setup-finalize" ? t("headerFinalize") : t("header")}
          </DialogTitle>

          <DialogDescription>
            {mode === "setup-finalize"
              ? t("descriptionFinalize")
              : t("description", { action: actionLabel })}

            {mode === "stepup" && purpose && (
              <div className="text-xs text-muted-foreground mt-1">
                ({t("stepUpTitle", { purpose })})
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <Input
              id="twoFactorCode"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
              required
              className="col-span-3 text-center text-xl tracking-[0.5em]"
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              type="button"
              className="cursor-pointer"
              disabled={loading}
            >
              {tCommon("buttons.cancel")}
            </Button>

            <Button type="submit" className="cursor-pointer" disabled={loading}>
              {loading
                ? tCommon("buttons.loadingButton")
                : tCommon("buttons.verifyButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
