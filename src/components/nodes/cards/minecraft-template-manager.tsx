"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FilePlus,
  Files,
  FolderPlus,
  KeyRound,
  LoaderCircle,
  PackagePlus,
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
import {
  buildTemplateSettings,
  moveSetupAction,
  newMinigameDraft,
  type MinigameDraft,
  type MinigameSpec,
  type SetupAction,
  type TemplateMode,
} from "@/features/nodes/minecraft-template-spec";

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
    mode?: TemplateMode;
    minigame?: MinigameSpec;
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
  options: { id: string; name: string; disabled?: boolean }[];
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
            <SelectItem
              key={option.id}
              value={option.id}
              disabled={option.disabled}
            >
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

type MinigameFormDraft = Omit<MinigameDraft, "actions"> & {
  actions: (SetupAction & { id: string })[];
};

function MinigameSettings({
  draft,
  maxInstances,
  onChange,
}: {
  draft: MinigameFormDraft;
  maxInstances: string;
  onChange: (draft: MinigameFormDraft) => void;
}) {
  const t = useTranslations("NodeDetailsPage.minecraftTemplates.minigame");
  const pluginLobby = draft.lobbyMode === "plugin";
  const permanent = draft.instanceMode === "permanent";
  const hasTeams = draft.teams.split(",").some((team) => team.trim());
  const staleTeamActions =
    !hasTeams &&
    draft.actions.some(
      (action) =>
        action.forEach === "team" || action.command.includes("{team}"),
    );
  const numericFields = [
    { key: "teamSize", min: 1, max: 100 },
    { key: "minPlayers", min: 1, max: 100 },
    { key: "maxPlayers", min: 1, max: 100 },
    { key: "readyServers", min: 0, max: Number(maxInstances) || 0 },
    { key: "joinTimeout", min: 1, max: 600 },
  ] as const;
  const updateAction = (id: string, patch: Partial<SetupAction>) =>
    onChange({
      ...draft,
      actions: draft.actions.map((action) =>
        action.id === id ? { ...action, ...patch } : action,
      ),
    });

  return (
    <div className="min-w-0 space-y-4 border-t pt-4">
      <Choice
        label={t("instanceMode")}
        value={draft.instanceMode ?? "temporary"}
        onChange={(instanceMode) =>
          onChange({
            ...draft,
            instanceMode: instanceMode as MinigameDraft["instanceMode"],
            ...(instanceMode === "permanent" ? { lobbyMode: "plugin" } : {}),
          })
        }
        options={[
          { id: "temporary", name: t("temporary") },
          { id: "permanent", name: t("permanent") },
        ]}
      />
      <Choice
        label={t("lobbyMode")}
        value={draft.lobbyMode ?? "vestri"}
        onChange={(lobbyMode) =>
          onChange({
            ...draft,
            lobbyMode: lobbyMode as MinigameDraft["lobbyMode"],
          })
        }
        options={[
          { id: "vestri", name: t("vestriLobby"), disabled: permanent },
          { id: "plugin", name: t("pluginLobby") },
        ]}
      />
      <label className="block space-y-2 text-sm">
        <span>{t("teams")}</span>
        <Input
          value={draft.teams}
          placeholder={t("teamsPlaceholder")}
          onChange={(event) =>
            onChange({ ...draft, teams: event.target.value })
          }
        />
      </label>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {numericFields
          .filter(
            (field) =>
              (field.key !== "teamSize" || hasTeams) &&
              (field.key !== "minPlayers" || !pluginLobby),
          )
          .map((field) => (
            <label key={field.key} className="min-w-0 space-y-2 text-sm">
              <span
                title={
                  field.key === "readyServers" && permanent
                    ? t("minimumRunningServersHint")
                    : undefined
                }
              >
                {t(
                  field.key === "readyServers" && permanent
                    ? "minimumRunningServers"
                    : field.key,
                )}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                step={1}
                min={field.min}
                max={"max" in field ? field.max : undefined}
                required
                value={draft[field.key]}
                onChange={(event) =>
                  onChange({ ...draft, [field.key]: event.target.value })
                }
              />
            </label>
          ))}
        <Choice
          label={t("readyTrigger")}
          value={draft.readyTrigger}
          onChange={(readyTrigger) =>
            onChange({
              ...draft,
              readyTrigger: readyTrigger as MinigameDraft["readyTrigger"],
            })
          }
          options={[
            { id: "serverLoad", name: t("serverLoad") },
            { id: "explicit", name: t("explicit") },
          ]}
        />
      </div>
      {!pluginLobby ? (
        <fieldset className="min-w-0 space-y-3 border-t pt-3">
          <legend className="px-1 text-sm font-medium">{t("actions")}</legend>
          {staleTeamActions ? (
            <p role="alert" className="text-sm text-destructive">
              {t("errors.teamActions")}
            </p>
          ) : null}
          <ol className="min-w-0 divide-y">
            {draft.actions.map((action, index) => (
              <li key={action.id} className="min-w-0 space-y-2 py-3 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`mc-action-${action.id}`} className="text-sm">
                    {t("commandNumber", { number: index + 1 })}
                  </Label>
                  <div className="flex shrink-0 gap-1">
                    {(
                      [
                        {
                          direction: -1,
                          Icon: ArrowUp,
                          label: "moveUp",
                          disabled: index === 0,
                        },
                        {
                          direction: 1,
                          Icon: ArrowDown,
                          label: "moveDown",
                          disabled: index === draft.actions.length - 1,
                        },
                      ] as const
                    ).map(({ direction, Icon, label, disabled }) => (
                      <Button
                        key={direction}
                        type="button"
                        size="icon"
                        variant="ghost"
                        title={t(label)}
                        aria-label={t(label)}
                        disabled={disabled}
                        onClick={() =>
                          onChange({
                            ...draft,
                            actions: moveSetupAction(
                              draft.actions,
                              index,
                              direction,
                            ),
                          })
                        }
                      >
                        <Icon />
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={t("removeAction")}
                      aria-label={t("removeAction")}
                      onClick={() =>
                        onChange({
                          ...draft,
                          actions: draft.actions.filter(
                            (entry) => entry.id !== action.id,
                          ),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <Input
                  id={`mc-action-${action.id}`}
                  required
                  value={action.command}
                  onChange={(event) =>
                    updateAction(action.id, { command: event.target.value })
                  }
                />
                <Choice
                  label={t("scope")}
                  value={action.forEach || "once"}
                  onChange={(scope) =>
                    updateAction(action.id, {
                      forEach:
                        scope === "once"
                          ? undefined
                          : (scope as "team" | "player"),
                    })
                  }
                  options={[
                    { id: "once", name: t("once") },
                    { id: "team", name: t("perTeam") },
                    { id: "player", name: t("perPlayer") },
                  ].filter(
                    (option) =>
                      option.id !== "team" ||
                      hasTeams ||
                      action.forEach === "team",
                  )}
                />
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            disabled={draft.actions.length >= 100}
            onClick={() =>
              onChange({
                ...draft,
                actions: [
                  ...draft.actions,
                  { id: crypto.randomUUID(), command: "" },
                ],
              })
            }
          >
            <Plus />
            {t("addAction")}
          </Button>
        </fieldset>
      ) : null}
      {!permanent ? (
        <fieldset className="min-w-0 space-y-4 border-t pt-3">
        <legend className="px-1 text-sm font-medium">{t("end")}</legend>
        <label className="block space-y-2 text-sm">
          <span>{t("logPattern")}</span>
          <Input
            value={draft.logPattern}
            onChange={(event) =>
              onChange({ ...draft, logPattern: event.target.value })
            }
          />
        </label>
        <Label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={draft.whenEmpty}
            onChange={(event) =>
              onChange({ ...draft, whenEmpty: event.target.checked })
            }
          />
          {t(draft.logPattern.trim() ? "emptyFallback" : "whenEmpty")}
        </Label>
        <label className="block space-y-2 text-sm">
          <span>{t("emptyGrace")}</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            step={1}
            required
            value={draft.emptyGrace}
            onChange={(event) =>
              onChange({ ...draft, emptyGrace: event.target.value })
            }
          />
        </label>
        <p className="text-sm text-muted-foreground">{t("endOutcome")}</p>
        </fieldset>
      ) : null}
    </div>
  );
}

function MinigameSummary({ spec }: { spec: MinigameSpec }) {
  const t = useTranslations("NodeDetailsPage.minecraftTemplates.minigame");
  const pluginLobby = spec.lobbyMode === "plugin";
  const permanent = spec.instanceMode === "permanent";
  const fields = [
    [t("instanceMode"), t(permanent ? "permanent" : "temporary")],
    [t("lobbyMode"), t(pluginLobby ? "pluginLobby" : "vestriLobby")],
    [t("teams"), spec.teams.length ? spec.teams.join(", ") : t("noTeams")],
    ...(spec.teams.length ? [[t("teamSize"), spec.teamSize]] : []),
    [
      t(pluginLobby ? "maxPlayers" : "players"),
      pluginLobby ? spec.maxPlayers : `${spec.minPlayers} - ${spec.maxPlayers}`,
    ],
    [t(permanent ? "minimumRunningServers" : "readyServers"), spec.readyServers],
    [t("readyTrigger"), t(spec.lifecycle.ready.trigger)],
    [t("joinTimeout"), spec.joinTimeout],
    ...(!permanent
      ? [
          [t("logPattern"), spec.lifecycle.end.logPattern || t("notSet")],
          [t("whenEmpty"), t(spec.lifecycle.end.whenEmpty ? "enabled" : "disabled")],
          ...(spec.lifecycle.end.whenEmpty
            ? [[t("emptyGrace"), spec.lifecycle.end.emptyGrace]]
            : []),
        ]
      : []),
  ];
  return (
    <details className="mt-2 min-w-0 text-xs">
      <summary className="w-fit cursor-pointer text-muted-foreground">
        {t("settings")}
      </summary>
      <dl className="mt-2 grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="break-words text-muted-foreground">{label}</dt>
            <dd className="min-w-0 wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
      {!pluginLobby && spec.lifecycle.onAllJoined.length ? (
        <div className="mt-2">
          <p className="text-muted-foreground">{t("actions")}</p>
          <ol className="list-inside list-decimal space-y-1">
            {spec.lifecycle.onAllJoined.map((action, index) => (
              <li key={index} className="wrap-anywhere">
                <code>{action.command}</code>
                {" · "}
                {t(
                  action.forEach === "team"
                    ? "perTeam"
                    : action.forEach === "player"
                      ? "perPlayer"
                      : "once",
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {!permanent ? (
        <p className="mt-2 text-muted-foreground">{t("endOutcome")}</p>
      ) : null}
    </details>
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
  const [sharedPlugins, setSharedPlugins] = useState<string[]>([]);
  const [sharedPluginOptions, setSharedPluginOptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggleSharedPlugin = (name: string) =>
    setSharedPlugins((current) =>
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name],
    );
  useEffect(
    () =>
      subscribeUploadCompletion(uploadScope, () =>
        setReload((current) => current + 1),
      ),
    [uploadScope],
  );

  useEffect(() => {
    if (resource.kind !== "plugin-packs") return;
    let active = true;
    void fetch(`${apiBase}/files/list?path=plugins`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return [];
        return (await response.json()) as { name?: unknown; type?: unknown }[];
      })
      .then((entries) => {
        if (active) {
          setSharedPluginOptions(
            entries
              .filter(
                (entry) =>
                  typeof entry.name === "string" &&
                  (entry.type === "file" || entry.type === "dir"),
              )
              .map((entry) => entry.name as string),
          );
        }
      })
      .catch(() => {
        if (active) setError(t("sharedLibraryLoadError"));
      });
    return () => {
      active = false;
    };
  }, [apiBase, resource.kind, t]);

  const importSharedPlugins = async () => {
    if (!sharedPlugins.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await responseBody(
        await fetch(`${apiBase}/resources/${resource.id}/shared-plugins`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: sharedPlugins }),
        }),
      );
      setSharedPlugins([]);
      setReload((current) => current + 1);
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  };

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
        {resource.kind === "plugin-packs" ? (
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">
              {t("sharedLibraryPlugins")}
            </legend>
            {sharedPluginOptions.length ? (
              <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                {sharedPluginOptions.map((plugin) => (
                  <Label
                    key={plugin}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={sharedPlugins.includes(plugin)}
                      onChange={() => toggleSharedPlugin(plugin)}
                    />
                    <span className="min-w-0 break-all">{plugin}</span>
                  </Label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("sharedLibraryEmpty")}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !sharedPlugins.length}
              onClick={() => void importSharedPlugins()}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <PackagePlus className="size-4" />
              )}
              {t("importSharedPlugins")}
            </Button>
          </fieldset>
        ) : null}
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
          fileActions
          onChanged={() => setReload((current) => current + 1)}
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
  const [limit, setLimit] = useState("5");
  const [mode, setMode] = useState<TemplateMode>("player");
  const [minigame, setMinigame] = useState<MinigameFormDraft>(() => ({
    ...newMinigameDraft(),
    actions: [],
  }));
  const [agreement, setAgreement] = useState(false);
  const [keyTemplate, setKeyTemplate] = useState("");
  const [keyDays, setKeyDays] = useState(30);
  const [token, setToken] = useState("");
  const spawnRequests = useRef<Record<string, string>>({});
  const templateSettings = buildTemplateSettings(mode, limit, minigame);
  const templateError =
    view === "templates" && "error" in templateSettings
      ? t(`minigame.errors.${templateSettings.error}`)
      : "";

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
    if (view === "templates" && "error" in templateSettings) return;
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
            maxInstances: Number(limit),
            ...(view === "templates" && "spec" in templateSettings
              ? templateSettings.spec
              : {}),
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
      setPluginIds([]);
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
                setPluginIds([]);
                setMode("player");
                setMinigame({ ...newMinigameDraft(), actions: [] });
                setError("");
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
                <p className="break-words text-xs text-muted-foreground">
                  {resource.spec.software} {resource.spec.version}
                  {resource.kind === "templates"
                    ? ` · ${t(resource.spec.mode === "minigames" ? "minigameMode" : "playerMode")} · ${catalog.instances.filter((instance) => instance.templateId === resource.id).length}/${resource.spec.maxInstances}`
                    : ""}
                </p>
                {resource.kind === "templates" &&
                resource.spec.mode === "minigames" &&
                resource.spec.minigame ? (
                  <MinigameSummary spec={resource.spec.minigame} />
                ) : null}
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
            <DialogTitle className="pr-8">
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
                  label={t("mode")}
                  value={mode}
                  onChange={(next) => setMode(next as TemplateMode)}
                  options={[
                    { id: "player", name: t("playerMode") },
                    { id: "minigames", name: t("minigameMode") },
                  ]}
                />
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
                    step={1}
                    inputMode="numeric"
                    required
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                  />
                </label>
                {mode === "minigames" ? (
                  <MinigameSettings
                    draft={minigame}
                    maxInstances={limit}
                    onChange={setMinigame}
                  />
                ) : null}
                {templateError ? (
                  <p
                    role="alert"
                    className="break-words text-sm text-destructive"
                  >
                    {templateError}
                  </p>
                ) : null}
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
                  (view === "templates" &&
                    (!baseId || !parentId || Boolean(templateError))) ||
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
