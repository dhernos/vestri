"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { pushToast } from "@/lib/toast";

export function QueryToastListener() {
  const t = useTranslations("QueryToasts");
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
        reason && t.has(`oauthReasons.${reason}` as never)
          ? t(`oauthReasons.${reason}` as never)
          : t("oauth.defaultDescription");
      pushToast({
        title: t("oauth.title"),
        description,
        variant: "error",
      });
    } else {
      const description =
        reason && t.has(`noticeReasons.${reason}` as never)
          ? t(`noticeReasons.${reason}` as never)
          : t("notice.defaultDescription");
      pushToast({
        title: t("notice.title"),
        description,
        variant: "info",
      });
    }

    const nextParams = new URLSearchParams(search);
    nextParams.delete("toast");
    nextParams.delete("reason");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, search, t]);

  return null;
}
