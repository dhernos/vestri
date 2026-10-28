"use client";

import { useEffect, useId, useState } from "react";
import { LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WhitelistEntry = { uuid: string; name: string };
type WhitelistData = {
  available: boolean;
  mainServerName?: string;
  entries: WhitelistEntry[];
};

export default function VelocityWhitelist({ basePath }: { basePath: string }) {
  const t = useTranslations("ServerPage.whitelist");
  const usernameId = useId();
  const [data, setData] = useState<WhitelistData | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${basePath}/whitelist`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.message || t("errors.load"));
        }
        if (!controller.signal.aborted) {
          setData(payload as WhitelistData);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t("errors.load"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [basePath, revision, t]);

  const mutate = async (action: "add" | "remove", entry?: WhitelistEntry) => {
    if (busy || loading || !data?.available) {
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`${basePath}/whitelist`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username: username.trim(), uuid: entry?.uuid }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || t("errors.save"));
      }
      setData(payload as WhitelistData);
      setSaved(true);
      if (action === "add") {
        setUsername("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.save"));
    } finally {
      setBusy(false);
    }
  };

  const disabled = loading || busy || !data?.available;

  return (
    <section className="min-w-0 space-y-6" aria-busy={loading || busy}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          {data?.mainServerName ? (
            <p className="wrap-break-word text-sm text-muted-foreground">
              {t("mainServer", { name: data.mainServerName })}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="icon"
          title={t("refresh")}
          aria-label={t("refresh")}
          disabled={loading || busy}
          onClick={() => {
            setLoading(true);
            setData(null);
            setError("");
            setSaved(false);
            setRevision((value) => value + 1);
          }}
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} />
        </Button>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate("add");
        }}
      >
        <div className="min-w-0 flex-1 space-y-2 sm:max-w-sm">
          <Label htmlFor={usernameId}>{t("username")}</Label>
          <Input
            id={usernameId}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t("username")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={16}
            pattern="[A-Za-z0-9_]{3,16}"
            disabled={disabled}
          />
        </div>
        <Button type="submit" disabled={disabled || !/^[A-Za-z0-9_]{3,16}$/.test(username.trim())}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
          {t("add")}
        </Button>
      </form>

      {error ? <p role="alert" className="wrap-break-word text-sm text-destructive">{error}</p> : null}
      {saved ? <p role="status" className="text-sm text-success">{t("saved")}</p> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p> : null}
      {data && !data.available ? (
        <p role="status" className="text-sm text-muted-foreground">{t("unavailable")}</p>
      ) : null}
      {data?.available ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("count", { count: data.entries.length })}</p>
          {data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y border-y">
              {data.entries.map((entry) => (
                <li key={entry.uuid} className="flex min-w-0 items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="wrap-break-word text-sm font-medium">{entry.name}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">{entry.uuid}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive"
                    disabled={disabled}
                    title={t("remove", { name: entry.name })}
                    aria-label={t("remove", { name: entry.name })}
                    onClick={() => void mutate("remove", entry)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}