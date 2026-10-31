"use client";

import { useCallback, useEffect, useState } from "react";
import type { DragEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  EllipsisVertical,
  File as FileIcon,
  Folder as FolderIcon,
  FolderInput,
  LoaderCircle,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileInput } from "@/components/ui/file-input";
import UploadProgressList from "@/components/uploads/upload-progress-list";
import LinkedPaperPlugins from "@/components/servers/cards/linked-paper-plugins";
import {
  decodeEscapedLineBreaks,
  formatBytes,
  sortEntries,
} from "@/features/servers/file-utils";
import type {
  GameServerListItem,
  WorkerListEntry,
} from "@/features/servers/types";
import {
  hasActiveUpload,
  startUpload,
  subscribeUploadCompletion,
  useUploads,
} from "@/features/uploads/upload-store";

type VelocityPluginManagerCardProps = {
  nodeRef: string;
  basePath: string;
  server: GameServerListItem;
  backends: GameServerListItem[];
};

export type EditorTarget = { apiBase: string; path: string };

const pluginMime = "application/x-vestri-plugin";
const pluginSoftware = new Set(["PAPER", "PURPUR", "SPIGOT", "BUKKIT"]);
const stagingRoot = "plugins";
const backendRoot = "data/plugins";

const responseMessage = async (res: Response, fallback: string) => {
  const raw = (await res.text().catch(() => "")).trim();
  if (!raw) {
    return fallback;
  }
  try {
    const data = JSON.parse(raw) as { message?: unknown; error?: unknown };
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
  } catch {
    return raw;
  }
  return raw;
};

type PluginTreeProps = {
  apiBase: string;
  path: string;
  depth?: number;
  reloadKey: number;
  draggableRoot?: boolean;
  fileActions?: boolean;
  onChanged?: () => void;
  emptyLabel: string;
  onEdit: (target: EditorTarget) => void;
};

