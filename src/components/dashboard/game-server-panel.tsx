"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NodeRole = "owner" | "admin" | "operator" | "viewer";

type GameServerPermissions = {
  canCreate: boolean;
};

type GameServerTemplateAgreement = {
  required: boolean;
  title?: string;
  text?: string;
  linkText?: string;
  linkUrl?: string;
};

type GameServerTemplateVersionField = {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  optionsBySoftware?: Record<string, string[]>;
};

type GameServerTemplateVersionConfig = {
  software?: GameServerTemplateVersionField;
  game?: GameServerTemplateVersionField;
};

type GameServerTemplate = {
  id: string;
  name: string;
  agreement?: GameServerTemplateAgreement;
  versionConfig?: GameServerTemplateVersionConfig;
};

type GameServer = {
  id: string;
  slug: string;
  name: string;
  templateName: string;
  templateId: string;
  softwareVersion?: string;
  gameVersion?: string;
  status: "up" | "down" | "unknown";
  permissions: GameServerPermissions;
};

type GameServerPanelProps = {
  nodeRef: string;
  nodeRole: NodeRole | null;
};

const normalizeFieldOptions = (
  field?: GameServerTemplateVersionField,
  software?: string
): string[] => {
  if (!field) {
    return [];
  }

  let sourceOptions: string[] | undefined;
  const normalizedSoftware = software?.trim().toLowerCase() || "";
  if (normalizedSoftware && field.optionsBySoftware) {
    for (const [softwareKey, values] of Object.entries(field.optionsBySoftware)) {
      if (softwareKey.trim().toLowerCase() !== normalizedSoftware) {
        continue;
      }
      sourceOptions = Array.isArray(values) ? values : [];
      break;
    }
  }
  if (!sourceOptions && Array.isArray(field.options)) {
    sourceOptions = field.options;
  }
  if (!Array.isArray(sourceOptions)) {
    return [];
  }

  return sourceOptions
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
};

const resolveFieldValue = (
  current: string,
  field?: GameServerTemplateVersionField,
  software?: string
): string => {
  if (!field) {
    return "";
  }

  const options = normalizeFieldOptions(field, software);
  const trimmedCurrent = current.trim();

  if (trimmedCurrent) {
    if (options.length === 0) {
      return trimmedCurrent;
    }
    const matched = options.find((option) => option.toLowerCase() === trimmedCurrent.toLowerCase());
    if (matched) {
      return matched;
    }
  }

  const defaultValue = (field.defaultValue || "").trim();
  if (defaultValue) {
    if (options.length === 0) {
      return defaultValue;
    }
    const matchedDefault = options.find(
      (option) => option.toLowerCase() === defaultValue.toLowerCase()
    );
    if (matchedDefault) {
      return matchedDefault;
    }
  }

  if (options.length > 0) {
    return options[0];
  }

  return "";
};

