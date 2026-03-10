"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConnectionStatus, ConsoleRefreshMode } from "@/components/servers/cards/types";

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
          <Button
            variant={consoleRefreshMode === "auto" ? "secondary" : "outline"}
            onClick={() => onSetRefreshMode("auto")}
            disabled={!canReadConsole}
          >
            {t("logs.buttons.autoUpdate")}
          </Button>
          <Button
            variant={consoleRefreshMode === "manual" ? "secondary" : "outline"}
            onClick={() => onSetRefreshMode("manual")}
            disabled={!canReadConsole}
          >
            {t("logs.buttons.manualRefresh")}
          </Button>
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
        {consoleError ? <p className="text-sm text-red-600">{consoleError}</p> : null}
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
