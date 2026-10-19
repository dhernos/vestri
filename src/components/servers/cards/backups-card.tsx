"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Download,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
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

type BackupPolicy = {
  enabled: boolean;
  everyDays: number;
  time: string;
  keepDailyDays: number;
  keepWeeklyWeeks: number;
};

type BackupEntry = {
  name: string;
  size: number;
  createdAt: string;
};

type BackupState = {
  policy: BackupPolicy;
  backups: BackupEntry[];
};

const initialPolicy: BackupPolicy = {
  enabled: true,
  everyDays: 1,
  time: "04:00",
  keepDailyDays: 7,
  keepWeeklyWeeks: 4,
};

const backupResponseError = async (
  response: Response,
  fallback: string,
  t: ReturnType<typeof useTranslations>,
) => {
  const body = (await response.text().catch(() => "")).trim();
  if (
    response.status === 404 &&
    body.toLowerCase().includes("404 page not found")
  ) {
    return t("backups.errors.workerNotUpdated");
  }
  if (!body) return fallback;
  try {
    const data = JSON.parse(body) as { message?: unknown; error?: unknown };
    if (typeof data.message === "string" && data.message.trim())
      return data.message.trim();
    if (typeof data.error === "string" && data.error.trim())
      return data.error.trim();
  } catch {
    return body.slice(0, 500);
  }
  return body.slice(0, 500);
};

