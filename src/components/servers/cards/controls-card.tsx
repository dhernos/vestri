"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StackActionLoading } from "@/components/servers/cards/types";

type ServerControlsCardProps = {
  canControl: boolean;
  canReadConsole: boolean;
  canManage: boolean;
  stackActionLoading: StackActionLoading;
  serverDeleting: boolean;
  stackError: string;
  deleteError: string;
  onStart: () => void;
  onStop: () => void;
  onRefreshStatus: () => void;
  onDeleteServer: () => void;
};

export default function ServerControlsCard({
  canControl,
  canReadConsole,
  canManage,
  stackActionLoading,
  serverDeleting,
  stackError,
  deleteError,
  onStart,
  onStop,
  onRefreshStatus,
  onDeleteServer,
}: ServerControlsCardProps) {
  const t = useTranslations("ServerPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("controls.title")}</CardTitle>
        <CardDescription>{t("controls.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={onStart} disabled={!canControl || stackActionLoading !== ""}>
            {stackActionLoading === "start" ? t("controls.starting") : t("controls.start")}
          </Button>
          <Button variant="destructive" onClick={onStop} disabled={!canControl || stackActionLoading !== ""}>
            {stackActionLoading === "stop" ? t("controls.stopping") : t("controls.stop")}
          </Button>
          <Button variant="secondary" onClick={onRefreshStatus} disabled={!canReadConsole}>
            {t("controls.refreshStatus")}
          </Button>
          {canManage ? (
            <Button variant="destructive" onClick={onDeleteServer} disabled={serverDeleting}>
              {serverDeleting ? t("controls.deleting") : t("controls.deleteServer")}
            </Button>
          ) : null}
        </div>
        {stackError ? <p className="text-sm text-red-600">{stackError}</p> : null}
        {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
      </CardContent>
    </Card>
  );
}
