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
  imageUpdateAvailable: boolean;
  imageStatusError: string;
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
  stackActionLoading,
  imageUpdateAvailable,
  imageStatusError,
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
          <Button onClick={onStart} disabled={!canControl || stackActionLoading !== ""}>
            {stackActionLoading === "start" ? t("controls.starting") : t("controls.start")}
          </Button>
          <Button variant="destructive" onClick={onStop} disabled={!canControl || stackActionLoading !== ""}>
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
        <span
          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            imageUpdateAvailable
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {imageUpdateAvailable
            ? t("controls.imageStatusUpdateAvailable")
            : t("controls.imageStatusUpToDate")}
        </span>
        {imageUpdateAvailable ? (
          <p className="text-sm text-muted-foreground">{t("controls.imageUpdateAvailable")}</p>
        ) : null}
        {imageStatusError ? <p className="text-sm text-red-600">{imageStatusError}</p> : null}
        {stackError ? <p className="text-sm text-red-600">{stackError}</p> : null}
        {imageRepullError ? <p className="text-sm text-red-600">{imageRepullError}</p> : null}
        {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
      </CardContent>
    </Card>
  );
}