export function PluginTree({
  apiBase,
  path,
  depth = 0,
  reloadKey,
  draggableRoot = false,
  fileActions = false,
  onChanged,
  emptyLabel,
  onEdit,
}: PluginTreeProps) {
  const t = useTranslations("ServerPage");
  const [entries, setEntries] = useState<WorkerListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [deleting, setDeleting] = useState("");
  const [localKey, setLocalKey] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [transfer, setTransfer] = useState<{
    operation: "copy" | "move" | "rename";
    source: string;
  } | null>(null);
  const [destination, setDestination] = useState("");
  const [transferError, setTransferError] = useState("");

  const refresh = () => {
    if (onChanged) onChanged();
    else setLocalKey((current) => current + 1);
  };
  const startTransfer = (
    operation: "copy" | "move" | "rename",
    source: string,
    name: string,
  ) => {
    setTransfer({ operation, source });
    setDestination(operation === "rename" ? name : source);
    setTransferError("");
  };
  const submitTransfer = async () => {
    if (!transfer || actionBusy) return;
    const target = destination.trim();
    if (
      !target ||
      target.split(/[\\/]/).some((part) => part === ".." || part === ".") ||
      (transfer.operation === "rename" && /[\\/]/.test(target))
    ) {
      setTransferError(t("fileBrowser.transfer.invalidDestination"));
      return;
    }
    const dest =
      transfer.operation === "rename"
        ? `${transfer.source.slice(0, transfer.source.lastIndexOf("/") + 1)}${target}`
        : target;
    if (dest === transfer.source) {
      setTransferError(t("fileBrowser.transfer.sameDestination"));
      return;
    }
    setActionBusy(true);
    setTransferError("");
    try {
      const res = await fetch(`${apiBase}/files/transfer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: transfer.source,
          dest,
          operation: transfer.operation,
        }),
      });
      if (!res.ok) {
        setTransferError(
          await responseMessage(res, t("fileBrowser.transfer.error")),
        );
        return;
      }
      setTransfer(null);
      refresh();
    } catch {
      setTransferError(t("fileBrowser.transfer.error"));
    } finally {
      setActionBusy(false);
    }
  };
  const unzip = async (entryPath: string) => {
    if (actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/files/unzip`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: entryPath,
          dest: entryPath.slice(0, Math.max(0, entryPath.lastIndexOf("/"))),
        }),
      });
      if (!res.ok) {
        setError(
          await responseMessage(res, t("fileBrowser.errors.unzipArchive")),
        );
        return;
      }
      refresh();
    } catch {
      setError(t("fileBrowser.errors.unzipArchive"));
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${apiBase}/files/list?path=${encodeURIComponent(path)}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        if (cancelled) {
          return;
        }
        if (res.status === 404) {
          setEntries([]);
          return;
        }
        if (!res.ok) {
          const message = await responseMessage(
            res,
            t("fileBrowser.errors.loadDirectory"),
          );
          if (!cancelled) {
            setEntries([]);
            setError(message);
          }
          return;
        }
        const data = (await res.json().catch(() => [])) as WorkerListEntry[];
        if (!cancelled) {
          setEntries(
            sortEntries(
              Array.isArray(data)
                ? data.filter((entry) => typeof entry?.name === "string")
                : [],
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setError(t("fileBrowser.errors.loadDirectory"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, path, reloadKey, localKey, t]);

  const remove = async (entry: WorkerListEntry) => {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    const label =
      entry.type === "dir"
        ? t("fileBrowser.labels.folder")
        : t("fileBrowser.labels.file");
    if (
      !window.confirm(
        t("fileBrowser.confirmDeletePath", { label, path: entryPath }),
      )
    ) {
      return;
    }
    setDeleting(entryPath);
    setError("");
    try {
      const res = await fetch(`${apiBase}/files/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: entryPath,
          recursive: entry.type === "dir",
        }),
      });
      if (!res.ok) {
        setError(
          await responseMessage(res, t("fileBrowser.errors.deletePath")),
        );
        return;
      }
      refresh();
    } catch {
      setError(t("fileBrowser.errors.deletePath"));
    } finally {
      setDeleting("");
    }
  };

  const toggle = (entryPath: string) =>
    setExpanded((current) =>
      current.includes(entryPath)
        ? current.filter((item) => item !== entryPath)
        : [...current, entryPath],
    );

  return (
    <div className="space-y-1">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loading && entries.length === 0 ? (
        <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
      ) : null}
      {!loading && !error && entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : null}
      {entries.map((entry) => {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;
        const isDir = entry.type === "dir";
        const isOpen = expanded.includes(entryPath);
        const editable =
          entry.type === "file" &&
          /\.(ya?ml|json|conf|config|toml|txt|properties|cfg|ini|xml|lang|log|sk|js|lua|csv|md|secret)$/i.test(
            entry.name,
          );
        const isDeleting = deleting === entryPath;
        return (
          <div key={`${entry.type}-${entry.name}`}>
            <div
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
              draggable={draggableRoot && depth === 0}
              onDragStart={(event) => {
                event.dataTransfer.setData(pluginMime, entry.name);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              {isDir ? (
                <button
                  type="button"
                  className="shrink-0"
                  aria-label={
                    isOpen
                      ? t("groupFiles.manager.collapse")
                      : t("groupFiles.manager.expand")
                  }
                  onClick={() => toggle(entryPath)}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
              ) : (
                <span className="size-4 shrink-0" />
              )}
              {isDir ? (
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {!isDir ? (
                <span className="shrink-0 text-muted-foreground">
                  {formatBytes(entry.size)}
                </span>
              ) : null}
              {editable ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  title={t("groupFiles.manager.edit")}
                  aria-label={t("groupFiles.manager.edit")}
                  onClick={() => onEdit({ apiBase, path: entryPath })}
                  disabled={isDeleting || actionBusy}
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
              <Button
                asChild
                size="icon"
                variant="ghost"
                className="size-6"
                title={t("fileBrowser.buttons.download")}
                aria-label={t("fileBrowser.buttons.download")}
              >
                <a
                  href={`${apiBase}/files/download?path=${encodeURIComponent(entryPath)}`}
                  download
                >
                  <Download className="size-3.5" />
                </a>
              </Button>
              {fileActions ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 shrink-0"
                      title={t("fileBrowser.buttons.actions")}
                      aria-label={t("fileBrowser.buttons.actions")}
                      disabled={Boolean(deleting) || actionBusy}
                    >
                      <EllipsisVertical className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        startTransfer("copy", entryPath, entry.name)
                      }
                    >
                      <Copy />
                      {t("fileBrowser.buttons.copy")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        startTransfer("move", entryPath, entry.name)
                      }
                    >
                      <FolderInput />
                      {t("fileBrowser.buttons.move")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        startTransfer("rename", entryPath, entry.name)
                      }
                    >
                      <Pencil />
                      {t("fileBrowser.buttons.rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href={`${apiBase}/files/download?path=${encodeURIComponent(entryPath)}&archive=zip`}
                        download
                      >
                        <Archive />
                        {t("fileBrowser.buttons.downloadZip")}
                      </a>
                    </DropdownMenuItem>
                    {!isDir && /\.zip$/i.test(entry.name) ? (
                      <DropdownMenuItem onSelect={() => void unzip(entryPath)}>
                        <ArchiveRestore />
                        {t("fileBrowser.buttons.unzip")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-destructive"
                title={t("fileBrowser.buttons.delete")}
                aria-label={t("fileBrowser.buttons.delete")}
                onClick={() => void remove(entry)}
                disabled={isDeleting || actionBusy}
              >
                {isDeleting ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
            {isDir && isOpen ? (
              <div className="mt-1 ml-4">
                <PluginTree
                  apiBase={apiBase}
                  path={entryPath}
                  depth={depth + 1}
                  reloadKey={reloadKey}
                  fileActions={fileActions}
                  onChanged={onChanged}
                  emptyLabel={emptyLabel}
                  onEdit={onEdit}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {transfer ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !actionBusy) setTransfer(null);
          }}
        >
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {t(`fileBrowser.buttons.${transfer.operation}`)}
              </DialogTitle>
            </DialogHeader>
            <p className="break-all text-sm text-muted-foreground">
              {transfer.source}
            </p>
            <Label>
              {t(
                transfer.operation === "rename"
                  ? "fileBrowser.transfer.newName"
                  : "fileBrowser.transfer.destination",
              )}
              <Input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                disabled={actionBusy}
              />
            </Label>
            {transferError ? (
              <p role="alert" className="text-sm text-destructive">
                {transferError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={actionBusy}
                onClick={() => setTransfer(null)}
              >
                {t("fileBrowser.buttons.cancel")}
              </Button>
              <Button
                disabled={actionBusy}
                onClick={() => void submitTransfer()}
              >
                {actionBusy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {t(`fileBrowser.buttons.${transfer.operation}`)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export function PluginFileEditorDialog({
  target,
  onClose,
}: {
  target: EditorTarget | null;
  onClose: () => void;
}) {
  const t = useTranslations("ServerPage");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      setContent("");
      try {
        const res = await fetch(
          `${target.apiBase}/files/read?path=${encodeURIComponent(target.path)}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        if (!res.ok) {
          const message = await responseMessage(
            res,
            t("fileEditor.errors.loadFile"),
          );
          if (!cancelled) {
            setError(message);
          }
          return;
        }
        const raw = await res.text();
        if (!cancelled) {
          setContent(decodeEscapedLineBreaks(raw));
        }
      } catch {
        if (!cancelled) {
          setError(t("fileEditor.errors.loadFile"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [target, t]);

  const save = async () => {
    if (!target) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${target.apiBase}/files/write`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: target.path, content }),
      });
      if (!res.ok) {
        setError(await responseMessage(res, t("fileEditor.errors.saveFile")));
        return;
      }
      onClose();
    } catch {
      setError(t("fileEditor.errors.saveFile"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("groupFiles.manager.editorTitle")}</DialogTitle>
          <DialogDescription className="break-all">
            {target?.path}
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-80 w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs"
          disabled={loading}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            onClick={() => void save()}
            disabled={loading || saving || Boolean(error && !content)}
          >
            {saving
              ? t("fileEditor.buttons.saving")
              : t("fileEditor.buttons.saveFile")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VelocityPluginManagerCard({
  nodeRef,
  basePath,
  server,
  backends,
}: VelocityPluginManagerCardProps) {
  const t = useTranslations("ServerPage");
  const stagingApi = `${basePath}/group-files`;
  const uploadScope = `${stagingApi}/files/upload`;
  const [stagingReload, setStagingReload] = useState(0);
  const [backendReload, setBackendReload] = useState<Record<string, number>>(
    {},
  );
  const uploading = hasActiveUpload(useUploads(uploadScope));
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOverId, setDragOverId] = useState("");
  const [stagingDragOver, setStagingDragOver] = useState(false);
  const [applyingId, setApplyingId] = useState("");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const targets = [
    server,
    ...backends.filter(
      (backend) =>
        pluginSoftware.has(
          (backend.softwareVersion || "").trim().toUpperCase(),
        ) && backend.permissions.canManageFiles,
    ),
  ];

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (!basePath || files.length === 0) {
        return;
      }
      setMessage(null);
      for (const file of files) {
        startUpload({
          scope: uploadScope,
          url: uploadScope,
          file,
          fields: { path: `${stagingRoot}/${file.name}` },
          fallbackError: t("fileBrowser.errors.uploadFile"),
        });
      }
      setSelectedFiles([]);
      setUploadInputKey((current) => current + 1);
    },
    [basePath, uploadScope, t],
  );

  useEffect(
    () =>
      subscribeUploadCompletion(uploadScope, () =>
        setStagingReload((current) => current + 1),
      ),
    [uploadScope],
  );

  useEffect(() => {
    const scrollPageDuringPluginDrag = (event: globalThis.DragEvent) => {
      if (
        !event.dataTransfer ||
        !Array.from(event.dataTransfer.types).includes(pluginMime)
      ) {
        return;
      }
      const edgeSize = 72;
      if (event.clientY < edgeSize) {
        window.scrollBy(0, -Math.ceil((edgeSize - event.clientY) / 4));
      } else if (window.innerHeight - event.clientY < edgeSize) {
        window.scrollBy(
          0,
          Math.ceil((edgeSize - (window.innerHeight - event.clientY)) / 4),
        );
      }
    };
    document.addEventListener("dragover", scrollPageDuringPluginDrag);
    return () =>
      document.removeEventListener("dragover", scrollPageDuringPluginDrag);
  }, []);

  const applyToBackend = async (
    backend: GameServerListItem,
    items?: string[],
  ) => {
    if (!basePath || applyingId) {
      return;
    }
    setApplyingId(backend.id);
    setMessage(null);
    try {
      const res = await fetch(`${stagingApi}/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverRefs: [backend.id],
          ...(items ? { items } : {}),
        }),
      });
      if (!res.ok) {
        setMessage({
          kind: "error",
          text: await responseMessage(res, t("groupFiles.apply.errors.apply")),
        });
        return;
      }
      setMessage({
        kind: "success",
        text: t("groupFiles.manager.copied", { server: backend.name }),
      });
    } catch {
      setMessage({ kind: "error", text: t("groupFiles.apply.errors.apply") });
    } finally {
      setBackendReload((current) => ({
        ...current,
        [backend.id]: (current[backend.id] || 0) + 1,
      }));
      setApplyingId("");
    }
  };

  const hasType = (event: DragEvent, type: string) =>
    Array.from(event.dataTransfer.types).includes(type);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card
        className={stagingDragOver ? "ring-2 ring-primary" : undefined}
        onDragOver={(event) => {
          if (hasType(event, "Files")) {
            event.preventDefault();
            setStagingDragOver(true);
          }
        }}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setStagingDragOver(false);
          }
        }}
        onDrop={(event) => {
          if (hasType(event, "Files")) {
            event.preventDefault();
            setStagingDragOver(false);
            uploadFiles(Array.from(event.dataTransfer.files));
          }
        }}
      >
        <CardHeader>
          <CardTitle>{t("groupFiles.manager.staging.title")}</CardTitle>
          <CardDescription>
            {t("groupFiles.manager.staging.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <LinkedPaperPlugins
            apiBase={stagingApi}
            onChange={() => {
              setStagingReload((current) => current + 1);
              setBackendReload((current) =>
                Object.fromEntries(
                  targets.map((target) => [
                    target.id,
                    (current[target.id] || 0) + 1,
                  ]),
                ),
              );
            }}
          >
            <div className="max-h-72 overflow-y-auto overscroll-contain pr-1">
              <PluginTree
                apiBase={stagingApi}
                path={stagingRoot}
                reloadKey={stagingReload}
                draggableRoot
                emptyLabel={t("groupFiles.manager.staging.empty")}
                onEdit={setEditor}
              />
            </div>
          </LinkedPaperPlugins>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
            <FileInput
              key={uploadInputKey}
              multiple
              className="max-w-xs"
              aria-label={t("groupFiles.manager.staging.dropHint")}
              onChange={(event) =>
                setSelectedFiles(Array.from(event.target.files || []))
              }
            />
            <Button
              onClick={() => uploadFiles(selectedFiles)}
              disabled={selectedFiles.length === 0 || uploading}
            >
              {uploading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Upload />
              )}
              {uploading
                ? t("groupFiles.manager.staging.uploading")
                : t("groupFiles.manager.staging.upload")}
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              {t("groupFiles.manager.staging.dropHint")}
            </p>
          </div>
          <UploadProgressList scope={uploadScope} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("groupFiles.manager.servers.title")}</CardTitle>
          <CardDescription>
            {t("groupFiles.manager.servers.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {message ? (
            <p
              className={
                message.kind === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-success"
              }
            >
              {message.text}
            </p>
          ) : null}
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("groupFiles.apply.noTargets")}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {targets.map((backend) => {
                const software =
                  (backend.softwareVersion || "").trim().toUpperCase() ||
                  (backend.id === server.id ? "VELOCITY" : "");
                const apiBase =
                  backend.id === server.id
                    ? basePath
                    : `/api/nodes/${encodeURIComponent(nodeRef)}/servers/${encodeURIComponent(backend.id)}`;
                const isDropTarget = dragOverId === backend.id;
                return (
                  <div
                    key={backend.id}
                    className={`space-y-2 rounded-md border p-3 ${isDropTarget ? "border-primary bg-primary/5" : ""}`}
                    onDragOver={(event) => {
                      if (hasType(event, pluginMime)) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setDragOverId(backend.id);
                      }
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      ) {
                        setDragOverId("");
                      }
                    }}
                    onDrop={(event) => {
                      const name = event.dataTransfer.getData(pluginMime);
                      setDragOverId("");
                      if (name) {
                        event.preventDefault();
                        void applyToBackend(backend, [name]);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {backend.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("groupFiles.apply.software", { software })}
                        </p>
                      </div>
                      {applyingId === backend.id ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void applyToBackend(backend)}
                        disabled={Boolean(applyingId)}
                      >
                        {t("groupFiles.manager.servers.applyAll")}
                      </Button>
                    </div>
                    {isDropTarget ? (
                      <p className="text-xs font-medium text-primary">
                        {t("groupFiles.manager.servers.dropHere")}
                      </p>
                    ) : null}
                    <div className="max-h-72 overflow-auto">
                      <PluginTree
                        apiBase={apiBase}
                        path={backendRoot}
                        reloadKey={backendReload[backend.id] || 0}
                        emptyLabel={t(
                          "groupFiles.manager.servers.emptyPlugins",
                        )}
                        onEdit={setEditor}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PluginFileEditorDialog target={editor} onClose={() => setEditor(null)} />
    </div>
  );
}
