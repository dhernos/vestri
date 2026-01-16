"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import { useToast } from "@/components/ui/toast";

export default function ChangeEmailSection() {
  const { data: session, logout, refresh } = useAuth();
  const oauthLinked = session?.user?.oauthLinked ?? false;
  const { push } = useToast();

  const [email, setEmail] = useState(session?.user?.email || "");
  const [needsStepUp, setNeedsStepUp] = useState(false);

  const t = useTranslations("ProfilePage");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");

  // Funktion zur Zurücksetzung der Nachrichten und Fehler
  // --- Handler für E-Mail-Änderung ---
  const handleEmailUpdate = async (e: FormEvent) => {
    e.preventDefault();

    if (oauthLinked) {
      push({
        variant: "error",
        description: t("oauthAccount.cannotChangeEmail"),
      });
      return;
    }

    if (email === session?.user?.email) {
      push({ variant: "error", description: t("sameEmailError") });
      return;
    }

    if (!email || !email.includes("@")) {
      push({ variant: "error", description: t("invalidEmail") });
      return;
    }

    try {
      const res = await fetch("/api/profile/update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newEmail: email }),
      });

      const data = await res.json();

      if (res.ok) {
        push({
          variant: "success",
          description: `${data.message}${t("messageWillLogout")}`,
        });
        await refresh();
        setTimeout(() => {
          logout();
        }, 3000);
      } else {
        if (res.status === 403 && data.message === "STEP_UP_REQUIRED") {
          // Send email code ahead of opening the modal (email-based 2FA)
          if (session?.user?.twoFactorMethod === "email" && session?.user?.email) {
            await fetch("/api/two-factor/send-email-code", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ email: session.user.email }),
            }).catch(() => {});
          }
          setNeedsStepUp(true);
        } else {
          push({
            variant: "error",
            description: data.message || t("emailUpdateFailed"),
          });
          setEmail(session?.user?.email || "");
        }
      }
    } catch (err) {
      push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
      console.error(err);
    }
  };

  return (
    <div>
      {/* Sektion für E-Mail-Änderung */}
      <section className="mb-8 p-6 border rounded-lg shadow-md">
        <TwoFactorModal
          isOpen={needsStepUp}
          onClose={() => setNeedsStepUp(false)}
          mode="stepup"
          purpose="email_change"
          actionLabel={tCommon("buttons.updateEmail")}
          onSuccess={() => {
            setNeedsStepUp(false);
            const fakeEvent = { preventDefault() {} } as unknown as FormEvent;
            handleEmailUpdate(fakeEvent);
          }}
        />
        <h2 className="text-2xl font-semibold mb-4">
          {t("emailChangeHeader")}
        </h2>
        <p className="text-sm text-secondary-foreground mb-4">
          {t("emailChangeWarning")}
        </p>
        {oauthLinked && (
          <div className="p-3 mb-4 bg-yellow-50 text-yellow-800 rounded-md">
            {t("oauthAccount.emailReadOnly")}
          </div>
        )}
        <form onSubmit={handleEmailUpdate}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium">
              {t("emailAddress")}
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 p-2 w-full border rounded-md"
              disabled={oauthLinked}
            />
          </div>
          <Button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded cursor-pointer"
            disabled={oauthLinked}
          >
            {tCommon("buttons.updateEmail")}
          </Button>
        </form>
      </section>
    </div>
  );
}
