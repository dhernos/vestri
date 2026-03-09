"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GameServerPanel from "@/components/dashboard/game-server-panel";
import { useAuth } from "@/hooks/useAuth";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

type WorkerNode = {
  id: string;
  slug: string;
  name: string;
  accessRole: "owner" | "admin" | "operator" | "viewer";
};

export default function DashboardPage() {
  const t = useTranslations("DashboardPage");
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [nodes, setNodes] = useState<WorkerNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState("");
  const [selectedNodeRef, setSelectedNodeRef] = useState("");

  const requestedNode = searchParams.get("node") || "";
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeRef) || null,
    [nodes, selectedNodeRef],
  );

  const loadNodes = useCallback(async () => {
    setNodesLoading(true);
    setNodesError("");
    try {
      const res = await fetch("/api/nodes", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNodes([]);
        setNodesError(data?.message || t("errors.loadNodes"));
        return;
      }
      const loadedNodes: WorkerNode[] = Array.isArray(data?.nodes)
        ? data.nodes
        : [];
      setNodes(loadedNodes);
    } catch {
      setNodes([]);
      setNodesError(t("errors.loadNodes"));
    } finally {
      setNodesLoading(false);
    }
  }, [t]);

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
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("benchTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("benchDescription")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("connection.title")}</CardTitle>
          <CardDescription>{t("connection.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-select">{t("connection.nodeLabel")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="node-select"
                className="h-9 min-w-64 rounded-md border bg-transparent px-3 text-sm"
                value={selectedNodeRef}
                onChange={(event) => handleNodeChange(event.target.value)}
                disabled={nodesLoading || nodes.length === 0}
              >
                {nodes.length === 0 ? (
                  <option value="">{t("connection.noNodes")}</option>
                ) : (
                  nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.slug})
                    </option>
                  ))
                )}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  void loadNodes();
                }}
                disabled={nodesLoading}
              >
                {t("buttons.refresh")}
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link href="/nodes">{t("buttons.manageNodes")}</Link>
              </Button>
            </div>
            {nodesError && <p className="text-xs text-red-600">{nodesError}</p>}
            <p className="text-xs text-muted-foreground">
              {t("connection.proxyInfo")}
            </p>
            {selectedNode ? (
              <p className="text-xs text-muted-foreground">
                {t("connection.activeRole", { role: selectedNode.accessRole })}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!nodesLoading && nodes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {t("noNodeAvailable.prefix")}{" "}
              <Link className="underline" href="/nodes">
                /nodes
              </Link>{" "}
              {t("noNodeAvailable.suffix")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <GameServerPanel
        nodeRef={selectedNodeRef}
        nodeRole={selectedNode ? selectedNode.accessRole : null}
      />
    </div>
  );
}
