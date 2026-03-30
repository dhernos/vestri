"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import GameServerPanel from "@/components/dashboard/game-server-panel";
import DashboardConnectionCard from "@/components/dashboard/cards/connection-card";
import DashboardNoNodeCard from "@/components/dashboard/cards/no-node-card";
import { ServerWorkspaceShell } from "@/components/servers/server-workspace-shell";
import { useNodesList } from "@/features/nodes/hooks/use-nodes-list";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function DashboardPage() {
  const t = useTranslations("DashboardPage");
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedNodeRef, setSelectedNodeRef] = useState("");

  const {
    nodes,
    loading: nodesLoading,
    error: nodesError,
    loadNodes,
  } = useNodesList({
    loadErrorMessage: t("errors.loadNodes"),
    clearOnError: true,
  });

  const requestedNode = searchParams.get("node") || "";
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeRef) || null,
    [nodes, selectedNodeRef],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    void loadNodes();
  }, [loadNodes, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (nodes.length === 0) {
      setSelectedNodeRef("");
      return;
    }

    if (requestedNode && nodes.some((node) => node.id === requestedNode)) {
      setSelectedNodeRef((current) =>
        current === requestedNode ? current : requestedNode,
      );
      return;
    }

    setSelectedNodeRef((current) => {
      if (current && nodes.some((node) => node.id === current)) {
        return current;
      }
      return nodes[0].id;
    });
  }, [nodes, requestedNode, status]);

  const handleNodeChange = (nextNodeRef: string) => {
    setSelectedNodeRef(nextNodeRef);

    const params = new URLSearchParams(searchParams.toString());
    if (nextNodeRef) {
      params.set("node", nextNodeRef);
    } else {
      params.delete("node");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  if (status === "loading") {
    return <p className="p-6">{t("loading")}</p>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("unauthenticatedMessage")}
        </p>
      </div>
    );
  }

  return (
    <ServerWorkspaceShell
      currentNodeRef={selectedNodeRef}
      onNodeChange={handleNodeChange}
    >
      <div className="container mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("benchTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("benchDescription")}</p>
        </div>

        <DashboardConnectionCard
          nodes={nodes}
          nodesLoading={nodesLoading}
          nodesError={nodesError}
          selectedNodeRef={selectedNodeRef}
          selectedNodeRole={selectedNode ? selectedNode.accessRole : null}
          onNodeChange={handleNodeChange}
          onRefreshNodes={() => {
            void loadNodes();
          }}
        />

        {!nodesLoading && nodes.length === 0 ? (
          <DashboardNoNodeCard />
        ) : null}

        <GameServerPanel
          nodeRef={selectedNodeRef}
          nodeRole={selectedNode ? selectedNode.accessRole : null}
        />
      </div>
    </ServerWorkspaceShell>
  );
}
