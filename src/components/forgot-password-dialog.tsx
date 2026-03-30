// src/components/forgot-password-dialog.tsx

"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl"; // <-- Import für next-intl
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

interface ForgotPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordDialog({
  isOpen,
  onClose,
}: ForgotPasswordDialogProps) {
  // Initialisiere die Übersetzungsfunktionen
  const t = useTranslations("ForgotPassword");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const { push } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleCloseDialog = () => {
    setEmail("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldown > 0) {
      push({
        variant: "error",
        description: t("messages.cooldown", {
          cooldown,
          seconds: tCommon("seconds"),
        }),
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        // Erfolgsmeldung der API verwenden, falls vorhanden, sonst Fallback
        push({ variant: "success", description: t("messages.success") });
        setCooldown(60); // Start cooldown
      } else if (response.status === 429) {
        setCooldown(data.cooldown);
        push({
          variant: "error",
          description: t("messages.cooldown", {
            cooldown: data.cooldown,
            seconds: tCommon("seconds"),
          }),
        });
      } else {
        // Fehlermeldung der API verwenden, falls vorhanden, sonst Fallback
        push({
          variant: "error",
          description: tErrors("FORGOT_PASSWORD_FAILED"),
        });
      }
    } catch (err) {
      push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
      console.error("Forgot password error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                {t("form.emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="col-span-3"
                required
                disabled={loading || cooldown > 0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={loading}
              type="button"
            >
              {tCommon("buttons.cancel")}
            </Button>
            <Button type="submit" disabled={loading || cooldown > 0}>
              {loading
                ? t("form.loadingButton")
                : cooldown > 0
                ? t.rich("form.cooldownButton", {
                    cooldown: cooldown,
                    seconds: tCommon("seconds"),
                  })
                : t("form.sendButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
