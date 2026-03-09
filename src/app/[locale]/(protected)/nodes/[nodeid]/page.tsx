"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import HealthBlob from "@/components/nodes/health";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkerNode = {
  id: string;
  slug: string;
  name: string;
  baseUrl: string;
  ownerUserId: string;
  accessRole: "owner" | "admin" | "operator" | "viewer";
  isOwner: boolean;
  apiKeyPreview: string;
  createdAt: string;
  updatedAt: string;
};

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
      const res = await fetch(`/api/nodes/${encodeURIComponent(ref)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || t("errors.loadNode"));
        setLoading(false);
        return;
      }
      setNode(data?.node || null);
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
      const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteNodeError(data?.message || t("delete.error"));
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

      <Card>
        <CardHeader>
          <CardTitle>{t("info.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-medium">{t("info.labels.id")}</span> {node.id}
          </p>
          <p>
            <span className="font-medium">{t("info.labels.slug")}</span> {node.slug}
          </p>
          <p>
            <span className="font-medium">{t("info.labels.role")}</span> {node.accessRole}
          </p>
          <p>
            <span className="font-medium">{t("info.labels.baseUrl")}</span> {node.baseUrl}
          </p>
          <p>
            <span className="font-medium">{t("info.labels.ownerUserId")}</span> {node.ownerUserId}
          </p>
          <p>
            <span className="font-medium">{t("info.labels.apiKey")}</span> {node.apiKeyPreview}
          </p>
          <p>
            <span className="font-medium">{t("info.labels.createdAt")}</span>{" "}
            {new Date(node.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="font-medium">{t("info.labels.updatedAt")}</span>{" "}
            {new Date(node.updatedAt).toLocaleString()}
          </p>
          {canDeleteNode ? (
            <div className="pt-2">
              <Button
                variant="destructive"
                onClick={deleteNode}
                disabled={deletingNode}
              >
                {deletingNode ? t("delete.deleting") : t("delete.button")}
              </Button>
              {deleteNodeError ? (
                <p className="pt-2 text-sm text-red-600">{deleteNodeError}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("access.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("access.description")}
          </p>
        </CardContent>
      </Card>

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
