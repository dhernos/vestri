"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ServerStatusBlob from "@/components/servers/status-blob";
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
import { normalizeFieldOptions, resolveFieldValue } from "@/features/servers/template-version";
import type { NodeAccessRole } from "@/features/nodes/types";
import type {
  GameServerListItem,
  GameServerTemplate,
  ServerStatus,
} from "@/features/servers/types";

type GameServerPanelProps = {
  nodeRef: string;
  nodeRole: NodeAccessRole | null;
};

export default function GameServerPanel({ nodeRef, nodeRole }: GameServerPanelProps) {
  const t = useTranslations("GameServerPanel");
  const [templates, setTemplates] = useState<GameServerTemplate[]>([]);
  const [servers, setServers] = useState<GameServerListItem[]>([]);
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

  const statusLabel = useCallback(
    (status: ServerStatus) => t(`status.${status}`),
    [t]
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
      let nextServers: GameServerListItem[] = [];

      if (templatesResult.status === "fulfilled") {
        const templatesRes = templatesResult.value;
        const templatesData = (await templatesRes.json().catch(() => ({}))) as {
          templates?: GameServerTemplate[];
          message?: string;
        };

        if (templatesRes.ok) {
          nextTemplates = Array.isArray(templatesData.templates) ? templatesData.templates : [];
        } else {
          errors.push(templatesData.message || t("errors.loadTemplates"));
        }
      } else {
        errors.push(t("errors.loadTemplates"));
      }

      if (serversResult.status === "fulfilled") {
        const serversRes = serversResult.value;
        const serversData = (await serversRes.json().catch(() => ({}))) as {
          servers?: GameServerListItem[];
          message?: string;
        };

        if (serversRes.ok) {
          nextServers = Array.isArray(serversData.servers) ? serversData.servers : [];
        } else {
          errors.push(serversData.message || t("errors.loadServers"));
        }
      } else {
        errors.push(t("errors.loadServers"));
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
      setError(t("errors.loadData"));
    } finally {
      setLoading(false);
    }
  }, [basePath, nodeRef, t, templateId]);

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

      if (!res.ok) {
        setError(t("errors.createServer"));
        return;
      }

      setServerName("");
      await loadData();
    } catch {
      setError(t("errors.createServer"));
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
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("selectNodeFirst")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("titleAlpha")}</CardTitle>
          <CardDescription>
            {t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-id">{t("fields.template")}</Label>
              <select
                id="template-id"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                disabled={!canCreate || creating || templates.length === 0}
              >
                {templates.length === 0 ? (
                  <option value="">{t("empty.templates")}</option>
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
              <Label htmlFor="server-name">{t("fields.identifier")}</Label>
              <Input
                id="server-name"
                value={serverName}
                onChange={(event) => setServerName(event.target.value)}
                disabled={!canCreate}
              />
            </div>
            {softwareField ? (
              <div className="space-y-2">
                <Label htmlFor="server-software">{softwareField.label || t("fields.serverType")}</Label>
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
                <Label htmlFor="server-game-version">{gameField.label || t("fields.gameVersion")}</Label>
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
              {creating ? t("buttons.creating") : t("buttons.createServer")}
            </Button>
            <Button variant="secondary" onClick={loadData} disabled={loading}>
              {t("buttons.refresh")}
            </Button>
          </div>
          {!canCreate ? (
            <p className="text-xs text-muted-foreground">
              {t("permissions.createLimited")}
            </p>
          ) : null}
          {selectedAgreement?.required ? (
            <p className="text-xs text-muted-foreground">
              {t("agreement.requiredInfo")}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("serverList.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {servers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty.servers")}</p>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <ServerStatusBlob status={server.status} size="md" label={statusLabel(server.status)} />
                    <span>{server.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("serverList.templateLabel")}: {server.templateName || server.templateId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link
                      href={`/servers/${encodeURIComponent(nodeRef)}/${encodeURIComponent(
                        server.id
                      )}`}
                    >
                      {t("buttons.openControls")}
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
            <DialogTitle>{selectedAgreement?.title || t("agreement.title")}</DialogTitle>
            <DialogDescription>
              {selectedAgreement?.text || t("agreement.description")}
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
              {t("buttons.cancel")}
            </Button>
            <Button type="button" onClick={confirmAgreementAndCreate} disabled={creating}>
              {creating ? t("buttons.creating") : t("buttons.agreeAndCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
