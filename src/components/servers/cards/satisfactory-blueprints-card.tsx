"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BlueprintFile = { name: string; size: number };

type SatisfactoryBlueprintsCardProps = {
  basePath: string;
};

const responseMessage = async (response: Response, fallback: string) => {
  const raw = (await response.text().catch(() => "")).trim();
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as { message?: unknown };
    if (typeof data.message === "string" && data.message.trim())
      return data.message.trim();
  } catch {
    return raw;
  }
  return raw;
};

export default function SatisfactoryBlueprintsCard({
  basePath,
}: SatisfactoryBlueprintsCardProps) {
  const t = useTranslations("ServerPage.satisfactoryBlueprints");
  const [available, setAvailable] = useState<BlueprintFile[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [serverReady, setServerReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`${basePath}/blueprints`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setError(await responseMessage(response, t("errors.load")));
        return;
      }
      const data = (await response.json()) as {
        available?: BlueprintFile[];
        installed?: BlueprintFile[];
        serverReady?: boolean;
      };
      setAvailable(Array.isArray(data.available) ? data.available : []);
      setInstalled(
        new Set(
          (Array.isArray(data.installed) ? data.installed : []).map(
            (file) => file.name,
          ),
        ),
      );
      setServerReady(data.serverReady === true);
    } catch {
      setError(t("errors.load"));
      setServerReady(false);
    }
  }, [basePath, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const install = async (file: BlueprintFile) => {
    setBusy(file.name);
    setError("");
    try {
      const response = await fetch(`${basePath}/blueprints/install`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name }),
      });
      if (!response.ok) {
        setError(await responseMessage(response, t("errors.install")));
        return;
      }
      await load();
    } catch {
      setError(t("errors.install"));
    } finally {
      setBusy("");
    }
  };

  const formatBytes = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            aria-label={t("refresh")}
            title={t("refresh")}
          >
            <RefreshCw />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("stagingNote")}</p>
        {!serverReady ? (
          <p className="text-sm text-muted-foreground">
            {t("createSessionFirst")}
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="divide-y rounded-md border">
          {available.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            available.map((file) => (
              <div
                key={file.name}
                className="flex min-w-0 flex-wrap items-center gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </div>
                {installed.has(file.name) ? (
                  <Button variant="secondary" size="sm" disabled>
                    <Check />
                    {t("installed")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy !== "" || !serverReady}
                    onClick={() => void install(file)}
                  >
                    {busy === file.name ? t("installing") : t("install")}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        {busy ? (
          <p className="text-xs text-muted-foreground">
            {t("working", { name: busy })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
