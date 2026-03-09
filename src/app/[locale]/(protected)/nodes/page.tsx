"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("NodesPage");
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

  const loadNodes = useCallback(async () => {
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
        setError(data?.message || t("errors.loadNodes"));
        setLoading(false);
        return;
      }
      setNodes(Array.isArray(data?.nodes) ? data.nodes : []);
    } catch {
      setError(t("errors.loadNodes"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadIncomingInvites = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadNodes();
    void loadIncomingInvites();
  }, [loadIncomingInvites, loadNodes]);

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
        setError(data?.message || t("errors.createNode"));
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
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("createNode.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createNode}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="node-name">{t("createNode.fields.name")}</Label>
              <Input
                id="node-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("createNode.fields.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-ip">{t("createNode.fields.host")}</Label>
              <Input
                id="node-ip"
                value={ip}
                onChange={(event) => setIP(event.target.value)}
                placeholder={t("createNode.fields.hostPlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-api-key">{t("createNode.fields.apiKey")}</Label>
              <Input
                id="node-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setAPIKey(event.target.value)}
                placeholder={t("createNode.fields.apiKeyPlaceholder")}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? t("createNode.buttons.creating") : t("createNode.buttons.create")}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("incomingInvites.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingIncoming ? <p>{t("loading")}</p> : null}
          {!loadingIncoming && incomingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("incomingInvites.empty")}</p>
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
                  onClick={() => acceptInvite(invite.id)}
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

      <Card>
        <CardHeader>
          <CardTitle>{t("nodesList.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p>{t("loading")}</p> : null}
          {!loading && nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("nodesList.empty")}</p>
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
                    {t("nodesList.meta.baseUrlKey", {
                      baseUrl: node.baseUrl,
                      apiKey: node.apiKeyPreview,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/dashboard?node=${encodeURIComponent(node.id)}`}>
                      {t("nodesList.buttons.openDashboard")}
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/nodes/${node.slug}`}>{t("nodesList.buttons.details")}</Link>
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
