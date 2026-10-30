"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  FilePlus,
  Files,
  FolderPlus,
  KeyRound,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PluginFileEditorDialog,
  PluginTree,
  type EditorTarget,
} from "@/components/servers/cards/velocity-plugin-manager-card";
import UploadProgressList from "@/components/uploads/upload-progress-list";
import {
  startUpload,
  subscribeUploadCompletion,
} from "@/features/uploads/upload-store";

type ResourceKind = "bases" | "worlds" | "plugin-packs" | "templates";
type View = ResourceKind | "instances" | "keys";
type Resource = {
  id: string;
  kind: ResourceKind;
  name: string;
  spec: {
    software?: string;
    version?: string;
    baseId?: string;
    worldId?: string;
    parentId?: string;
    maxInstances?: number;
  };
};
type Instance = {
  serverId: string;
  templateId: string;
  keyId: string;
  createdAt: string;
};
type APIKey = {
  id: string;
  name: string;
  templateId: string;
  expiresAt: string;
  revokedAt?: string;
};
type Catalog = { resources: Resource[]; instances: Instance[]; keys: APIKey[] };
type Proxy = { id: string; name: string; kind?: string; templateId: string };
type VersionTemplate = {
  id: string;
  versionConfig?: {
    game?: { options?: string[]; optionsBySoftware?: Record<string, string[]> };
  };
};
const views: View[] = [
  "bases",
  "worlds",
  "plugin-packs",
  "templates",
  "instances",
  "keys",
];

async function responseBody(response: Response) {
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!response.ok)
    throw new Error(
      String(body.message || body.error || raw || response.status),
    );
  return body;
}

