"use client";

import { FormEvent, useEffect, useState } from "react";
import HealthBlob from "@/components/nodes/health";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type IncomingInvite = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  serverId: string;
  serverName: string;
  serverSlug: string;
  inviterMail: string;
  permission: "admin" | "operator" | "viewer";
  expiresAt: string;
};

export default function NodesPage() {
  const [nodes, setNodes] = useState<WorkerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [incomingInvites, setIncomingInvites] = useState<IncomingInvite[]>([]);
  const [loadingIncoming, setLoadingIncoming] = useState(true);
  const [acceptingInviteId, setAcceptingInviteId] = useState("");

  const [name, setName] = useState("");
  const [ip, setIP] = useState("");
  const [apiKey, setAPIKey] = useState("");

  const loadNodes = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/nodes", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to load nodes.");
        setLoading(false);
        return;
      }
      setNodes(Array.isArray(data?.nodes) ? data.nodes : []);
    } catch {
      setError("Failed to load nodes.");
    } finally {
      setLoading(false);
    }
  };

  const loadIncomingInvites = async () => {
    setLoadingIncoming(true);
    try {
      const res = await fetch("/api/nodes/invites", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIncomingInvites([]);
        setLoadingIncoming(false);
        return;
      }
      setIncomingInvites(Array.isArray(data?.invites) ? data.invites : []);
    } catch {
      setIncomingInvites([]);
    } finally {
      setLoadingIncoming(false);
    }
  };

  useEffect(() => {
    loadNodes();
    loadIncomingInvites();
  }, []);

  const createNode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ip: ip.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to create node.");
        return;
      }

      setName("");
      setIP("");
      setAPIKey("");
      await loadNodes();
    } catch {
      setError("Failed to create node.");
    } finally {
      setSubmitting(false);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    setAcceptingInviteId(inviteId);
    try {
      const res = await fetch(
        `/api/nodes/invites/${encodeURIComponent(inviteId)}/accept`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!res.ok) {
        setAcceptingInviteId("");
        return;
      }
      await Promise.all([loadNodes(), loadIncomingInvites()]);
    } finally {
      setAcceptingInviteId("");
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Nodes</h1>
        <p className="text-sm text-muted-foreground">
          Create nodes and accept server invites.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add worker node</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createNode}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="node-name">Name (optional)</Label>
              <Input
                id="node-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="EU-West Minecraft Node"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-ip">IP / Host / URL</Label>
              <Input
                id="node-ip"
                value={ip}
                onChange={(event) => setIP(event.target.value)}
                placeholder="192.168.1.23:8031"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-api-key">API key</Label>
              <Input
                id="node-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setAPIKey(event.target.value)}
                placeholder="Worker API key"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create node"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incoming invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingIncoming ? <p>Loading...</p> : null}
          {!loadingIncoming && incomingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          ) : null}
          {!loadingIncoming &&
            incomingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {invite.nodeName} / {invite.serverName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Node: {invite.nodeSlug} | Server: {invite.serverSlug}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Role: {invite.permission} | Invited by: {invite.inviterMail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires: {new Date(invite.expiresAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  onClick={() => acceptInvite(invite.id)}
                  disabled={acceptingInviteId === invite.id}
                  size="sm"
                >
                  {acceptingInviteId === invite.id ? "Accepting..." : "Accept"}
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accessible nodes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p>Loading...</p> : null}
          {!loading && nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes available.</p>
          ) : null}
          {!loading &&
            nodes.map((node) => (
              <div
                key={node.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <HealthBlob nodeRef={node.id} />
                    <p className="font-medium">{node.name}</p>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">
                      {node.accessRole}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {node.baseUrl} | Key: {node.apiKeyPreview}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/dashboard?node=${encodeURIComponent(node.id)}`}>
                      Open dashboard
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/nodes/${node.slug}`}>Details</Link>
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
