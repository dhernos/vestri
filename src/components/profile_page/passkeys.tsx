import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deletePasskey, fetchPasskeys, GoPasskey } from "@/lib/auth-client";
import { registerPasskey, PasskeyError } from "@/lib/webauthn";
import { TwoFactorModal } from "./TwoFactorModal";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";

export default function PasskeySection() {
  const t = useTranslations("Passkeys");
  const { data: session } = useAuth();
  const { push } = useToast();
  const [passkeys, setPasskeys] = useState<GoPasskey[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsStepUp, setNeedsStepUp] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchPasskeys();
    setPasskeys(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mapPasskeyError = (code: PasskeyError, fallback?: string) => {
    switch (code) {
      case "UNSUPPORTED":
        return t("errors.unsupported");
      case "START_FAILED":
        return fallback || t("errors.startFailed");
      case "CREATE_CANCELLED":
        return t("errors.cancelled");
      case "FINISH_FAILED":
        return fallback || t("errors.finishFailed");
      case "LOGIN_START_FAILED":
        return fallback || t("errors.startFailed");
      case "LOGIN_CANCELLED":
        return t("errors.cancelled");
      case "LOGIN_FINISH_FAILED":
        return fallback || t("errors.finishFailed");
      default:
        return fallback || t("errors.generic");
    }
  };

  const handleAdd = async () => {
    const label = prompt(t("prompts.nameOptional")) || undefined;
    setLoading(true);
    const res = await registerPasskey(label);
    if (!res.ok) {
      if (res.error === "LOGIN_START_FAILED" && res.fallback === "STEP_UP_REQUIRED") {
        // Trigger email code if needed before showing the modal
        if (session?.user?.twoFactorMethod === "email" && session?.user?.email) {
          await fetch("/api/two-factor/send-email-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email: session.user.email }),
          }).catch(() => {});
        }
        setNeedsStepUp(true);
      }
      const message = mapPasskeyError(res.error, res.fallback);
      push({ variant: "error", description: message });
    } else {
      await load();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const ok = await deletePasskey(id);
    if (!ok) {
      if (session?.user?.twoFactorMethod === "email" && session?.user?.email) {
        await fetch("/api/two-factor/send-email-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: session.user.email }),
        }).catch(() => {});
      }
      setNeedsStepUp(true);
      push({ variant: "error", description: t("errors.stepUpRequired") });
    } else {
      await load();
    }
    setLoading(false);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("title")}</span>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? t("buttons.loading") : t("buttons.add")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TwoFactorModal
          isOpen={needsStepUp}
          onClose={() => setNeedsStepUp(false)}
          mode="stepup"
          purpose="passkey_manage"
          actionLabel={t("stepUpActionLabel")}
          onSuccess={async () => {
            setNeedsStepUp(false);
            await load();
          }}
        />
        {passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
        ) : (
          <ul className="space-y-2">
            {passkeys.map((pk) => (
              <li
                key={pk.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">
                    {pk.label || t("itemLabelFallback")}
                  </span>
                  {pk.createdAt && (
                    <span className="text-muted-foreground">
                      {t("createdAt", {
                        date: new Date(pk.createdAt).toLocaleString(),
                      })}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(pk.id)}
                  disabled={loading}
                >
                  {t("buttons.remove")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