export default function GameServerPanel({ nodeRef, nodeRole }: GameServerPanelProps) {
  const [templates, setTemplates] = useState<GameServerTemplate[]>([]);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [templateId, setTemplateId] = useState("");
  const [serverName, setServerName] = useState("");
  const [softwareVersion, setSoftwareVersion] = useState("");
  const [gameVersion, setGameVersion] = useState("");
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const canCreateByRole = nodeRole === "owner" || nodeRole === "admin";
  const canCreateByAPI = servers.some((server) => server.permissions?.canCreate);
  const canCreate = canCreateByRole || canCreateByAPI;

  const basePath = useMemo(
    () => (nodeRef ? `/api/nodes/${encodeURIComponent(nodeRef)}/servers` : ""),
    [nodeRef]
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) || null,
    [templates, templateId]
  );
  const softwareField = selectedTemplate?.versionConfig?.software;
  const gameField = selectedTemplate?.versionConfig?.game;
  const selectedAgreement = selectedTemplate?.agreement;
  const softwareOptions = useMemo(() => normalizeFieldOptions(softwareField), [softwareField]);
  const gameOptions = useMemo(
    () => normalizeFieldOptions(gameField, softwareVersion),
    [gameField, softwareVersion]
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
      const [templatesResult, serversResult] = await Promise.allSettled([
        fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers/templates`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${basePath}?includeStatus=1`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const errors: string[] = [];
      let nextTemplates: GameServerTemplate[] = [];
      let nextServers: GameServer[] = [];

      if (templatesResult.status === "fulfilled") {
        const templatesRes = templatesResult.value;
        const templatesData = (await templatesRes.json().catch(() => ({}))) as {
          templates?: GameServerTemplate[];
          message?: string;
        };

        if (templatesRes.ok) {
          nextTemplates = Array.isArray(templatesData.templates) ? templatesData.templates : [];
        } else {
          errors.push(templatesData.message || "Failed to load game server templates.");
        }
      } else {
        errors.push("Failed to load game server templates.");
      }

      if (serversResult.status === "fulfilled") {
        const serversRes = serversResult.value;
        const serversData = (await serversRes.json().catch(() => ({}))) as {
          servers?: GameServer[];
          message?: string;
        };

        if (serversRes.ok) {
          nextServers = Array.isArray(serversData.servers) ? serversData.servers : [];
        } else {
          errors.push(serversData.message || "Failed to load game servers.");
        }
      } else {
        errors.push("Failed to load game servers.");
      }

      setTemplates(nextTemplates);
      setServers(nextServers);

      if (nextTemplates.length === 0) {
        setTemplateId("");
      } else if (!templateId) {
        setTemplateId(nextTemplates[0].id);
      } else if (
        nextTemplates.length > 0 &&
        !nextTemplates.some((template) => template.id === templateId)
      ) {
        setTemplateId(nextTemplates[0].id);
      }

      if (errors.length > 0) {
        setError(errors.join(" "));
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

  useEffect(() => {
    setSoftwareVersion((current) => resolveFieldValue(current, softwareField));
  }, [softwareField]);

  useEffect(() => {
    setGameVersion((current) => resolveFieldValue(current, gameField, softwareVersion));
  }, [gameField, softwareVersion]);

  const submitCreateServer = async (agreementAccepted: boolean) => {
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
          agreementAccepted,
          softwareVersion: softwareField ? softwareVersion.trim() : "",
          gameVersion: gameField ? gameVersion.trim() : "",
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message || "Failed to create game server.");
        return;
      }

      setServerName("");
      await loadData();
    } catch {
      setError("Failed to create game server.");
    } finally {
      setCreating(false);
    }
  };

  const createServer = async () => {
    if (selectedAgreement?.required) {
      setAgreementOpen(true);
      return;
    }
    await submitCreateServer(false);
  };

  const confirmAgreementAndCreate = async () => {
    await submitCreateServer(true);
    setAgreementOpen(false);
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
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="server-name">Identifier</Label>
              <Input
                id="server-name"
                value={serverName}
                onChange={(event) => setServerName(event.target.value)}
                disabled={!canCreate}
              />
            </div>
            {softwareField ? (
              <div className="space-y-2">
                <Label htmlFor="server-software">{softwareField.label || "Server type"}</Label>
                {softwareOptions.length > 0 ? (
                  <select
                    id="server-software"
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={softwareVersion}
                    onChange={(event) => setSoftwareVersion(event.target.value)}
                    disabled={!canCreate}
                  >
                    {softwareOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="server-software"
                    value={softwareVersion}
                    onChange={(event) => setSoftwareVersion(event.target.value)}
                    placeholder={softwareField.placeholder || ""}
                    disabled={!canCreate}
                  />
                )}
              </div>
            ) : null}
            {gameField ? (
              <div className="space-y-2">
                <Label htmlFor="server-game-version">{gameField.label || "Game version"}</Label>
                {gameOptions.length > 0 ? (
                  <select
                    id="server-game-version"
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={gameVersion}
                    onChange={(event) => setGameVersion(event.target.value)}
                    disabled={!canCreate}
                  >
                    {gameOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="server-game-version"
                    value={gameVersion}
                    onChange={(event) => setGameVersion(event.target.value)}
                    placeholder={gameField.placeholder || ""}
                    disabled={!canCreate}
                  />
                )}
              </div>
            ) : null}
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
          {selectedAgreement?.required ? (
            <p className="text-xs text-muted-foreground">
              This template requires agreement confirmation before the server can be created.
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
                  <p className="text-sm font-medium">{server.name}</p>
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

      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{selectedAgreement?.title || "Template agreement required"}</DialogTitle>
            <DialogDescription>
              {selectedAgreement?.text ||
                "You must accept this agreement before creating the server."}
            </DialogDescription>
          </DialogHeader>
          {selectedAgreement?.linkUrl ? (
            <a
              href={selectedAgreement.linkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-blue-600 underline"
            >
              {selectedAgreement.linkText || selectedAgreement.linkUrl}
            </a>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAgreementOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmAgreementAndCreate} disabled={creating}>
              {creating ? "Creating..." : "I agree and create server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
