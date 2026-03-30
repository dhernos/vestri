"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConnectionStatus, ConsoleRefreshMode } from "@/components/servers/cards/types";
import { cn } from "@/lib/utils";

type LogsCardProps = {
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

export default function LogsCard({
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
      </CardContent>
    </Card>
  );
}
