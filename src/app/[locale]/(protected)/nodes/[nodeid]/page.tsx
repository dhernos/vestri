"use client";

import { useEffect, useMemo, useState } from "react";
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

  const loadNode = async (ref: string) => {
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
        setError(data?.message || "Failed to load node.");
        setLoading(false);
        return;
      }
      setNode(data?.node || null);
    } catch {
      setError("Failed to load node.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!nodeRef) {
      setError("Missing node id.");
      setLoading(false);
      return;
    }

    loadNode(nodeRef);
  }, [nodeRef]);

  const deleteNode = async () => {
    if (!node || deletingNode) return;
    const confirmed = window.confirm(
      `Delete node "${node.name}" and all game servers on it?`
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
        setDeleteNodeError(data?.message || "Failed to delete node.");
        return;
      }
      router.push("/nodes");
    } catch {
      setDeleteNodeError("Failed to delete node.");
    } finally {
      setDeletingNode(false);
    }
  };

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  if (error || !node) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <p className="text-red-600">{error || "Node not found."}</p>
        <Button asChild variant="secondary">
          <Link href="/nodes">Back to nodes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{node.name}</h1>
          <p className="text-sm text-muted-foreground">Detailed node view</p>
        </div>
        <HealthBlob nodeRef={node.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Node information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-medium">ID:</span> {node.id}
          </p>
          <p>
            <span className="font-medium">Slug:</span> {node.slug}
          </p>
          <p>
            <span className="font-medium">Role:</span> {node.accessRole}
          </p>
          <p>
            <span className="font-medium">Base URL:</span> {node.baseUrl}
          </p>
          <p>
            <span className="font-medium">Owner user ID:</span> {node.ownerUserId}
          </p>
          <p>
            <span className="font-medium">API key:</span> {node.apiKeyPreview}
          </p>
          <p>
            <span className="font-medium">Created:</span>{" "}
            {new Date(node.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="font-medium">Updated:</span>{" "}
            {new Date(node.updatedAt).toLocaleString()}
          </p>
          {canDeleteNode ? (
            <div className="pt-2">
              <Button
                variant="destructive"
                onClick={deleteNode}
                disabled={deletingNode}
              >
                {deletingNode ? "Deleting node..." : "Delete node"}
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
          <CardTitle>Access Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Invites and guest permissions are managed per game server. Open a
            game server and use its controls page to manage access.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild variant="secondary">
          <Link href="/nodes">Back to nodes</Link>
        </Button>
        <Button asChild>
          <Link href={`/dashboard?node=${encodeURIComponent(node.id)}`}>
            Open dashboard with node
          </Link>
        </Button>
      </div>
    </div>
  );
}
