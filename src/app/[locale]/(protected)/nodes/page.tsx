"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import CreateNodeCard from "@/components/nodes/cards/create-node-card";
import IncomingInvitesCard from "@/components/nodes/cards/incoming-invites-card";
import NodesListCard from "@/components/nodes/cards/nodes-list-card";
import { ServerWorkspaceShell } from "@/components/servers/server-workspace-shell";
import {
  acceptIncomingNodeInvite,
  createNode as createNodeRequest,
} from "@/features/nodes/api";
import { useIncomingNodeInvites } from "@/features/nodes/hooks/use-incoming-node-invites";
import { useNodesList } from "@/features/nodes/hooks/use-nodes-list";

export default function NodesPage() {
  const t = useTranslations("NodesPage");
  const { nodes, loading, error, setError, loadNodes } = useNodesList({
    loadErrorMessage: t("errors.loadNodes"),
    initialLoading: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const {
    invites: incomingInvites,
    loading: loadingIncoming,
    loadInvites: loadIncomingInvites,
  } = useIncomingNodeInvites();
  const [acceptingInviteId, setAcceptingInviteId] = useState("");

  const [name, setName] = useState("");
  const [ip, setIP] = useState("");
  const [apiKey, setAPIKey] = useState("");

  useEffect(() => {
    void loadNodes();
    void loadIncomingInvites();
  }, [loadIncomingInvites, loadNodes]);

  const createNode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const result = await createNodeRequest({
        name: name.trim(),
        ip: ip.trim(),
        apiKey: apiKey.trim(),
      });
      if (!result.ok) {
        setError(result.message || t("errors.createNode"));
        return;
      }

      setName("");
      setIP("");
      setAPIKey("");
      await loadNodes();
    } catch {
      setError(t("errors.createNode"));
    } finally {
      setSubmitting(false);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    setAcceptingInviteId(inviteId);
    try {
      const result = await acceptIncomingNodeInvite(inviteId);
      if (!result.ok) {
        setAcceptingInviteId("");
        return;
      }
      await Promise.all([loadNodes(), loadIncomingInvites()]);
    } finally {
      setAcceptingInviteId("");
    }
  };

  return (
    <ServerWorkspaceShell
      currentNodeRef=""
      showServerNavigation={false}
      pageTitle={t("title")}
    >
      <div className="container mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <CreateNodeCard
          name={name}
          ip={ip}
          apiKey={apiKey}
          submitting={submitting}
          error={error}
          onNameChange={setName}
          onIpChange={setIP}
          onApiKeyChange={setAPIKey}
          onSubmit={createNode}
        />

        <IncomingInvitesCard
          loading={loadingIncoming}
          invites={incomingInvites}
          acceptingInviteId={acceptingInviteId}
          onAcceptInvite={(inviteId) => {
            void acceptInvite(inviteId);
          }}
        />

        <NodesListCard loading={loading} nodes={nodes} />
      </div>
    </ServerWorkspaceShell>
  );
}
