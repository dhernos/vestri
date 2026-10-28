"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Copy, Eye, EyeOff, LoaderCircle, Play, Plus, RefreshCw, Square, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  databaseJdbcUrl,
  databaseResponseError,
  isValidDatabaseDisplayName,
  type DatabaseAction,
  type DatabaseEngine,
  type DatabaseEntry,
  type DatabaseState,
} from "@/features/servers/databases";

function ConnectionField({ label, value, secret = false, onCopy }: {
  label: string;
  value: string;
  secret?: boolean;
  onCopy: (value: string) => void;
}) {
  const t = useTranslations("ServerPage.databases");
  const fieldId = useId();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="flex min-w-0 items-center gap-1">
        <Input
          id={fieldId}
          className="min-w-0 flex-1 font-mono text-xs"
          type={secret && !revealed ? "password" : "text"}
          value={value}
          readOnly
          autoComplete="off"
          spellCheck={false}
        />
        {secret ? (
          <Button type="button" size="icon" variant="ghost" className="shrink-0"
            title={t(revealed ? "hidePassword" : "showPassword")}
            aria-label={t(revealed ? "hidePassword" : "showPassword")}
            aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        ) : null}
        <Button type="button" size="icon" variant="ghost" className="shrink-0"
          title={t("copy", { field: label })} aria-label={t("copy", { field: label })}
          onClick={() => onCopy(value)}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default function DatabasesSection({ basePath }: { basePath: string }) {
  const t = useTranslations("ServerPage.databases");
  const formId = useId();
  const [data, setData] = useState<DatabaseState>({ databases: [], templates: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<DatabaseEngine>("mariadb");
  const [deleteTarget, setDeleteTarget] = useState<DatabaseEntry | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const requestLock = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${basePath}/databases`, {
        credentials: "include", cache: "no-store", signal,
      });
      if (!response.ok) throw new Error(await databaseResponseError(response, t("errors.load")));
      const result = await response.json() as DatabaseState;
      if (!Array.isArray(result.databases) || !Array.isArray(result.templates)) {
        throw new Error(t("errors.load"));
      }
      if (!signal?.aborted) setData(result);
    } catch (loadError) {
      if (!signal?.aborted) setError(loadError instanceof Error ? loadError.message : t("errors.load"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [basePath, t]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  useEffect(() => {
    if (busy || loading || !data.databases.some((database) => database.state === "starting")) return;
    const timer = window.setTimeout(() => void load(), 4000);
    return () => window.clearTimeout(timer);
  }, [busy, loading, data.databases, load]);

  const mutate = async (target?: DatabaseEntry, action?: DatabaseAction) => {
    if (requestLock.current || loading) return;
    if (!target && (!isValidDatabaseDisplayName(name) || !data.templates.some((template) => template.id === engine))) return;
    if (action === "delete" && confirmation !== target?.name) return;
    requestLock.current = true;
    setBusy(target?.id || "create");
    setError("");
    setDeleteError("");
    setNotice("");
    try {
      const response = await fetch(`${basePath}/databases${target ? "/action" : ""}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target
          ? { id: target.id, action, ...(action === "delete" ? { confirm: confirmation } : {}) }
          : { name: name.trim(), engine }),
      });
      if (!response.ok) throw new Error(await databaseResponseError(response, t("errors.mutate")));
      if (!target) setName("");
      if (action === "delete") { setDeleteTarget(null); setConfirmation(""); }
      setNotice(t(action ? `notices.${action}` : "notices.create"));
      await load();
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : t("errors.mutate");
      if (action === "delete") setDeleteError(message);
      else setError(message);
    } finally {
      setBusy("");
      requestLock.current = false;
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(t("notices.copied"));
    } catch {
      setError(t("errors.copy"));
    }
  };

  return (
    <section className="min-w-0 space-y-6" aria-labelledby={`${formId}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${formId}-title`} className="text-xl font-semibold">{t("title")}</h2>
        <Button type="button" size="icon" variant="outline" disabled={loading || Boolean(busy)}
          title={t("refresh")} aria-label={t("refresh")} onClick={() => void load()}>
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>{t("networkNotice")}</p>
        <p>{t("credentialsNotice")}</p>
      </div>
      <form className="flex flex-wrap items-end gap-3 border-b pb-6" onSubmit={(event) => { event.preventDefault(); void mutate(); }}>
        <div className="min-w-0 flex-[1_1_14rem] space-y-2">
          <Label htmlFor={`${formId}-name`}>{t("name")}</Label>
          <Input id={`${formId}-name`} value={name} onChange={(event) => setName(event.target.value)}
            required maxLength={48} disabled={Boolean(busy)} autoComplete="off" />
        </div>
        <div className="min-w-0 flex-[1_1_12rem] space-y-2">
          <Label htmlFor={`${formId}-engine`}>{t("engine")}</Label>
          <Select value={engine} onValueChange={(value) => setEngine(value as DatabaseEngine)} disabled={loading || Boolean(busy) || !data.templates.length}>
            <SelectTrigger id={`${formId}-engine`} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading || Boolean(busy) || !isValidDatabaseDisplayName(name) || !data.templates.some((template) => template.id === engine)}>
          {busy === "create" ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {t(busy === "create" ? "creating" : "create")}
        </Button>
      </form>
      {error ? <p role="alert" className="wrap-break-word text-sm text-destructive">{error}</p> : null}
      <p role="status" className="text-sm text-muted-foreground">{notice || (loading ? t("loading") : "")}</p>
      {!loading && !error && !data.templates.length ? <p className="text-sm text-muted-foreground">{t("noTemplates")}</p> : null}
      {!loading && !error && !data.databases.length ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      <div className="space-y-4" aria-busy={loading}>
        {data.databases.map((database) => {
          const jdbc = databaseJdbcUrl(database);
          const disabled = loading || Boolean(busy);
          return (
            <Card key={database.id} className="min-w-0">
              <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="wrap-break-word text-base">{database.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{database.engine === "mariadb" ? "MariaDB" : "PostgreSQL"}</p>
                  <p className="flex items-center gap-2 text-sm" role="status">
                    <span className={`size-2 shrink-0 rounded-full ${database.state === "running" ? "bg-success" : database.state === "stopped" ? "bg-destructive" : "bg-muted-foreground"}`} />
                    {t(`states.${database.state}`)}
                    {busy === database.id ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button type="button" size="icon" variant="outline" title={t("start")} aria-label={t("start")}
                    disabled={disabled || database.state === "running" || database.state === "starting"} onClick={() => void mutate(database, "start")}><Play className="size-4" /></Button>
                  <Button type="button" size="icon" variant="outline" title={t("stop")} aria-label={t("stop")}
                    disabled={disabled || database.state === "stopped"} onClick={() => void mutate(database, "stop")}><Square className="size-4" /></Button>
                  <Button type="button" size="icon" variant="outline" className="text-destructive" title={t("delete")} aria-label={t("delete")}
                    disabled={disabled} onClick={() => { setDeleteTarget(database); setConfirmation(""); setDeleteError(""); }}><Trash2 className="size-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {database.error ? <p role="alert" className="wrap-break-word text-sm text-destructive">{database.error}</p> : null}
                <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ConnectionField label={t("host")} value={database.host} onCopy={(value) => void copy(value)} />
                  <ConnectionField label={t("port")} value={String(database.port)} onCopy={(value) => void copy(value)} />
                  <ConnectionField label={t("database")} value={database.database} onCopy={(value) => void copy(value)} />
                  <ConnectionField label={t("username")} value={database.username} onCopy={(value) => void copy(value)} />
                  <ConnectionField label={t("password")} value={database.password} secret onCopy={(value) => void copy(value)} />
                </div>
                <ConnectionField label={t("jdbc")} value={jdbc} onCopy={(value) => void copy(value)} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open && !busy) { setDeleteTarget(null); setConfirmation(""); setDeleteError(""); }
      }}>
        <DialogContent className="min-w-0">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription className="wrap-break-word">{t("deleteDescription", { name: deleteTarget?.name || "" })}</DialogDescription>
          </DialogHeader>
          <form className="min-w-0 space-y-4" onSubmit={(event) => { event.preventDefault(); if (deleteTarget) void mutate(deleteTarget, "delete"); }}>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-confirm`}>{t("confirmName")}</Label>
              <Input id={`${formId}-confirm`} value={confirmation} autoComplete="off" disabled={Boolean(busy)}
                onChange={(event) => setConfirmation(event.target.value)} />
            </div>
            {deleteError ? <p role="alert" className="wrap-break-word text-sm text-destructive">{deleteError}</p> : null}
            <DialogFooter className="flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => setDeleteTarget(null)}>{t("cancel")}</Button>
              <Button type="submit" variant="destructive" disabled={Boolean(busy) || loading || confirmation !== deleteTarget?.name}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{t("delete")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}