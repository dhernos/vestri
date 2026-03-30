"use client";

import type { MutableRefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { WorkerListEntry } from "@/components/servers/cards/types";

type FileBrowserCardProps = {
  browserPath: string;
  browserLoading: boolean;
  browserUploadInputKey: number;
  browserUploadFile: File | null;
  browserUploading: boolean;
  browserError: string;
  browserActionError: string;
  browserEntries: WorkerListEntry[];
  browserDownloadingPath: string;
  browserDeletingPath: string;
  browserUnzippingPath: string;
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
  onDownload: (relativePath: string, entryType: WorkerListEntry["type"]) => void;
  onUnzip: (relativePath: string) => void;
  onDelete: (relativePath: string, entryType: WorkerListEntry["type"]) => void;
};

export default function FileBrowserCard({
  browserPath,
  browserLoading,
  browserUploadInputKey,
  browserUploadFile,
  browserUploading,
  browserError,
  browserActionError,
  browserEntries,
  browserDownloadingPath,
  browserDeletingPath,
  browserUnzippingPath,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fileBrowser.title")}</CardTitle>
        <CardDescription>{t("fileBrowser.currentFolder", { path: `/${browserPath || "."}` })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={browserLoading}>
            {browserLoading ? t("fileBrowser.buttons.loading") : t("fileBrowser.buttons.refresh")}
          </Button>
          <Button variant="outline" onClick={onGoUp} disabled={!browserPath}>
            {t("fileBrowser.buttons.upOneLevel")}
          </Button>
          <Button variant="outline" onClick={onGoRoot} disabled={!browserPath}>
            {t("fileBrowser.buttons.goToRoot")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
          <Input
            key={browserUploadInputKey}
            type="file"
            className="max-w-xs"
            onChange={(event) => onSelectUploadFile(event.target.files?.[0] || null)}
          />
          <Button onClick={onUploadToCurrentFolder} disabled={!browserUploadFile || browserUploading}>
            {browserUploading
              ? t("fileBrowser.buttons.uploading")
              : t("fileBrowser.buttons.uploadToCurrentFolder")}
          </Button>
        </div>
        {browserError ? <p className="text-sm text-destructive">{browserError}</p> : null}
        {browserActionError ? <p className="text-sm text-destructive">{browserActionError}</p> : null}
        <div className="max-h-72 space-y-2 overflow-auto">
          {browserEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("fileBrowser.empty")}</p>
          ) : (
            browserEntries.map((entry) => {
              const relativePath = normalizeRelativePath(
                browserPath ? `${browserPath}/${entry.name}` : entry.name
              );
              const sizeLabel = entry.type === "dir" ? "" : formatBytes(entry.size);
              const isDownloading = browserDownloadingPath === relativePath;
              const isDeleting = browserDeletingPath === relativePath;
              const canUnzip = entry.type === "file" && isZipArchiveName(entry.name);
              const isUnzipping = browserUnzippingPath === relativePath;
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
                    {sizeLabel ? <span className="ml-3 shrink-0 text-muted-foreground">{sizeLabel}</span> : null}
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onDownload(relativePath, entry.type)}
                    disabled={isDownloading || isDeleting || isUnzipping}
                  >
                    {isDownloading ? t("fileBrowser.buttons.downloading") : t("fileBrowser.buttons.download")}
                  </Button>
                  {canUnzip ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUnzip(relativePath)}
                      disabled={isDeleting || isDownloading || isUnzipping}
                    >
                      {isUnzipping ? t("fileBrowser.buttons.unzipping") : t("fileBrowser.buttons.unzip")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(relativePath, entry.type)}
                    disabled={isDeleting || isDownloading || isUnzipping}
                  >
                    {isDeleting ? t("fileBrowser.buttons.deleting") : t("fileBrowser.buttons.delete")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
