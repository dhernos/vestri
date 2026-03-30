"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncomingNodeInvite } from "@/features/nodes/types";

type IncomingInvitesCardProps = {
  loading: boolean;
  invites: IncomingNodeInvite[];
  acceptingInviteId: string;
  onAcceptInvite: (inviteId: string) => void;
};

export default function IncomingInvitesCard({
  loading,
  invites,
  acceptingInviteId,
  onAcceptInvite,
}: IncomingInvitesCardProps) {
  const t = useTranslations("NodesPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("incomingInvites.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p>{t("loading")}</p> : null}
        {!loading && invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("incomingInvites.empty")}</p>
        ) : null}
        {!loading &&
          invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {invite.nodeName} / {invite.serverName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("incomingInvites.meta.nodeServer", {
                    nodeSlug: invite.nodeSlug,
                    serverSlug: invite.serverSlug,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("incomingInvites.meta.roleInviter", {
                    role: invite.permission,
                    inviterMail: invite.inviterMail,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("incomingInvites.meta.expires", {
                    expiresAt: new Date(invite.expiresAt).toLocaleString(),
                  })}
                </p>
              </div>
              <Button
                onClick={() => onAcceptInvite(invite.id)}
                disabled={acceptingInviteId === invite.id}
                size="sm"
              >
                {acceptingInviteId === invite.id
                  ? t("incomingInvites.buttons.accepting")
                  : t("incomingInvites.buttons.accept")}
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
