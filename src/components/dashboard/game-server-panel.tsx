"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NodeRole = "owner" | "admin" | "operator" | "viewer";

type GameServerPermissions = {
  canCreate: boolean;
};

type GameServerTemplate = {
  id: string;
  name: string;
};

type GameServer = {
  id: string;
  slug: string;
  name: string;
  templateName: string;
  templateId: string;
  status: "up" | "down" | "unknown";
  permissions: GameServerPermissions;
};

type GameServerPanelProps = {
  nodeRef: string;
  nodeRole: NodeRole | null;
};

export default function GameServerPanel({ nodeRef, nodeRole }: GameServerPanelProps) {
  const [templates, setTemplates] = useState<GameServerTemplate[]>([]);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [templateId, setTemplateId] = useState("");
  const [serverName, setServerName] = useState("");
  const [serverSlug, setServerSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const canCreateByRole = nodeRole === "owner" || nodeRole === "admin";
  const canCreateByAPI = servers.some((server) => server.permissions?.canCreate);
  const canCreate = canCreateByRole || canCreateByAPI;

  const basePath = useMemo(
    () => (nodeRef ? `/api/nodes/${encodeURIComponent(nodeRef)}/servers` : ""),
    [nodeRef]
  );

  const loadData = useCallback(async () => {
    if (!basePath || !nodeRef) {
      setTemplates([]);
      setServers([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [templatesRes, serversRes] = await Promise.all([
        fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers/templates`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${basePath}?includeStatus=1`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const templatesData = (await templatesRes.json().catch(() => ({}))) as {
        templates?: GameServerTemplate[];
        message?: string;
      };
      const serversData = (await serversRes.json().catch(() => ({}))) as {
        servers?: GameServer[];
        message?: string;
      };

      if (!templatesRes.ok) {
        setError(templatesData.message || "Failed to load game server templates.");
        return;
      }
      if (!serversRes.ok) {
        setError(serversData.message || "Failed to load game servers.");
        return;
      }

      const nextTemplates = Array.isArray(templatesData.templates)
        ? templatesData.templates
        : [];
      const nextServers = Array.isArray(serversData.servers) ? serversData.servers : [];

      setTemplates(nextTemplates);
      setServers(nextServers);

      if (!templateId && nextTemplates.length > 0) {
        setTemplateId(nextTemplates[0].id);
      } else if (
        nextTemplates.length > 0 &&
        !nextTemplates.some((template) => template.id === templateId)
      ) {
        setTemplateId(nextTemplates[0].id);
      }
    } catch {
      setError("Failed to load game server data.");
    } finally {
      setLoading(false);
    }
  }, [basePath, nodeRef, templateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createServer = async () => {
    if (!basePath || !templateId) {
      return;
    }

    setCreating(true);
    setError("");
    try {
      const res = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          name: serverName.trim(),
          slug: serverSlug.trim(),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message || "Failed to create game server.");
        return;
      }

      setServerName("");
      setServerSlug("");
      await loadData();
    } catch {
      setError("Failed to create game server.");
    } finally {
      setCreating(false);
    }
  };

  if (!nodeRef) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Game Servers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a node first to manage game servers.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Game Servers (Alpha)</CardTitle>
          <CardDescription>
            Server controls are now on a dedicated detail page per server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="template-id">Template</Label>
              <select
                id="template-id"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                disabled={!canCreate || creating || templates.length === 0}
              >
                {templates.length === 0 ? (
                  <option value="">No templates available</option>
                ) : (
                  templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-name">Name</Label>
              <Input
                id="server-name"
                value={serverName}
                onChange={(event) => setServerName(event.target.value)}
                disabled={!canCreate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-slug">Slug (optional)</Label>
              <Input
                id="server-slug"
                value={serverSlug}
                onChange={(event) => setServerSlug(event.target.value)}
                disabled={!canCreate}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createServer} disabled={!canCreate || creating || !templateId}>
              {creating ? "Creating..." : "Create server"}
            </Button>
            <Button variant="secondary" onClick={loadData} disabled={loading}>
              Refresh
            </Button>
          </div>
          {!canCreate ? (
            <p className="text-xs text-muted-foreground">
              Create permission is limited to owner/admin.
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Server List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {servers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No game servers yet.</p>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {server.name} ({server.slug})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Template: {server.templateName || server.templateId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">
                    {server.status}
                  </span>
                  <Button asChild size="sm">
                    <Link
                      href={`/servers/${encodeURIComponent(nodeRef)}/${encodeURIComponent(
                        server.id
                      )}`}
                    >
                      Open controls
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

