"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TwoFactorModal } from "@/components/profile_page/TwoFactorModal";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "@/i18n/navigation";

type PendingState = {
  pendingId: string;
  provider: "github";
  returnTo: string;
};

export function OAuthTwoFactorListener() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { refresh } = useAuth();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingState | null>(null);

  const paramsString = useMemo(() => searchParams.toString(), [searchParams]);

  const clearParams = (nextPath?: string) => {
    const params = new URLSearchParams(paramsString);
    params.delete("oauth_pending");
    params.delete("oauth_provider");
    params.delete("oauth_return");
    const qs = params.toString();
    router.replace(nextPath || (qs ? `${pathname}?${qs}` : pathname));
  };

  useEffect(() => {
    const params = new URLSearchParams(paramsString);
    const pendingId = params.get("oauth_pending");
    const provider = params.get("oauth_provider");
    const returnTo = params.get("oauth_return") || "/";
    if (!pendingId || provider !== "github") {
      return;
    }
    const safeReturn = returnTo.startsWith("/") ? returnTo : "/";
    setPending({ pendingId, provider, returnTo: safeReturn });
    setOpen(true);
  }, [paramsString]);

  if (!pending) return null;

  return (
    <TwoFactorModal
      isOpen={open}
      onClose={() => {
        setOpen(false);
        setPending(null);
        clearParams();
      }}
      mode="oauth"
      provider={pending.provider}
      pendingId={pending.pendingId}
      actionLabel="Verify to continue"
      onSuccess={async () => {
        const target = pending.returnTo || "/";
        await refresh();
        setPending(null);
        clearParams(target);
      }}
    />
  );
}
