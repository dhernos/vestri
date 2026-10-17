"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Link2, RefreshCw, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const [sourceUrl, setSourceUrl] = useState("");
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
      };
      setAvailable(Array.isArray(data.available) ? data.available : []);
      setInstalled(
        new Set(
          (Array.isArray(data.installed) ? data.installed : []).map(
            (file) => file.name,
          ),
        ),
      );
    } catch {
      setError(t("errors.load"));
    }
  }, [basePath, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(file.name);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${basePath}/blueprints/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        setError(await responseMessage(response, t("errors.upload")));
        return;
      }
      await load();
    } catch {
      setError(t("errors.upload"));
    } finally {
      setBusy("");
    }
  };

  const importFromSource = async () => {
    if (!sourceUrl.trim()) return;
    setBusy("import");
    setError("");
    try {
      const response = await fetch(`${basePath}/blueprints/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      });
      if (!response.ok) {
        setError(await responseMessage(response, t("errors.import")));
        return;
      }
      setSourceUrl("");
      await load();
    } catch {
      setError(t("errors.import"));
    } finally {
      setBusy("");
    }
  };

  const toggleInstall = async (file: BlueprintFile, shouldInstall: boolean) => {
    setBusy(file.name);
    setError("");
    try {
      const response = await fetch(`${basePath}/blueprints/install`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, install: shouldInstall }),
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

  const remove = async (file: BlueprintFile) => {
    if (!window.confirm(t("confirmDelete", { name: file.name }))) return;
    setBusy(file.name);
    setError("");
    try {
      const response = await fetch(`${basePath}/blueprints/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name }),
      });
      if (!response.ok) {
        setError(await responseMessage(response, t("errors.delete")));
        return;
      }
      await load();
    } catch {
      setError(t("errors.delete"));
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
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="file"
            accept=".sbp,.sbpcfg"
            className="max-w-sm"
            aria-label={t("upload")}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <label className="sr-only" htmlFor="blueprint-source-url">
            {t("sourceUrl")}
          </label>
          <Input
            id="blueprint-source-url"
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder={t("sourceUrl")}
            className="min-w-56 flex-1"
          />
          <Button
            onClick={() => void importFromSource()}
            disabled={!sourceUrl.trim() || busy !== ""}
          >
            {busy === "import" ? (
              t("importing")
            ) : (
              <>
                <Link2 />
                {t("import")}
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("stagingNote")}</p>
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
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={installed.has(file.name)}
                    disabled={busy !== ""}
                    aria-label={t("installFile", { name: file.name })}
                    onChange={(event) =>
                      void toggleInstall(file, event.target.checked)
                    }
                  />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </label>
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  aria-label={t("download", { name: file.name })}
                  title={t("download", { name: file.name })}
                >
                  <a
                    href={`${basePath}/blueprints/download?name=${encodeURIComponent(file.name)}`}
                  >
                    <Download />
                  </a>
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  aria-label={t("delete", { name: file.name })}
                  title={t("delete", { name: file.name })}
                  disabled={busy !== ""}
                  onClick={() => void remove(file)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
        </div>
        {busy && busy !== "import" ? (
          <p className="text-xs text-muted-foreground">
            <Upload className="mr-1 inline size-3" />
            {t("working", { name: busy })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
