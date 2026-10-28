"use client";

import type { MutableRefObject } from "react";
import { useState } from "react";
import {
  Copy,
  Download,
  EllipsisVertical,
  FolderInput,
  FolderPlus,
  LoaderCircle,
  Pencil,
  Trash2,
  ArchiveRestore,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UploadProgressList from "@/components/uploads/upload-progress-list";
import type { WorkerListEntry } from "@/components/servers/cards/types";

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

type FileBrowserCardProps = {
  fileActionsBasePath: string;
  onEntryTransferred: (
    source: string,
    dest: string,
    operation: "copy" | "move" | "rename",
  ) => void;
  browserPath: string;
  browserLoading: boolean;
  browserUploadInputKey: number;
  browserUploadFile: File | null;
  browserUploading: boolean;
  uploadScope: string;
  browserError: string;
  browserActionError: string;
  browserEntries: WorkerListEntry[];
  browserDownloadingPath: string;
  browserDeletingPath: string;
  browserUnzippingPath: string;
  groupFiles?: boolean;
  folderCreateBasePath?: string;
  folderNavigationLockedRef: MutableRefObject<boolean>;
  normalizeRelativePath: (value: string) => string;
  formatBytes: (bytes: number) => string;
  isZipArchiveName: (name: string) => boolean;
  onRefresh: () => void;
  onGoUp: () => void;
  onGoRoot: () => void;
  onSelectUploadFile: (file: File | null) => void;
  onUploadToCurrentFolder: () => void;
  onNavigateDirectory: (relativePath: string) => void;
  onOpenFile: (relativePath: string) => void;
  onInvalidFileSelection: () => void;
  onDownload: (
    relativePath: string,
    entryType: WorkerListEntry["type"],
  ) => void;
  onUnzip: (relativePath: string) => void;
  onDelete: (relativePath: string, entryType: WorkerListEntry["type"]) => void;
};

export default function FileBrowserCard({
  fileActionsBasePath,
  onEntryTransferred,
  browserPath,
  browserLoading,
  browserUploadInputKey,
  browserUploadFile,
  browserUploading,
  uploadScope,
  browserError,
  browserActionError,
  browserEntries,
  browserDownloadingPath,
  browserDeletingPath,
  browserUnzippingPath,
  groupFiles = false,
  folderCreateBasePath = "",
  folderNavigationLockedRef,
  normalizeRelativePath,
  formatBytes,
  isZipArchiveName,
  onRefresh,
  onGoUp,
  onGoRoot,
  onSelectUploadFile,
  onUploadToCurrentFolder,
  onNavigateDirectory,
  onOpenFile,
  onInvalidFileSelection,
  onDownload,
  onUnzip,
  onDelete,
}: FileBrowserCardProps) {
  const t = useTranslations("ServerPage");
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState("");
  const [transfer, setTransfer] = useState<{
    operation: "copy" | "move" | "rename";
    source: string;
  } | null>(null);
  const [destination, setDestination] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");
  const isGroupRoot = groupFiles && !browserPath;

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
    if (!transfer || transferring) return;
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
    setTransferring(true);
    setTransferError("");
    try {
      const res = await fetch(`${fileActionsBasePath}/files/transfer`, {
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
      onEntryTransferred(transfer.source, dest, transfer.operation);
      onRefresh();
    } catch {
      setTransferError(t("fileBrowser.transfer.error"));
    } finally {
      setTransferring(false);
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!folderCreateBasePath || !browserPath || !name || creatingFolder) {
      return;
    }
    setCreatingFolder(true);
    setCreateFolderError("");
    try {
      const res = await fetch(`${folderCreateBasePath}/folders/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: browserPath, name }),
      });
      if (!res.ok) {
        setCreateFolderError(
          await responseMessage(res, t("groupFiles.createFolder.error")),
        );
        return;
      }
      setNewFolderName("");
      await onRefresh();
    } catch {
      setCreateFolderError(t("groupFiles.createFolder.error"));
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <Card>
      <Dialog
        open={transfer !== null}
        onOpenChange={(open) => {
          if (!open && !transferring) setTransfer(null);
        }}
      >
        <DialogContent showCloseButton={!transferring}>
          <DialogHeader>
            <DialogTitle>
              {transfer ? t(`fileBrowser.buttons.${transfer.operation}`) : ""}
            </DialogTitle>
            <DialogDescription className="break-all">
              {transfer?.source}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitTransfer();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="file-transfer-destination">
                {t(
                  transfer?.operation === "rename"
                    ? "fileBrowser.transfer.newName"
                    : "fileBrowser.transfer.destination",
                )}
              </Label>
              <Input
                id="file-transfer-destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                disabled={transferring}
                autoFocus
                autoComplete="off"
                required
              />
            </div>
            {transferError ? (
              <p role="alert" className="text-sm text-destructive">
                {transferError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={transferring}
                onClick={() => setTransfer(null)}
              >
                {t("fileBrowser.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={transferring || !destination.trim()}
              >
                {transferring ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                {transferring
                  ? t("fileBrowser.transfer.working")
                  : transfer
                    ? t(`fileBrowser.buttons.${transfer.operation}`)
                    : ""}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CardHeader>
        <CardTitle>
          {groupFiles ? t("groupFiles.title") : t("fileBrowser.title")}
        </CardTitle>
        <CardDescription>
          {groupFiles
            ? t("groupFiles.currentFolder", { path: `/${browserPath || "."}` })
            : t("fileBrowser.currentFolder", {
                path: `/${browserPath || "."}`,
              })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={browserLoading}
          >
            {browserLoading
              ? t("fileBrowser.buttons.loading")
              : t("fileBrowser.buttons.refresh")}
          </Button>
          <Button variant="outline" onClick={onGoUp} disabled={!browserPath}>
            {t("fileBrowser.buttons.upOneLevel")}
          </Button>
          <Button variant="outline" onClick={onGoRoot} disabled={!browserPath}>
            {t("fileBrowser.buttons.goToRoot")}
          </Button>
        </div>
        {!isGroupRoot ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
            <FileInput
              key={browserUploadInputKey}
              className="max-w-xs"
              onChange={(event) =>
                onSelectUploadFile(event.target.files?.[0] || null)
              }
            />
            <Button
              onClick={onUploadToCurrentFolder}
              disabled={!browserUploadFile || browserUploading}
            >
              {browserUploading
                ? t("fileBrowser.buttons.uploading")
                : t("fileBrowser.buttons.uploadToCurrentFolder")}
            </Button>
          </div>
        ) : null}
        <UploadProgressList scope={uploadScope} />
        {groupFiles && browserPath ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder={t("groupFiles.createFolder.placeholder")}
              aria-label={t("groupFiles.createFolder.placeholder")}
            />
            <Button
              onClick={() => void createFolder()}
              disabled={!newFolderName.trim() || creatingFolder}
            >
              {creatingFolder ? (
                t("groupFiles.createFolder.creating")
              ) : (
                <FolderPlus />
              )}
              {creatingFolder ? null : t("groupFiles.createFolder.button")}
            </Button>
          </div>
        ) : null}
        {browserError ? (
          <p className="text-sm text-destructive">{browserError}</p>
        ) : null}
        {browserActionError ? (
          <p className="text-sm text-destructive">{browserActionError}</p>
        ) : null}
        {createFolderError ? (
          <p className="text-sm text-destructive">{createFolderError}</p>
        ) : null}
        <div className="max-h-72 space-y-2 overflow-auto">
          {browserEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("fileBrowser.empty")}
            </p>
          ) : (
            browserEntries.map((entry) => {
              const relativePath = normalizeRelativePath(
                browserPath ? `${browserPath}/${entry.name}` : entry.name,
              );
              const sizeLabel =
                entry.type === "dir" ? "" : formatBytes(entry.size);
              const isDownloading = browserDownloadingPath === relativePath;
              const isDeleting = browserDeletingPath === relativePath;
              const canUnzip =
                entry.type === "file" && isZipArchiveName(entry.name);
              const isUnzipping = browserUnzippingPath === relativePath;
              const isBusy =
                isDownloading || isDeleting || isUnzipping || transferring;
              const canTransfer = entry.type === "file" || entry.type === "dir";
              const typeKey =
                entry.type === "dir"
                  ? "dir"
                  : entry.type === "file"
                    ? "file"
                    : entry.type === "symlink"
                      ? "symlink"
                      : "other";
              const typeLabel = `[${t(`fileBrowser.entryTypes.${typeKey}`)}] `;

              return (
                <div
                  key={`${entry.type}-${entry.name}`}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between text-left"
                    onClick={() => {
                      if (entry.type === "dir") {
                        if (folderNavigationLockedRef.current) {
                          return;
                        }
                        folderNavigationLockedRef.current = true;
                        onNavigateDirectory(relativePath);
                        return;
                      }
                      if (entry.type !== "file") {
                        onInvalidFileSelection();
                        return;
                      }
                      onOpenFile(relativePath);
                    }}
                  >
                    <span className="truncate">
                      {typeLabel}
                      {entry.name}
                    </span>
                    {sizeLabel ? (
                      <span className="ml-3 shrink-0 text-muted-foreground">
                        {sizeLabel}
                      </span>
                    ) : null}
                  </button>
                  {!isGroupRoot ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          disabled={isBusy}
                          aria-label={t("fileBrowser.buttons.actionsFor", {
                            name: entry.name,
                          })}
                          title={t("fileBrowser.buttons.actions")}
                        >
                          {isBusy ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <EllipsisVertical />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            startTransfer("copy", relativePath, entry.name)
                          }
                          disabled={!canTransfer}
                        >
                          <Copy />
                          {t("fileBrowser.buttons.copy")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            startTransfer("move", relativePath, entry.name)
                          }
                          disabled={!canTransfer}
                        >
                          <FolderInput />
                          {t("fileBrowser.buttons.move")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            startTransfer("rename", relativePath, entry.name)
                          }
                          disabled={!canTransfer}
                        >
                          <Pencil />
                          {t("fileBrowser.buttons.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => onDownload(relativePath, entry.type)}
                        >
                          <Download />
                          {t("fileBrowser.buttons.download")}
                        </DropdownMenuItem>
                        {canUnzip ? (
                          <DropdownMenuItem
                            onSelect={() => onUnzip(relativePath)}
                          >
                            <ArchiveRestore />
                            {t("fileBrowser.buttons.unzip")}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDelete(relativePath, entry.type)}
                        >
                          <Trash2 />
                          {t("fileBrowser.buttons.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
