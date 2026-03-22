import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deletePasskey, fetchPasskeys, GoPasskey } from "@/lib/auth-client";
import {
  registerPasskey,
  PasskeyError,
  passkeyFallbackCodes,
} from "@/lib/webauthn";
import { TwoFactorModal } from "./TwoFactorModal";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";
import { prepareStepUpCode } from "@/lib/step-up";

type PendingPasskeyAction =
  | { type: "add"; label?: string }
  | { type: "delete"; id: string }
  | null;

export default function PasskeySection() {
  const t = useTranslations("Passkeys");
  const tErrors = useTranslations("Errors");
  const { data: session } = useAuth();
  const oauthLinked = session?.user?.oauthLinked ?? false;
  const { push } = useToast();
  const [passkeys, setPasskeys] = useState<GoPasskey[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingPasskeyAction>(null);

  const load = useCallback(async () => {
    if (oauthLinked) {
      setPasskeys([]);
      return;
    }
    const data = await fetchPasskeys();
    const seen = new Set<string>();
    const unique = data.filter((pk) => {
      if (typeof pk.id !== "string") return false;
      const id = pk.id.trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    setPasskeys(unique);
  }, [oauthLinked]);

  useEffect(() => {
    load();
  }, [load]);

  const mapFallback = (fallback?: string) => {
    if (!fallback) return null;
    if (fallback === passkeyFallbackCodes.secureContextRequired) {
      return t("errors.secureContextRequired");
    }
    if (fallback === passkeyFallbackCodes.creationBlocked) {
      return t("errors.creationBlocked");
    }
    if (fallback === passkeyFallbackCodes.loginSecureContextRequired) {
      return t("errors.loginSecureContextRequired");
    }
    if (fallback === passkeyFallbackCodes.loginBlocked) {
      return t("errors.loginBlocked");
    }
    if (fallback.startsWith(`${passkeyFallbackCodes.creationRpIdMismatch}:`)) {
      const rpId = fallback.slice(
        `${passkeyFallbackCodes.creationRpIdMismatch}:`.length
      );
      return t("errors.creationRpIdMismatch", { rpId });
    }
    if (fallback.startsWith(`${passkeyFallbackCodes.loginRpIdMismatch}:`)) {
      const rpId = fallback.slice(
        `${passkeyFallbackCodes.loginRpIdMismatch}:`.length
      );
      return t("errors.loginRpIdMismatch", { rpId });
    }
    if (/^[A-Z0-9_]+$/.test(fallback) && tErrors.has(fallback as never)) {
      return tErrors(fallback as never);
    }
    return null;
  };

  const mapPasskeyError = (code: PasskeyError, fallback?: string) => {
    const fallbackMessage = mapFallback(fallback);
    switch (code) {
      case "UNSUPPORTED":
        return t("errors.unsupported");
      case "START_FAILED":
        return fallbackMessage || t("errors.startFailed");
      case "CREATE_CANCELLED":
        return t("errors.cancelled");
      case "FINISH_FAILED":
        return fallbackMessage || t("errors.finishFailed");
      case "LOGIN_START_FAILED":
        return fallbackMessage || t("errors.startFailed");
      case "LOGIN_CANCELLED":
        return t("errors.cancelled");
      case "LOGIN_FINISH_FAILED":
        return fallbackMessage || t("errors.finishFailed");
      default:
        return fallbackMessage || t("errors.generic");
    }
  };

  const mapStepUpSendError = (code?: string) => {
    if (code && /^[A-Z0-9_]+$/.test(code) && tErrors.has(code as never)) {
      return tErrors(code as never);
    }
    return tErrors("SEND_CODE_ERROR");
  };

  const handleAdd = async (label?: string) => {
    if (oauthLinked) {
      push({ variant: "error", description: t("oauthAccount.disabled") });
      return;
    }
    setLoading(true);
    const res = await registerPasskey(label);
    if (!res.ok) {
      if (res.error === "LOGIN_START_FAILED" && res.fallback === "STEP_UP_REQUIRED") {
        const stepUp = await prepareStepUpCode(session?.user, "passkey_manage");
        if (!stepUp.ok) {
          push({ variant: "error", description: mapStepUpSendError(stepUp.code) });
          setLoading(false);
          return;
        }
        setPendingAction({ type: "add", label });
        setNeedsStepUp(true);
        push({ variant: "error", description: t("errors.stepUpRequired") });
        setLoading(false);
        return;
      }
      const message = mapPasskeyError(res.error, res.fallback);
      push({ variant: "error", description: message });
    } else {
      await load();
    }
    setLoading(false);
  };

  const handlePromptedAdd = async () => {
    const label = prompt(t("prompts.nameOptional")) || undefined;
    await handleAdd(label);
  };

  const handleDelete = async (id: string) => {
    if (oauthLinked) {
      push({ variant: "error", description: t("oauthAccount.disabled") });
      return;
    }
    setLoading(true);
    const result = await deletePasskey(id);
    if (!result.ok) {
      if (result.status === 403 && result.message === "STEP_UP_REQUIRED") {
        const stepUp = await prepareStepUpCode(session?.user, "passkey_manage");
        if (!stepUp.ok) {
          push({ variant: "error", description: mapStepUpSendError(stepUp.code) });
          setLoading(false);
          return;
        }
        setPendingAction({ type: "delete", id });
        setNeedsStepUp(true);
        push({ variant: "error", description: t("errors.stepUpRequired") });
        setLoading(false);
        return;
      } else {
        push({ variant: "error", description: t("errors.generic") });
      }
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
          <Button onClick={handlePromptedAdd} disabled={loading || oauthLinked}>
            {loading ? t("buttons.loading") : t("buttons.add")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TwoFactorModal
          isOpen={needsStepUp}
          onClose={() => {
            setNeedsStepUp(false);
            setPendingAction(null);
          }}
          mode="stepup"
          purpose="passkey_manage"
          actionLabel={t("stepUpActionLabel")}
          onSuccess={async () => {
            setNeedsStepUp(false);
            const action = pendingAction;
            setPendingAction(null);

            if (!action) {
              await load();
              return;
            }
            if (action.type === "delete") {
              await handleDelete(action.id);
              return;
            }
            await handleAdd(action.label);
          }}
        />
        {oauthLinked ? (
          <p className="text-sm text-muted-foreground">{t("oauthAccount.disabled")}</p>
        ) : passkeys.length === 0 ? (
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
