"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConnectionStatus } from "@/components/servers/cards/types";

type InteractiveConsoleCardProps = {
  canConnectInteractiveConsole: boolean;
  execSessionActive: boolean;
  execStatus: ConnectionStatus;
  isServerUp: boolean;
  execError: string;
  terminalHostRef: RefObject<HTMLDivElement | null>;
  terminalScopeClassName: string;
  onStartSession: () => void;
  onStopSession: () => void;
};

export default function InteractiveConsoleCard({
  canConnectInteractiveConsole,
  execSessionActive,
  execStatus,
  isServerUp,
  execError,
  terminalHostRef,
  terminalScopeClassName,
  onStartSession,
  onStopSession,
}: InteractiveConsoleCardProps) {
  const t = useTranslations("ServerPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("interactive.title")}</CardTitle>
        <CardDescription>{t("interactive.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={onStartSession}
            disabled={!canConnectInteractiveConsole || execSessionActive}
          >
            {execSessionActive ? t("interactive.buttons.sessionRunning") : t("interactive.buttons.startSession")}
          </Button>
          <Button variant="outline" onClick={onStopSession} disabled={!execSessionActive}>
            {t("interactive.buttons.stopSession")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("interactive.sessionStatusLabel")} {t(`connectionStatus.${execStatus}`)}
        </p>
        {!isServerUp ? <p className="text-xs text-muted-foreground">{t("interactive.offlineHint")}</p> : null}
        {execError ? <p className="text-sm text-destructive">{execError}</p> : null}
        {execSessionActive ? (
          <div
            ref={terminalHostRef}
            className={`h-96 w-full overflow-hidden rounded-md border bg-[var(--terminal-bg)] p-2 ${terminalScopeClassName}`}
          />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            {t("interactive.idleHint")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