export default function BackupsCard({ basePath }: { basePath: string }) {
  const t = useTranslations("ServerPage");
  const [state, setState] = useState<BackupState>({
    policy: initialPolicy,
    backups: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${basePath}/backups`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          await backupResponseError(response, t("backups.errors.load"), t),
        );
      }
      const data = (await response.json().catch(() => ({}))) as BackupState;
      setState({
        policy: { ...initialPolicy, ...data.policy },
        backups: Array.isArray(data.backups) ? data.backups : [],
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("backups.errors.load"),
      );
    } finally {
      setLoading(false);
    }
  }, [basePath, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const updatePolicy = <K extends keyof BackupPolicy>(
    key: K,
    value: BackupPolicy[K],
  ) => {
    setState((current) => ({
      ...current,
      policy: { ...current.policy, [key]: value },
    }));
  };

  const savePolicy = async () => {
    setBusy("settings");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${basePath}/backups/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.policy),
      });
      if (!response.ok) {
        throw new Error(
          await backupResponseError(response, t("backups.errors.save"), t),
        );
      }
      const data = (await response.json().catch(() => ({}))) as BackupState;
      setState({
        policy: { ...initialPolicy, ...data.policy },
        backups: data.backups || [],
      });
      setNotice(t("backups.messages.saved"));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("backups.errors.save"),
      );
    } finally {
      setBusy("");
    }
  };

  const createBackup = async () => {
    setBusy("create");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${basePath}/backups/create`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(
          await backupResponseError(response, t("backups.errors.create"), t),
        );
      }
      await load();
      setNotice(t("backups.messages.created"));
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : t("backups.errors.create"),
      );
    } finally {
      setBusy("");
    }
  };

  const uploadBackup = async (file: File) => {
    setBusy("upload");
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${basePath}/backups/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        throw new Error(
          await backupResponseError(response, t("backups.errors.upload"), t),
        );
      }
      await load();
      setNotice(t("backups.messages.uploaded"));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t("backups.errors.upload"),
      );
    } finally {
      setBusy("");
    }
  };

  const downloadBackup = async (name: string) => {
    setBusy(`download:${name}`);
    setError("");
    const link = document.createElement("a");
    link.href = `${basePath}/backups/download?name=${encodeURIComponent(name)}`;
    link.download = name;
    link.click();
    setBusy("");
  };

  const restoreBackup = async (name: string) => {
    if (!window.confirm(t("backups.confirmRestore", { name }))) return;
    setBusy(`restore:${name}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${basePath}/backups/restore`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(
          await backupResponseError(response, t("backups.errors.restore"), t),
        );
      }
      await load();
      setNotice(t("backups.messages.restored"));
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : t("backups.errors.restore"),
      );
    } finally {
      setBusy("");
    }
  };

  const deleteBackup = async (name: string) => {
    if (!window.confirm(t("backups.confirmDelete", { name }))) return;
    setBusy(`delete:${name}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${basePath}/backups/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(
          await backupResponseError(response, t("backups.errors.delete"), t),
        );
      }
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t("backups.errors.delete"),
      );
    } finally {
      setBusy("");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="size-5" />
            {t("backups.title")}
          </CardTitle>
          <CardDescription>{t("backups.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={state.policy.enabled}
              onChange={(event) =>
                updatePolicy("enabled", event.target.checked)
              }
              className="size-4 accent-primary"
            />
            {t("backups.fields.enabled")}
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5 text-sm">
              <span>{t("backups.fields.interval")}</span>
              <Input
                type="number"
                min={1}
                max={365}
                value={state.policy.everyDays}
                onChange={(event) =>
                  updatePolicy("everyDays", Number(event.target.value))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span>{t("backups.fields.time")}</span>
              <Input
                type="time"
                value={state.policy.time}
                onChange={(event) => updatePolicy("time", event.target.value)}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span>{t("backups.fields.dailyRetention")}</span>
              <Input
                type="number"
                min={1}
                max={90}
                value={state.policy.keepDailyDays}
                onChange={(event) =>
                  updatePolicy("keepDailyDays", Number(event.target.value))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span>{t("backups.fields.weeklyRetention")}</span>
              <Input
                type="number"
                min={0}
                max={52}
                value={state.policy.keepWeeklyWeeks}
                onChange={(event) =>
                  updatePolicy("keepWeeklyWeeks", Number(event.target.value))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void savePolicy()}
              disabled={busy !== "" || loading}
            >
              {busy === "settings" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Save />
              )}
              {t("backups.buttons.save")}
            </Button>
            <Button
              variant="outline"
              onClick={() => void createBackup()}
              disabled={busy !== "" || loading}
            >
              {busy === "create" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Plus />
              )}
              {t("backups.buttons.create")}
            </Button>
            <label className="relative inline-flex cursor-pointer">
              <Input
                type="file"
                accept=".zip,application/zip"
                className="sr-only peer"
                disabled={busy !== "" || loading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadBackup(file);
                  event.currentTarget.value = "";
                }}
              />
              <span className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:pointer-events-none peer-disabled:opacity-50">
                {busy === "upload" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {t("backups.buttons.upload")}
              </span>
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void load()}
              disabled={loading || busy !== ""}
              title={t("backups.buttons.refresh")}
              aria-label={t("backups.buttons.refresh")}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
          {notice ? (
            <p role="status" className="text-sm text-success">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("backups.listTitle")}</CardTitle>
          <CardDescription>{t("backups.retentionDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("backups.loading")}
            </p>
          ) : null}
          {!loading && state.backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("backups.empty")}
            </p>
          ) : null}
          {state.backups.length > 0 ? (
            <ul className="divide-y">
              {state.backups.map((backup) => (
                <li
                  key={backup.name}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">
                      {backup.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(backup.createdAt).toLocaleString()} ·{" "}
                      {formatBytes(backup.size)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void downloadBackup(backup.name)}
                      disabled={busy !== ""}
                      title={t("backups.buttons.download")}
                    >
                      <Download />
                      {t("backups.buttons.download")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void restoreBackup(backup.name)}
                      disabled={busy !== ""}
                      title={t("backups.buttons.restore")}
                    >
                      {busy === `restore:${backup.name}` ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <RotateCcw />
                      )}
                      {t("backups.buttons.restore")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void deleteBackup(backup.name)}
                      disabled={busy !== ""}
                      title={t("backups.buttons.delete")}
                      aria-label={t("backups.buttons.delete")}
                    >
                      {busy === `delete:${backup.name}` ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
