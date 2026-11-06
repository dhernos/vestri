"use client";

import { useEffect, useId, useState } from "react";
import { KeyRound, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const secretKeyPattern = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

const errorMessage = async (res: Response, fallback: string) => {
  const payload = (await res.json().catch(() => ({}))) as { message?: string };
  return payload.message || fallback;
};

export default function SecretsCard({ basePath }: { basePath: string }) {
  const t = useTranslations("ServerPage.secrets");
  const keyId = useId();
  const valueId = useId();
  const [secrets, setSecrets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${basePath}/secrets`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(await errorMessage(res, t("errors.load")));
        }
        const payload = (await res.json()) as { secrets?: unknown };
        if (!controller.signal.aborted) {
          setSecrets(
            Array.isArray(payload.secrets)
              ? payload.secrets.filter((item): item is string => typeof item === "string")
              : [],
          );
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

  const trimmedKey = key.trim();
  const canCreate =
    !creating && secretKeyPattern.test(trimmedKey) && value.length > 0 && !secrets.includes(trimmedKey);

  const createSecret = async () => {
    if (!canCreate) {
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`${basePath}/secrets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmedKey, value }),
      });
      if (!res.ok) {
        throw new Error(await errorMessage(res, t("errors.create")));
      }
      setKey("");
      setValue("");
      setRevision((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.create"));
    } finally {
      setCreating(false);
    }
  };

  const deleteSecret = async (secretKey: string) => {
    if (deletingKey || !window.confirm(t("confirmDelete", { key: secretKey }))) {
      return;
    }
    setDeletingKey(secretKey);
    setError("");
    try {
      const res = await fetch(`${basePath}/secrets/${encodeURIComponent(secretKey)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await errorMessage(res, t("errors.delete")));
      }
      setRevision((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.delete"));
    } finally {
      setDeletingKey("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {t("loading")}
          </p>
        ) : secrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {secrets.map((secretKey) => (
              <li key={secretKey} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-sm">{secretKey}</span>
                  <span className="text-xs text-muted-foreground">{t("hiddenValue")}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={Boolean(deletingKey)}
                  onClick={() => void deleteSecret(secretKey)}
                >
                  <Trash2 />
                  {deletingKey === secretKey ? t("buttons.deleting") : t("buttons.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void createSecret();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={keyId}>{t("fields.key")}</Label>
            <Input
              id={keyId}
              value={key}
              placeholder={t("fields.keyPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setKey(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={valueId}>{t("fields.value")}</Label>
            <Input
              id={valueId}
              type="password"
              value={value}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!canCreate}>
            <Plus />
            {creating ? t("buttons.adding") : t("buttons.add")}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
