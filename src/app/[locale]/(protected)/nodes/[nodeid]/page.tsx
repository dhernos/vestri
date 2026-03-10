"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import HealthBlob from "@/components/nodes/health";
import NodeAccessCard from "@/components/nodes/cards/node-access-card";
import NodeInfoCard from "@/components/nodes/cards/node-info-card";
import { deleteNodeById, fetchNodeDetails } from "@/features/nodes/api";
import type { WorkerNode } from "@/features/nodes/types";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NodeDetailsPage() {
  const t = useTranslations("NodeDetailsPage");
  const router = useRouter();
  const params = useParams<{ nodeid: string }>();
  const nodeRef = typeof params?.nodeid === "string" ? params.nodeid : "";

  const [node, setNode] = useState<WorkerNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingNode, setDeletingNode] = useState(false);
  const [deleteNodeError, setDeleteNodeError] = useState("");

  const canDeleteNode = useMemo(() => {
    if (!node) return false;
    return node.accessRole === "owner";
  }, [node]);

  const loadNode = useCallback(async (ref: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchNodeDetails(ref);
      if (!result.ok) {
        setError(result.message || t("errors.loadNode"));
        setLoading(false);
        return;
      }
      setNode(result.data);
    } catch {
      setError(t("errors.loadNode"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!nodeRef) {
      setError(t("errors.missingNodeId"));
      setLoading(false);
      return;
    }

    void loadNode(nodeRef);
  }, [loadNode, nodeRef, t]);

  const deleteNode = async () => {
    if (!node || deletingNode) return;
    const confirmed = window.confirm(
      t("delete.confirm", { name: node.name })
    );
    if (!confirmed) {
      return;
    }

    setDeletingNode(true);
    setDeleteNodeError("");
    try {
      const result = await deleteNodeById(node.id);
      if (!result.ok) {
        setDeleteNodeError(result.message || t("delete.error"));
        return;
      }
      router.push("/nodes");
    } catch {
      setDeleteNodeError(t("delete.error"));
    } finally {
      setDeletingNode(false);
    }
  };

  if (loading) {
    return <p className="p-6">{t("loading")}</p>;
  }

  if (error || !node) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <p className="text-red-600">{error || t("errors.notFound")}</p>
        <Button asChild variant="secondary">
          <Link href="/nodes">{t("buttons.backToNodes")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{node.name}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <HealthBlob nodeRef={node.id} />
      </div>

      <NodeInfoCard
        node={node}
        canDeleteNode={canDeleteNode}
        deletingNode={deletingNode}
        deleteNodeError={deleteNodeError}
        onDeleteNode={() => {
          void deleteNode();
        }}
      />

      <NodeAccessCard />

      <div className="flex gap-2">
        <Button asChild variant="secondary">
          <Link href="/nodes">{t("buttons.backToNodes")}</Link>
        </Button>
        <Button asChild>
          <Link href={`/dashboard?node=${encodeURIComponent(node.id)}`}>
            {t("buttons.openDashboardWithNode")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
