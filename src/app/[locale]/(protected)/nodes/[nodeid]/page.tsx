"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import HealthBlob from "@/components/nodes/health";
import { Link, useRouter } from "@/i18n/navigation";
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

type NodeInvite = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  inviterMail: string;
  email: string;
  permission: "admin" | "operator" | "viewer";
  expiresAt: string;
  createdAt: string;
};

type NodeGuest = {
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  userId: string;
  name?: string | null;
  email: string;
  permission: "admin" | "operator" | "viewer";
  createdAt: string;
};

export default function NodeDetailsPage() {
  const router = useRouter();
  const params = useParams<{ nodeid: string }>();
  const nodeRef = typeof params?.nodeid === "string" ? params.nodeid : "";

  const [node, setNode] = useState<WorkerNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [invites, setInvites] = useState<NodeInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState("");
  const [guests, setGuests] = useState<NodeGuest[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [removingGuestUserId, setRemovingGuestUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<
    "admin" | "operator" | "viewer"
  >("operator");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [deletingNode, setDeletingNode] = useState(false);
  const [deleteNodeError, setDeleteNodeError] = useState("");

  const canManageInvites = useMemo(() => {
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

  const loadInvites = async (ref: string) => {
    setInvitesLoading(true);
    setInviteError("");
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(ref)}/invites`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvites([]);
        setInvitesLoading(false);
        return;
      }
      setInvites(Array.isArray(data?.invites) ? data.invites : []);
    } catch {
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  const loadGuests = async (ref: string) => {
    setGuestsLoading(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(ref)}/guests`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGuests([]);
        setGuestsLoading(false);
        return;
      }
      setGuests(Array.isArray(data?.guests) ? data.guests : []);
    } catch {
      setGuests([]);
    } finally {
      setGuestsLoading(false);
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

  useEffect(() => {
    if (!node || !canManageInvites) {
      setInvites([]);
      setGuests([]);
      return;
    }
    loadInvites(node.id);
    loadGuests(node.id);
  }, [node, canManageInvites]);

  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!node) return;

    setInviteSubmitting(true);
    setInviteError("");
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          permission: invitePermission,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data?.message || "Failed to create invite.");
        setInviteSubmitting(false);
        return;
      }

      setInviteEmail("");
      await Promise.all([loadInvites(node.id), loadGuests(node.id)]);
    } catch {
      setInviteError("Failed to create invite.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!node) return;
    setRevokingInviteId(inviteId);
    try {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(node.id)}/invites/${encodeURIComponent(inviteId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) {
        return;
      }
      await loadInvites(node.id);
    } finally {
      setRevokingInviteId("");
    }
  };

  const removeGuest = async (guestUserId: string) => {
    if (!node) return;
    setRemovingGuestUserId(guestUserId);
    try {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(node.id)}/guests/${encodeURIComponent(guestUserId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) {
        return;
      }
      await loadGuests(node.id);
    } finally {
      setRemovingGuestUserId("");
    }
  };

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
          {canManageInvites ? (
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

      {canManageInvites ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-4 md:grid-cols-3" onSubmit={createInvite}>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="friend@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-permission">Role</Label>
                <select
                  id="invite-permission"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={invitePermission}
                  onChange={(event) =>
                    setInvitePermission(
                      event.target.value as "admin" | "operator" | "viewer"
                    )
                  }
                >
                  <option value="admin">admin (full node access)</option>
                  <option value="operator">
                    operator (start/stop/restart + read status)
                  </option>
                  <option value="viewer">viewer (read-only status)</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={inviteSubmitting}>
                  {inviteSubmitting ? "Sending invite..." : "Create invite"}
                </Button>
              </div>
            </form>
            {inviteError ? <p className="text-sm text-red-600">{inviteError}</p> : null}

            <div className="space-y-2">
              <h3 className="font-medium">Pending invites</h3>
              {invitesLoading ? <p className="text-sm">Loading...</p> : null}
              {!invitesLoading && invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invites.</p>
              ) : null}
            {!invitesLoading &&
                invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p>
                        {invite.email} - {invite.permission}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Inviter: {invite.inviterMail} | Expires:{" "}
                        {new Date(invite.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeInvite(invite.id)}
                      disabled={revokingInviteId === invite.id}
                    >
                      {revokingInviteId === invite.id ? "Revoking..." : "Revoke"}
                    </Button>
                  </div>
                ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Guest access</h3>
              {guestsLoading ? <p className="text-sm">Loading...</p> : null}
              {!guestsLoading && guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No guests assigned.</p>
              ) : null}
              {!guestsLoading &&
                guests.map((guest) => (
                  <div
                    key={guest.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p>
                        {guest.name || guest.email} - {guest.permission}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {guest.email} | Added:{" "}
                        {new Date(guest.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeGuest(guest.userId)}
                      disabled={removingGuestUserId === guest.userId}
                    >
                      {removingGuestUserId === guest.userId
                        ? "Removing..."
                        : "Remove access"}
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Invite users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Only the owner can manage invites and guest access.
            </p>
          </CardContent>
        </Card>
      )}

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
