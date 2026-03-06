"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type HealthState = "green" | "orange" | "red" | "loading";

type HealthBlobProps = {
  nodeRef: string;
};

export default function HealthBlob({ nodeRef }: HealthBlobProps) {
  const t = useTranslations("HealthBlob");
  const [state, setState] = useState<HealthState>("loading");
  const [statusReason, setStatusReason] = useState(t("loading"));

  useEffect(() => {
    if (!nodeRef) {
      setState("red");
      setStatusReason(t("missingNode"));
      return;
    }

    const checkHealth = async () => {
      try {
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(nodeRef)}/worker/health`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        if (res.status === 200) {
          const data = await res.json();

          if (data.status === "OK" && data.external_service === "OK") {
            setState("green");
            setStatusReason(t("ok"));
          } else {
            setState("orange");
            setStatusReason(t("partial"));
          }

          return;
        }

        setState("red");
        setStatusReason(t("httpError", { status: res.status }));
      } catch {
        setState("red");
        setStatusReason(t("genericError"));
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // alle 10s

    return () => clearInterval(interval);
  }, [nodeRef, t]);

  return (
    <div
      title={statusReason}
      aria-label={statusReason}
      className={`h-4 w-4 rounded-full ${
        state === "green"
          ? "bg-green-500"
          : state === "orange"
            ? "bg-orange-500"
            : state === "red"
              ? "bg-red-500"
              : "bg-gray-400"
      }`}
    />
  );
}