function Choice({
  label,
  value,
  onChange,
  options,
  empty,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  empty?: string;
}) {
  return (
    <label className="min-w-0 space-y-2 text-sm">
      <span>{label}</span>
      <Select
        value={value || "__empty"}
        onValueChange={(next) => onChange(next === "__empty" ? "" : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty" disabled={!empty}>
            {empty || label}
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ResourceFiles({
  resource,
  apiBase,
  onClose,
}: {
  resource: Resource;
  apiBase: string;
  onClose: () => void;
}) {
  const t = useTranslations("NodeDetailsPage.minecraftTemplates");
  const serverText = useTranslations("ServerPage");
  const fileApi = `${apiBase}/resources/${resource.id}`;
  const uploadScope = `${fileApi}/files/upload`;
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [destination, setDestination] = useState("");
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      subscribeUploadCompletion(uploadScope, () =>
        setReload((current) => current + 1),
      ),
    [uploadScope],
  );

  const upload = (files: FileList | null) => {
    for (const file of Array.from(files || [])) {
      const relative = file.webkitRelativePath
        ? file.webkitRelativePath.split("/").slice(1).join("/")
        : file.name;
      const target = [destination.trim().replace(/\/$/, ""), relative]
        .filter(Boolean)
        .join("/");
      startUpload({
        scope: uploadScope,
        url: uploadScope,
        file,
        fields: { path: target },
        fallbackError: serverText("fileBrowser.errors.uploadFile"),
      });
    }
  };
  const createEntry = async (folder: boolean) => {
    if (!newPath.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const parts = newPath.trim().split("/");
      await responseBody(
        await fetch(`${fileApi}/${folder ? "folders/create" : "files/write"}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            folder
              ? { path: parts.slice(0, -1).join("/"), name: parts.at(-1) }
              : { path: newPath.trim(), content: "", exclusive: true },
          ),
        }),
      );
      setReload((current) => current + 1);
      if (!folder) setEditor({ apiBase: fileApi, path: newPath.trim() });
      setNewPath("");
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{resource.name}</DialogTitle>
        </DialogHeader>
        <label className="space-y-2 text-sm">
          <span>{t("destination")}</span>
          <Input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="plugins/Example"
          />
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-2 text-sm">
            <span>{t("files")}</span>
            <Input
              type="file"
              multiple
              onChange={(event) => {
                upload(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <label className="min-w-0 space-y-2 text-sm">
            <span>{t("folder")}</span>
            <Input
              type="file"
              multiple
              {...{ webkitdirectory: "" }}
              onChange={(event) => {
                upload(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <UploadProgressList scope={uploadScope} />
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 space-y-2 text-sm">
            <span>{t("newPath")}</span>
            <Input
              value={newPath}
              onChange={(event) => setNewPath(event.target.value)}
            />
          </label>
          <Button
            size="icon"
            variant="secondary"
            title={t("newFile")}
            aria-label={t("newFile")}
            disabled={busy || !newPath.trim()}
            onClick={() => void createEntry(false)}
          >
            <FilePlus />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            title={t("newFolder")}
            aria-label={t("newFolder")}
            disabled={busy || !newPath.trim()}
            onClick={() => void createEntry(true)}
          >
            <FolderPlus />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title={t("refresh")}
            aria-label={t("refresh")}
            onClick={() => setReload((current) => current + 1)}
          >
            <RefreshCw />
          </Button>
        </div>
        {error ? (
          <p role="alert" className="break-words text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <PluginTree
          apiBase={fileApi}
          path=""
          reloadKey={reload}
          emptyLabel={t("empty")}
          onEdit={setEditor}
        />
        <PluginFileEditorDialog
          target={editor}
          onClose={() => {
            setEditor(null);
            setReload((current) => current + 1);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function MinecraftTemplateManager({
  nodeRef,
}: {
  nodeRef: string;
}) {
  const t = useTranslations("NodeDetailsPage.minecraftTemplates");
  const apiBase = `/api/nodes/${encodeURIComponent(nodeRef)}/minecraft`;
  const [catalog, setCatalog] = useState<Catalog>({
    resources: [],
    instances: [],
    keys: [],
  });
  const [view, setView] = useState<View>("bases");
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [versions, setVersions] = useState<Record<string, string[]>>({});
  const [mandatoryChoices, setMandatoryChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [files, setFiles] = useState<Resource | null>(null);
  const [name, setName] = useState("");
  const [software, setSoftware] = useState("PAPER");
  const [version, setVersion] = useState("");
  const [mandatory, setMandatory] = useState<string[]>([]);
  const [baseId, setBaseId] = useState("");
  const [worldId, setWorldId] = useState("");
  const [pluginIds, setPluginIds] = useState<string[]>([]);
  const [parentId, setParentId] = useState("");
  const [limit, setLimit] = useState(5);
  const [agreement, setAgreement] = useState(false);
  const [keyTemplate, setKeyTemplate] = useState("");
  const [keyDays, setKeyDays] = useState(30);
  const [token, setToken] = useState("");
  const spawnRequests = useRef<Record<string, string>>({});

  const refresh = async () => {
    const body = await responseBody(
      await fetch(apiBase, { credentials: "include", cache: "no-store" }),
    );
    setCatalog(body as Catalog);
  };
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [library, serverList, templates, plugins] = await Promise.all([
          fetch(apiBase, { credentials: "include", cache: "no-store" }).then(
            responseBody,
          ),
          fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers`, {
            credentials: "include",
            cache: "no-store",
          }).then(responseBody),
          fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers/templates`, {
            credentials: "include",
            cache: "no-store",
          }).then(responseBody),
          fetch(`${apiBase}/files/list?path=plugins`, {
            credentials: "include",
            cache: "no-store",
          }).then(async (response) => {
            if (!response.ok) return [];
            return response.json() as Promise<{ name: string }[]>;
          }),
        ]);
        if (!active) return;
        setCatalog(library as Catalog);
        setProxies(
          ((serverList.servers || []) as Proxy[]).filter(
            (server) =>
              server.kind === "velocity" ||
              server.templateId === "minecraft-velocity",
          ),
        );
        const config = ((templates.templates || []) as VersionTemplate[]).find(
          (template) => template.id === "minecraft-vanilla",
        )?.versionConfig?.game;
        const resolved: Record<string, string[]> = {};
        for (const kind of ["PAPER", "PURPUR"])
          resolved[kind] = (
            config?.optionsBySoftware?.[kind] ||
            config?.options ||
            []
          ).filter((entry) => /^\d+\.\d+(\.\d+)?$/.test(entry));
        setVersions(resolved);
        setMandatoryChoices(plugins.map((plugin) => plugin.name));
      } catch (failure) {
        if (active) setError(String(failure));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [apiBase, nodeRef]);

  const resourceOptions = (kind: ResourceKind) =>
    catalog.resources
      .filter((resource) => resource.kind === kind)
      .map((resource) => ({ id: resource.id, name: resource.name }));
  const toggle = (current: string[], id: string) =>
    current.includes(id)
      ? current.filter((entry) => entry !== id)
      : [...current, id];
  const resourceName = (id: string) =>
    catalog.resources.find((resource) => resource.id === id)?.name || id;
  const mutate = async (
    id: string,
    url: string,
    method: string,
    body?: unknown,
  ) => {
    if (busy) return;
    setBusy(id);
    setError("");
    try {
      const result = await responseBody(
        await fetch(url, {
          method,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
      await refresh().catch((failure) => setError(String(failure)));
      return result;
    } catch (failure) {
      setError(String(failure));
      await refresh().catch(() => undefined);
    } finally {
      setBusy("");
    }
  };
  const create = async () => {
    const creatingKey = view === "keys";
    const body = creatingKey
      ? { name, templateId: keyTemplate, days: keyDays }
      : {
          kind: view,
          name,
          agreementAccepted: agreement,
          spec: {
            software,
            version,
            mandatoryPlugins: mandatory,
            baseId,
            worldId,
            pluginIds,
            parentId,
            maxInstances: limit,
          },
        };
    const result = await mutate(
      "create",
      `${apiBase}/${creatingKey ? "keys" : "resources"}`,
      "POST",
      body,
    );
    if (result) {
      setCreateOpen(false);
      setName("");
      if (creatingKey) setToken(String(result.token));
      else if (view !== "templates") setFiles(result.resource as Resource);
    }
  };
  const spawn = async (resource: Resource) => {
    const requestId = spawnRequests.current[resource.id] || crypto.randomUUID();
    spawnRequests.current[resource.id] = requestId;
    const result = await mutate(
      resource.id,
      `${apiBase}/resources/${resource.id}/spawn`,
      "POST",
      { requestId },
    );
    if (result) delete spawnRequests.current[resource.id];
  };
  const remove = (
    id: string,
    label: string,
    category: "resources" | "instances" | "keys",
  ) => {
    if (
      window.confirm(
        t(category === "keys" ? "confirmRevoke" : "confirmDelete", {
          name: label,
        }),
      )
    )
      void mutate(
        id,
        `${apiBase}/${category}/${encodeURIComponent(id)}`,
        "DELETE",
      );
  };
  const count = (tab: View) =>
    tab === "keys"
      ? catalog.keys.length
      : tab === "instances"
        ? catalog.instances.length
        : resourceOptions(tab).length;

  return (
    <section
      className="min-w-0 space-y-4"
      aria-labelledby="minecraft-templates-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="minecraft-templates-title" className="text-xl font-semibold">
          {t("title")}
        </h2>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            title={t("refresh")}
            aria-label={t("refresh")}
            disabled={Boolean(busy)}
            onClick={() => {
              setError("");
              void refresh().catch((failure) => setError(String(failure)));
            }}
          >
            <RefreshCw />
          </Button>
          {view !== "instances" ? (
            <Button
              disabled={loading || Boolean(busy)}
              onClick={() => {
                setName("");
                setCreateOpen(true);
              }}
            >
              <Plus />
              {t("create")}
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className="flex flex-wrap gap-1 border-b"
        role="tablist"
        aria-label={t("title")}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = views.indexOf(view);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? views.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    views.length) %
                  views.length;
          setView(views[next]);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>("[role=tab]")
            [next]?.focus();
        }}
      >
        {views.map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            id={`mc-tab-${tab}`}
            aria-controls="mc-resource-panel"
            aria-selected={view === tab}
            tabIndex={view === tab ? 0 : -1}
            onClick={() => setView(tab)}
            className={`border-b-2 px-3 py-2 text-sm ${view === tab ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}
          >
            {t(tab)} <span className="text-xs tabular-nums">{count(tab)}</span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {token ? (
        <div className="flex min-w-0 items-center gap-2 rounded-md border p-3">
          <KeyRound className="size-4 shrink-0" />
          <code className="min-w-0 flex-1 break-all text-xs">{token}</code>
          <Button
            size="icon"
            variant="ghost"
            title={t("copy")}
            aria-label={t("copy")}
            onClick={() => {
              void navigator.clipboard
                .writeText(token)
                .catch((failure) => setError(String(failure)));
            }}
          >
            <Copy />
          </Button>
          <Button variant="ghost" onClick={() => setToken("")}>
            {t("dismiss")}
          </Button>
        </div>
      ) : null}
      <div
        role="tabpanel"
        id="mc-resource-panel"
        aria-labelledby={`mc-tab-${view}`}
        className="min-w-0 divide-y"
      >
        {loading ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : count(view) === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}
        {view === "instances"
          ? catalog.instances.map((instance) => (
              <div
                key={instance.serverId}
                className="flex min-w-0 items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {resourceName(instance.templateId)}
                  </p>
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {instance.serverId}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title={t("delete")}
                  aria-label={t("delete")}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    remove(instance.serverId, instance.serverId, "instances")
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          : null}
        {view === "keys"
          ? catalog.keys.map((key) => (
              <div
                key={key.id}
                className="flex min-w-0 items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{key.name}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {resourceName(key.templateId)} ·{" "}
                    {key.revokedAt
                      ? t("revoked")
                      : new Date(key.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title={t("revoke")}
                  aria-label={t("revoke")}
                  disabled={Boolean(busy) || Boolean(key.revokedAt)}
                  onClick={() => remove(key.id, key.name, "keys")}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          : null}
        {catalog.resources
          .filter((resource) => resource.kind === view)
          .map((resource) => (
            <div
              key={resource.id}
              className="flex min-w-0 items-center gap-2 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{resource.name}</p>
                <p className="text-xs text-muted-foreground">
                  {resource.spec.software} {resource.spec.version}
                  {resource.kind === "templates"
                    ? ` · ${catalog.instances.filter((instance) => instance.templateId === resource.id).length}/${resource.spec.maxInstances}`
                    : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                title={t("files")}
                aria-label={t("files")}
                disabled={Boolean(busy)}
                onClick={() => setFiles(resource)}
              >
                <Files />
              </Button>
              {view === "templates" ? (
                <Button
                  size="icon"
                  variant="secondary"
                  title={t("spawn")}
                  aria-label={t("spawn")}
                  disabled={Boolean(busy)}
                  onClick={() => void spawn(resource)}
                >
                  {busy === resource.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Play />
                  )}
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                title={t("delete")}
                aria-label={t("delete")}
                disabled={Boolean(busy)}
                onClick={() => remove(resource.id, resource.name, "resources")}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
      </div>
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!busy) setCreateOpen(open);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>
              {t("create")} · {t(view)}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <label className="block space-y-2 text-sm">
              <span>{t("name")}</span>
              <Input
                required
                maxLength={64}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {view === "bases" ? (
              <>
                <Choice
                  label={t("software")}
                  value={software}
                  onChange={(next) => {
                    setSoftware(next);
                    setVersion("");
                  }}
                  options={[
                    { id: "PAPER", name: "Paper" },
                    { id: "PURPUR", name: "Purpur" },
                  ]}
                />
                {versions[software]?.length ? (
                  <Choice
                    label={t("version")}
                    value={version}
                    onChange={setVersion}
                    options={versions[software].map((entry) => ({
                      id: entry,
                      name: entry,
                    }))}
                  />
                ) : (
                  <label className="block space-y-2 text-sm">
                    <span>{t("version")}</span>
                    <Input
                      required
                      value={version}
                      placeholder="1.21.4"
                      pattern="[0-9]+\.[0-9]+(\.[0-9]+)?"
                      onChange={(event) => setVersion(event.target.value)}
                    />
                  </label>
                )}
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm">
                    {t("mandatoryPlugins")}
                  </legend>
                  {mandatoryChoices.map((plugin) => (
                    <Label
                      key={plugin}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={mandatory.includes(plugin)}
                        onChange={() =>
                          setMandatory((current) => toggle(current, plugin))
                        }
                      />
                      <span className="break-all">{plugin}</span>
                    </Label>
                  ))}
                </fieldset>
                <Label className="flex items-center gap-2">
                  <input
                    required
                    type="checkbox"
                    checked={agreement}
                    onChange={(event) => setAgreement(event.target.checked)}
                  />
                  <a
                    href="https://aka.ms/MinecraftEULA"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t("eula")}
                  </a>
                </Label>
              </>
            ) : null}
            {view === "templates" ? (
              <>
                <Choice
                  label={t("base")}
                  value={baseId}
                  onChange={setBaseId}
                  options={resourceOptions("bases")}
                />
                <Choice
                  label={t("world")}
                  value={worldId}
                  onChange={setWorldId}
                  options={resourceOptions("worlds")}
                  empty={t("randomWorld")}
                />
                <Choice
                  label={t("proxy")}
                  value={parentId}
                  onChange={setParentId}
                  options={proxies.map((proxy) => ({
                    id: proxy.id,
                    name: proxy.name,
                  }))}
                />
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm">{t("plugin-packs")}</legend>
                  {resourceOptions("plugin-packs").map((plugin) => (
                    <Label key={plugin.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pluginIds.includes(plugin.id)}
                        onChange={() =>
                          setPluginIds((current) => toggle(current, plugin.id))
                        }
                      />
                      {plugin.name}
                    </Label>
                  ))}
                </fieldset>
                <label className="block space-y-2 text-sm">
                  <span>{t("maxInstances")}</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={limit}
                    onChange={(event) => setLimit(Number(event.target.value))}
                  />
                </label>
              </>
            ) : null}
            {view === "keys" ? (
              <>
                <Choice
                  label={t("templates")}
                  value={keyTemplate}
                  onChange={setKeyTemplate}
                  options={resourceOptions("templates")}
                />
                <label className="block space-y-2 text-sm">
                  <span>{t("keyDays")}</span>
                  <Input
                    required
                    type="number"
                    min={1}
                    max={365}
                    value={keyDays}
                    onChange={(event) => setKeyDays(Number(event.target.value))}
                  />
                </label>
              </>
            ) : null}
            {error ? (
              <p role="alert" className="break-words text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  Boolean(busy) ||
                  !name.trim() ||
                  (view === "bases" && (!version || !agreement)) ||
                  (view === "templates" && (!baseId || !parentId)) ||
                  (view === "keys" && !keyTemplate)
                }
              >
                {busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {files ? (
        <ResourceFiles
          key={files.id}
          resource={files}
          apiBase={apiBase}
          onClose={() => setFiles(null)}
        />
      ) : null}
    </section>
  );
}
