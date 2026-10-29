"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, LoaderCircle, RefreshCw, Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PluginRelease = { version: string; filename: string };
type LinkedPlugin = {
  id: string;
  source: { provider: string; project: string; version?: string };
  installed: PluginRelease;
  latest: PluginRelease;
  checkedAt: string;
  checkError?: string;
  pending: boolean;
};

async function pluginResponse(response: Response): Promise<LinkedPlugin[]> {
  if (!response.ok) {
    const raw = await response.text();
    try {
      const data = JSON.parse(raw) as { error?: string; message?: string };
      throw new Error(data.message || data.error || raw);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(raw);
      throw error;
    }
  }
  const data = (await response.json()) as { plugins: LinkedPlugin[] };
  return data.plugins;
}

export default function LinkedPaperPlugins({
  apiBase,
  onChange,
  children,
}: {
  apiBase: string;
  onChange: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("ServerPage.groupFiles.linked");
  const [plugins, setPlugins] = useState<LinkedPlugin[]>([]);
  const [url, setURL] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<{
    plugin: LinkedPlugin;
    action: "update" | "remove";
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${apiBase}/plugins`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const loaded = await pluginResponse(response);
        if (!controller.signal.aborted) {
          setPlugins(loaded);
          setError("");
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : t("error"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [apiBase, t]);

  const mutate = async (
    action: "import" | "update" | "remove",
    plugin?: LinkedPlugin,
  ) => {
    if (busy) return;
    setBusy(plugin?.id || "import");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${apiBase}/plugins${action === "import" ? "" : `/${action}`}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "import" ? { url } : { id: plugin?.id },
          ),
        },
      );
      setPlugins(await pluginResponse(response));
      setConfirmation(null);
      if (action === "import") setURL("");
      setNotice(
        t(
          action === "update"
            ? "updated"
            : action === "remove"
              ? "removed"
              : "downloaded",
        ),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("error"));
      try {
        const response = await fetch(`${apiBase}/plugins`, {
          credentials: "include",
          cache: "no-store",
        });
        setPlugins(await pluginResponse(response));
      } catch {
        setNotice(t("reloadAfterError"));
      }
    } finally {
      setBusy("");
      onChange();
    }
  };

  return (
    <section className="min-w-0 space-y-3 border-b pb-4">
      <h3 className="text-sm font-medium">{t("title")}</h3>
      <form
        className="flex min-w-0 flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate("import");
        }}
      >
        <Input
          type="url"
          required
          value={url}
          onChange={(event) => setURL(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("linkLabel")}
          className="min-w-0 basis-48 flex-1"
          disabled={Boolean(busy)}
        />
        <Button
          type="submit"
          disabled={!url.trim() || Boolean(busy) || loading}
        >
          {busy === "import" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Download />
          )}
          {t("download")}
        </Button>
      </form>
      {children}
      {error ? (
        <p role="alert" className="wrap-break-word text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {loading ? (
        <LoaderCircle
          aria-label={t("loading")}
          className="size-4 animate-spin"
        />
      ) : null}
      <div className="max-h-72 divide-y overflow-y-auto overscroll-contain pr-1">
        {plugins.map((plugin) => {
          const pinned = Boolean(plugin.source.version);
          const updateAvailable =
            !pinned &&
            plugin.latest.version &&
            plugin.installed.version !== plugin.latest.version;
          return (
            <div
              key={plugin.id}
              className="flex min-w-0 flex-wrap items-center gap-2 py-3"
            >
              <div className="min-w-0 basis-40 flex-1">
                <p className="wrap-break-word text-sm font-medium">
                  {plugin.source.project}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  {plugin.installed.filename}
                </p>
                <p
                  className={`text-xs ${plugin.pending || updateAvailable ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                >
                  {plugin.pending
                    ? t("pending")
                      : pinned
                      ? t("pinned", { version: plugin.source.version ?? "" })
                    : updateAvailable
                      ? t("available", { filename: plugin.latest.filename })
                      : t("current")}
                </p>
                {plugin.checkError ? (
                  <p className="wrap-break-word text-xs text-destructive">
                    {t("checkFailed", { error: plugin.checkError })}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t("checked", {
                    date: new Date(plugin.checkedAt).toLocaleString(),
                  })}
                </p>
              </div>
              {plugin.pending || updateAvailable ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => setConfirmation({ plugin, action: "update" })}
                >
                  {busy === plugin.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  {plugin.pending ? t("retry") : t("update")}
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                title={t("stopTracking")}
                aria-label={t("stopTracking")}
                disabled={Boolean(busy)}
                onClick={() => setConfirmation({ plugin, action: "remove" })}
              >
                <Unlink className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(
                confirmation?.action === "remove"
                  ? "stopTracking"
                  : "confirmTitle",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                confirmation?.action === "remove"
                  ? "confirmRemove"
                  : "confirmUpdate",
                { plugin: confirmation?.plugin.source.project || "" },
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setConfirmation(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() => {
                if (confirmation)
                  void mutate(confirmation.action, confirmation.plugin);
              }}
            >
              {busy ? (
                <LoaderCircle className="animate-spin" />
              ) : confirmation?.action === "remove" ? (
                <Unlink />
              ) : (
                <RefreshCw />
              )}
              {t(
                confirmation?.action === "remove"
                  ? "stopTracking"
                  : "confirmButton",
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
