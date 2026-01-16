"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pushToast } from "@/lib/toast";

const oauthErrorMessages: Record<string, string> = {
  provider_unavailable: "This sign-in provider is not configured.",
  state_persist_failed:
    "We couldn’t start the sign-in. Please try again in a moment.",
  unsupported_provider: "The requested sign-in provider is not available.",
  missing_state: "The sign-in session was missing or expired. Please try again.",
  state_invalid: "Your sign-in session expired. Start the OAuth flow again.",
  state_mismatch: "We couldn't verify your sign-in state. Please try again.",
  token_exchange_failed: "We couldn't confirm your account with the provider.",
  profile_fetch_failed: "We couldn't fetch your profile from the provider.",
  email_required: "We couldn't get an email address from the provider.",
  lookup_failed: "We couldn't find or create your account for this provider.",
  create_failed: "We couldn't create your account from the provider details.",
  link_failed: "We couldn't link this provider to your account.",
  two_factor_required:
    "Two-factor authentication is required for this account.",
  two_factor_failed:
    "We couldn't start two-factor verification. Please try again.",
  session_failed: "We couldn't start a session after signing in.",
};

export function QueryToastListener() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const search = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const toastType = params.get("toast");
    if (!toastType) return;

    const reason = params.get("reason") || "";
    if (toastType === "oauth_error") {
      const description =
        oauthErrorMessages[reason] ||
        "OAuth sign-in failed. Please try again.";
      pushToast({
        title: "Sign-in error",
        description,
        variant: "error",
      });
    } else {
      pushToast({
        title: "Notice",
        description: reason || "An error occurred.",
        variant: "info",
      });
    }

    const nextParams = new URLSearchParams(search);
    nextParams.delete("toast");
    nextParams.delete("reason");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, search]);

  return null;
}
