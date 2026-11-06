"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import NotificationCenter from "@/components/notifications/notification-center";
import IncomingInvitesCard from "@/components/nodes/cards/incoming-invites-card";
import { ServerWorkspaceShell } from "@/components/servers/server-workspace-shell";
import { acceptIncomingNodeInvite } from "@/features/nodes/api";
import { useIncomingNodeInvites } from "@/features/nodes/hooks/use-incoming-node-invites";

export default function NotificationsPage() {
  const t = useTranslations("NotificationsPage");
  const {
    invites: incomingInvites,
    loading,
    loadInvites,
  } = useIncomingNodeInvites();
  const [acceptingInviteId, setAcceptingInviteId] = useState("");

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const acceptInvite = async (inviteId: string) => {
    setAcceptingInviteId(inviteId);
    try {
      const result = await acceptIncomingNodeInvite(inviteId);
      if (!result.ok) {
        return;
      }
      await loadInvites();
    } finally {
      setAcceptingInviteId("");
    }
  };

  return (
    <ServerWorkspaceShell currentNodeRef="" pageTitle={t("title")}>
      <div className="container mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
        </div>

        <NotificationCenter />
        <IncomingInvitesCard
          loading={loading}
          invites={incomingInvites}
          acceptingInviteId={acceptingInviteId}
          onAcceptInvite={(inviteId) => {
            void acceptInvite(inviteId);
          }}
        />
      </div>
    </ServerWorkspaceShell>
  );
}
