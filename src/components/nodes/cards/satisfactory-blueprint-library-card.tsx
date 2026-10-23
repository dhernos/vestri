"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Link2, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";

type BlueprintFile = { name: string; size: number };

type SatisfactoryBlueprintLibraryCardProps = {
  nodeRef: string;
};

const responseMessage = async (response: Response, fallback: string) => {
  const raw = (await response.text().catch(() => "")).trim();
  if (!raw) return fallback;
  try {
    const body = JSON.parse(raw) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message.trim();
    }
  } catch {
    return raw;
  }
  return raw;
};

export default function SatisfactoryBlueprintLibraryCard({
  nodeRef,
}: SatisfactoryBlueprintLibraryCardProps) {
  const t = useTranslations("NodeDetailsPage.blueprints");
  const [files, setFiles] = useState<BlueprintFile[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const basePath = `/api/nodes/${encodeURIComponent(nodeRef)}/satisfactory-blueprints`;

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(basePath, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setError(await responseMessage(response, t("errors.load")));
        return;
      }
      const body = (await response.json()) as { blueprints?: BlueprintFile[] };
      setFiles(Array.isArray(body.blueprints) ? body.blueprints : []);
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
      const response = await fetch(`${basePath}/upload`, {
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
      const response = await fetch(`${basePath}/import`, {
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

  const remove = async (file: BlueprintFile) => {
    if (!window.confirm(t("confirmDelete", { name: file.name }))) return;
    setBusy(file.name);
    setError("");
    try {
      const response = await fetch(`${basePath}/delete`, {
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

  const sizeLabel = (size: number) =>
    size < 1024
      ? `${size} B`
      : size < 1024 * 1024
        ? `${(size / 1024).toFixed(1)} KB`
        : `${(size / (1024 * 1024)).toFixed(1)} MB`;

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
          <FileInput
            accept=".sbp,.sbpcfg"
            className="max-w-sm"
            aria-label={t("upload")}
            disabled={busy !== ""}
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
            disabled={busy !== ""}
          />
          <Button
            onClick={() => void importFromSource()}
            disabled={!sourceUrl.trim() || busy !== ""}
          >
            <Link2 />
            {busy === "import" ? t("importing") : t("import")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("approvedSources")}</p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="divide-y rounded-md border">
          {files.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            files.map((file) => (
              <div
                key={file.name}
                className="flex min-w-0 flex-wrap items-center gap-3 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {sizeLabel(file.size)}
                </span>
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  aria-label={t("download", { name: file.name })}
                  title={t("download", { name: file.name })}
                >
                  <a
                    href={`${basePath}/download?name=${encodeURIComponent(file.name)}`}
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
            {t("working", { name: busy })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
