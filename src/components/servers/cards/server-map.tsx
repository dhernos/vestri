"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ServerMap({ basePath }: { basePath: string }) {
  const t = useTranslations("ServerPage.map");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const check = async () => {
      setState("loading");
      setError("");
      try {
        const response = await fetch(`${basePath}/map/status`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          const message = contentType.includes("application/json")
            ? ((await response.json()) as { message?: string }).message
            : await response.text();
          throw new Error(message || t("unavailable"));
        }
        await response.body?.cancel();
        if (!controller.signal.aborted) setState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : t("unavailable"));
        setState("error");
      }
    };
    void check();
    return () => controller.abort();
  }, [attempt, basePath, t]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <Button
          variant="outline"
          disabled={state === "loading"}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t("reload")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {state === "loading" ? (
        <p role="status" className="text-sm">{t("loading")}</p>
      ) : state === "error" ? (
        <div role="alert" className="space-y-2 rounded-lg border p-4 text-sm">
          <p>{t("setup")}</p>
          <p className="whitespace-pre-wrap text-destructive">{error}</p>
        </div>
      ) : (
        <iframe
          key={attempt}
          src={`${basePath}/map/view/index.html`}
          title={t("frameTitle")}
          className="h-[75vh] min-h-96 w-full rounded-lg border"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
          allow="fullscreen"
          referrerPolicy="same-origin"
          onError={() => {
            setError(t("unavailable"));
            setState("error");
          }}
        />
      )}
    </section>
  );
}
