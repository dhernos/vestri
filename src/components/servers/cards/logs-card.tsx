"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConnectionStatus, ConsoleRefreshMode } from "@/components/servers/cards/types";
import { cn } from "@/lib/utils";

type LogsCardProps = {
  basePath: string;
  consoleRefreshMode: ConsoleRefreshMode;
  canReadConsole: boolean;
  consoleSnapshotLoading: boolean;
  consoleOutput: string;
  consoleStatus: ConnectionStatus;
  isServerUp: boolean;
  consoleError: string;
  consoleOutputRef: RefObject<HTMLPreElement | null>;
  onSetRefreshMode: (mode: ConsoleRefreshMode) => void;
  onRefreshNow: () => void;
  onClearOutput: () => void;
};

type HistoricalLogFile = {
  name: string;
  path: string;
  size: number;
};

type HistoricalLogContent = {
  requestKey: string;
  name: string;
  content: string;
};

type HistoricalLogError = {
  requestKey: string;
  name: string;
  message: string;
};

const responseText = async (response: Response, fallback: string) => {
  const body = (await response.text().catch(() => "")).trim();
  return body || fallback;
};

export default function LogsCard({
  basePath,
  consoleRefreshMode,
  canReadConsole,
  consoleSnapshotLoading,
  consoleOutput,
  consoleStatus,
  isServerUp,
  consoleError,
  consoleOutputRef,
  onSetRefreshMode,
  onRefreshNow,
  onClearOutput,
}: LogsCardProps) {
  const t = useTranslations("ServerPage");
  const [logFiles, setLogFiles] = useState<HistoricalLogFile[]>([]);
  const [selectedLogFile, setSelectedLogFile] = useState("");
  const [logFilesReload, setLogFilesReload] = useState(0);
  const [loadedLogFilesKey, setLoadedLogFilesKey] = useState("");
  const [logFilesError, setLogFilesError] = useState<{
    requestKey: string;
    message: string;
  } | null>(null);
  const [historicalLog, setHistoricalLog] =
    useState<HistoricalLogContent | null>(null);
  const [historicalLogError, setHistoricalLogError] =
    useState<HistoricalLogError | null>(null);
  const logFilesRequestKey = `${basePath}:${logFilesReload}`;
  const historicalLogRequestKey = `${basePath}:${logFilesReload}:${selectedLogFile}`;
  const logFilesLoading =
    Boolean(basePath && canReadConsole) &&
    loadedLogFilesKey !== logFilesRequestKey;
  const historicalLogLoading =
    Boolean(selectedLogFile) &&
    historicalLog?.requestKey !== historicalLogRequestKey &&
    historicalLogError?.requestKey !== historicalLogRequestKey;

  useEffect(() => {
    if (!basePath || !canReadConsole) return;

    const controller = new AbortController();
    const requestKey = logFilesRequestKey;
    void fetch(`${basePath}/console/logs/files`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await responseText(response, t("logs.files.loadListError")));
        }
        const data = (await response.json()) as HistoricalLogFile[];
        return Array.isArray(data)
          ? data.filter(
              (file) =>
                typeof file?.name === "string" &&
                typeof file?.path === "string" &&
                typeof file?.size === "number",
            )
          : [];
      })
      .then((files) => {
        setLogFiles(files);
        setLogFilesError(null);
        setSelectedLogFile((current) =>
          files.some((file) => file.path === current)
            ? current
            : files[0]?.path || "",
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLogFiles([]);
        setSelectedLogFile("");
        setLogFilesError({
          requestKey,
          message:
            error instanceof Error ? error.message : t("logs.files.loadListError"),
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedLogFilesKey(requestKey);
      });

    return () => controller.abort();
  }, [basePath, canReadConsole, logFilesReload, logFilesRequestKey, t]);

  useEffect(() => {
    if (!basePath || !canReadConsole || !selectedLogFile) return;

    const controller = new AbortController();
    const fileName = selectedLogFile;
    const requestKey = historicalLogRequestKey;
    const query = new URLSearchParams({ path: fileName });
    void fetch(`${basePath}/console/logs/file?${query}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await responseText(response, t("logs.files.loadFileError")));
        }
        return response.text();
      })
      .then((content) => {
        setHistoricalLog({ requestKey, name: fileName, content });
        setHistoricalLogError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setHistoricalLogError(
          {
            requestKey,
            name: fileName,
            message:
              error instanceof Error
                ? error.message
                : t("logs.files.loadFileError"),
          },
        );
      });

    return () => controller.abort();
  }, [basePath, canReadConsole, logFilesReload, selectedLogFile, historicalLogRequestKey, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("logs.title")}</CardTitle>
        <CardDescription>{t("logs.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-2 py-1",
              !canReadConsole && "opacity-60"
            )}
          >
            <span
              className={cn(
                "text-xs",
                consoleRefreshMode === "manual" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {t("logs.buttons.manualRefresh")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={consoleRefreshMode === "auto"}
              aria-label={t("logs.refreshModeLabel")}
              onClick={() => onSetRefreshMode(consoleRefreshMode === "auto" ? "manual" : "auto")}
              disabled={!canReadConsole}
              className={cn(
                "relative h-5 w-10 rounded-full border transition-colors",
                consoleRefreshMode === "auto" ? "bg-primary border-primary" : "bg-muted border-border",
                !canReadConsole && "cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 block h-4 w-4 rounded-full bg-background transition-transform",
                  consoleRefreshMode === "auto" ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
            <span
              className={cn(
                "text-xs",
                consoleRefreshMode === "auto" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {t("logs.buttons.autoUpdate")}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={onRefreshNow}
            disabled={!canReadConsole || consoleSnapshotLoading || consoleRefreshMode !== "manual"}
          >
            {consoleSnapshotLoading ? t("logs.buttons.refreshing") : t("logs.buttons.refreshNow")}
          </Button>
          <Button variant="ghost" onClick={onClearOutput} disabled={consoleOutput.length === 0}>
            {t("logs.buttons.clearOutput")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("logs.refreshModeLabel")}{" "}
          {consoleRefreshMode === "auto" ? t("logs.refreshModeAuto") : t("logs.refreshModeManual")}
        </p>
        {consoleRefreshMode === "auto" ? (
          <p className="text-xs text-muted-foreground">
            {t("logs.streamStatusLabel")} {t(`connectionStatus.${consoleStatus}`)}
          </p>
        ) : null}
        {!isServerUp && consoleRefreshMode === "auto" ? (
          <p className="text-xs text-muted-foreground">{t("logs.serverOfflineHint")}</p>
        ) : null}
        {consoleError ? <p className="text-sm text-destructive">{consoleError}</p> : null}
        <pre
          ref={consoleOutputRef}
          className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs"
        >
          {consoleOutput ||
            (consoleSnapshotLoading
              ? t("logs.placeholder.loading")
              : !canReadConsole
              ? t("logs.placeholder.noPermission")
              : consoleRefreshMode === "manual"
              ? t("logs.placeholder.noLogsManual")
              : consoleStatus === "connected"
              ? t("logs.placeholder.connectedWaiting")
              : t("logs.placeholder.waitingStream"))}
        </pre>
          {canReadConsole ? (
            <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">{t("logs.files.title")}</h3>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setLogFilesReload((value) => value + 1)}
              disabled={!basePath || logFilesLoading}
              aria-label={t("logs.files.refresh")}
              title={t("logs.files.refresh")}
            >
              <RefreshCw className={cn(logFilesLoading && "animate-spin")} />
            </Button>
          </div>
          <select
            value={selectedLogFile}
            onChange={(event) => setSelectedLogFile(event.target.value)}
            disabled={!basePath || logFilesLoading || logFiles.length === 0}
            aria-label={t("logs.files.select")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {logFilesLoading
                ? t("logs.files.loadingList")
                : logFiles.length > 0
                  ? t("logs.files.select")
                  : t("logs.files.empty")}
            </option>
            {logFiles.map((file) => (
              <option key={file.path} value={file.path}>
                {file.path}
              </option>
            ))}
          </select>
          {logFilesError?.requestKey === logFilesRequestKey ? (
            <p role="alert" className="text-sm text-destructive">
              {logFilesError.message}
            </p>
          ) : null}
          {historicalLogError?.requestKey === historicalLogRequestKey ? (
            <p role="alert" className="text-sm text-destructive">
              {historicalLogError.message}
            </p>
          ) : null}
          <pre className="max-h-80 min-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {historicalLogLoading
              ? t("logs.files.loadingFile")
              : historicalLog?.requestKey === historicalLogRequestKey
                ? historicalLog.content
                :
                (selectedLogFile ? "" : t("logs.files.selectHint"))}
          </pre>
            </section>
          ) : null}
      </CardContent>
    </Card>
  );
}
