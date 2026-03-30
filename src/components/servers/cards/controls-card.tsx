"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StackActionLoading } from "@/components/servers/cards/types";

type ServerControlsCardProps = {
  canControl: boolean;
  canReadConsole: boolean;
  canManage: boolean;
  isServerUp: boolean;
  stackActionLoading: StackActionLoading;
  imageRepulling: boolean;
  serverDeleting: boolean;
  stackError: string;
  imageRepullError: string;
  deleteError: string;
  onStart: () => void;
  onStop: () => void;
  onRepullImages: () => void;
  onRefreshStatus: () => void;
  onDeleteServer: () => void;
};

export default function ServerControlsCard({
  canControl,
  canReadConsole,
  canManage,
  isServerUp,
  stackActionLoading,
  imageRepulling,
  serverDeleting,
  stackError,
  imageRepullError,
  deleteError,
  onStart,
  onStop,
  onRepullImages,
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
          <Button onClick={onStart} disabled={!canControl || stackActionLoading !== "" || isServerUp}>
            {stackActionLoading === "start" ? t("controls.starting") : t("controls.start")}
          </Button>
          <Button
            variant="destructive"
            onClick={onStop}
            disabled={!canControl || stackActionLoading !== "" || !isServerUp}
          >
            {stackActionLoading === "stop" ? t("controls.stopping") : t("controls.stop")}
          </Button>
          <Button
            variant="outline"
            onClick={onRepullImages}
            disabled={!canControl || imageRepulling || stackActionLoading !== ""}
          >
            {imageRepulling ? t("controls.repulling") : t("controls.repullImages")}
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
        {stackError ? <p className="text-sm text-destructive">{stackError}</p> : null}
        {imageRepullError ? <p className="text-sm text-destructive">{imageRepullError}</p> : null}
        {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
      </CardContent>
    </Card>
  );
}
