"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decodeEscapedLineBreaks,
  downloadNameFromResponse,
  formatBytes,
  isZipArchiveName,
  normalizeRelativePath,
  parentRelativePath,
  parseConfigRows,
  serializeConfigRows,
  shouldUseKeyValueEditor,
  sortEntries,
} from "@/features/servers/file-utils";
import type { TranslateFn } from "@/features/servers/i18n";
import type { ConfigRow, GameServerConfigFile, WorkerListEntry } from "@/features/servers/types";

type UseServerFilesParams = {
  basePath: string;
  canManageFiles: boolean;
  configFiles: GameServerConfigFile[];
  t: TranslateFn;
};

const folderNavigationDelayMs = 180;

export const useServerFiles = ({
  basePath,
  canManageFiles,
  configFiles,
  t,
}: UseServerFilesParams) => {
  const [browserPath, setBrowserPath] = useState("");
  const [browserEntries, setBrowserEntries] = useState<WorkerListEntry[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const [browserActionError, setBrowserActionError] = useState("");
  const [browserUploadFile, setBrowserUploadFile] = useState<File | null>(null);
  const [browserUploadInputKey, setBrowserUploadInputKey] = useState(0);
  const [browserUploading, setBrowserUploading] = useState(false);
  const [browserDownloadingPath, setBrowserDownloadingPath] = useState("");
  const [browserDeletingPath, setBrowserDeletingPath] = useState("");
  const [browserUnzippingPath, setBrowserUnzippingPath] = useState("");

  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileError, setFileError] = useState("");

  const [selectedConfigFileId, setSelectedConfigFileId] = useState("");
  const [configContent, setConfigContent] = useState("");
  const [configRows, setConfigRows] = useState<ConfigRow[]>([]);
  const [useKeyValueEditor, setUseKeyValueEditor] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState("");

  const folderNavigationLockedRef = useRef(false);
  const folderNavigationUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedConfigFile = useMemo(
    () => configFiles.find((cfg) => cfg.id === selectedConfigFileId),
    [configFiles, selectedConfigFileId]
  );

  useEffect(() => {
    if (configFiles.length > 0 && !configFiles.some((cfg) => cfg.id === selectedConfigFileId)) {
      setSelectedConfigFileId(configFiles[0].id);
      return;
    }
    if (configFiles.length === 0) {
      setSelectedConfigFileId("");
    }
  }, [configFiles, selectedConfigFileId]);

  const loadBrowserEntries = useCallback(async () => {
    if (!canManageFiles || !basePath) {
      setBrowserEntries([]);
      setBrowserError("");
      folderNavigationLockedRef.current = false;
      if (folderNavigationUnlockTimerRef.current) {
        clearTimeout(folderNavigationUnlockTimerRef.current);
        folderNavigationUnlockTimerRef.current = null;
      }
      return;
    }

    setBrowserLoading(true);
    setBrowserError("");
    try {
      const res = await fetch(`${basePath}/files/list?path=${encodeURIComponent(browserPath)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setBrowserEntries([]);
        setBrowserError(message || t("fileBrowser.errors.loadDirectory"));
        return;
      }
      const data = (await res.json().catch(() => [])) as WorkerListEntry[];
      const normalized = Array.isArray(data)
        ? data.filter((entry) => typeof entry?.name === "string")
        : [];
      setBrowserEntries(sortEntries(normalized));
    } catch {
      setBrowserEntries([]);
      setBrowserError(t("fileBrowser.errors.loadDirectory"));
    } finally {
      setBrowserLoading(false);
      if (folderNavigationUnlockTimerRef.current) {
        clearTimeout(folderNavigationUnlockTimerRef.current);
        folderNavigationUnlockTimerRef.current = null;
      }
      folderNavigationUnlockTimerRef.current = setTimeout(() => {
        folderNavigationLockedRef.current = false;
        folderNavigationUnlockTimerRef.current = null;
      }, folderNavigationDelayMs);
    }
  }, [basePath, browserPath, canManageFiles, t]);

  useEffect(() => {
    void loadBrowserEntries();
  }, [loadBrowserEntries]);

  useEffect(() => {
    return () => {
      if (folderNavigationUnlockTimerRef.current) {
        clearTimeout(folderNavigationUnlockTimerRef.current);
        folderNavigationUnlockTimerRef.current = null;
      }
    };
  }, []);

  const openFile = async (relativePath: string) => {
    if (!canManageFiles || !basePath) {
      return;
    }
    const cleanPath = normalizeRelativePath(relativePath);
    if (!cleanPath) {
      return;
    }

    setFilePath(cleanPath);
    setFileLoading(true);
    setFileError("");
    try {
      const res = await fetch(`${basePath}/files/read?path=${encodeURIComponent(cleanPath)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setFileContent("");
        setFileError(message || t("fileEditor.errors.loadFile"));
        return;
      }
      const raw = await res.text();
      setFileContent(decodeEscapedLineBreaks(raw));
    } catch {
      setFileContent("");
      setFileError(t("fileEditor.errors.loadFile"));
    } finally {
      setFileLoading(false);
    }
  };

  const saveFile = async () => {
    if (!canManageFiles || !basePath || !filePath) {
      return;
    }
    setFileSaving(true);
    setFileError("");
    try {
      const res = await fetch(`${basePath}/files/write`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          content: fileContent,
        }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setFileError(message || t("fileEditor.errors.saveFile"));
        return;
      }
      await loadBrowserEntries();
    } catch {
      setFileError(t("fileEditor.errors.saveFile"));
    } finally {
      setFileSaving(false);
    }
  };

  const downloadBrowserPath = async (
    relativePath: string,
    entryType: WorkerListEntry["type"]
  ) => {
    if (!canManageFiles || !basePath) {
      return;
    }
    const cleanPath = normalizeRelativePath(relativePath);
    if (!cleanPath) {
      return;
    }

    const fallbackBase = cleanPath.split("/").pop() || "download";
    const fallbackName = entryType === "dir" ? `${fallbackBase}.zip` : fallbackBase;

    setBrowserDownloadingPath(cleanPath);
    setBrowserActionError("");
    try {
      const res = await fetch(`${basePath}/files/download?path=${encodeURIComponent(cleanPath)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setBrowserActionError(message || t("fileBrowser.errors.downloadPath"));
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadNameFromResponse(
        res.headers.get("Content-Disposition"),
        fallbackName
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setBrowserActionError(t("fileBrowser.errors.downloadPath"));
    } finally {
      setBrowserDownloadingPath("");
    }
  };

  const uploadFileToCurrentFolder = async () => {
    if (!canManageFiles || !basePath || !browserUploadFile) {
      return;
    }

    const uploadPath = normalizeRelativePath(
      browserPath ? `${browserPath}/${browserUploadFile.name}` : browserUploadFile.name
    );
    if (!uploadPath) {
      setBrowserActionError(t("fileBrowser.errors.invalidUploadPath"));
      return;
    }

    const formData = new FormData();
    formData.append("path", uploadPath);
    formData.append("file", browserUploadFile);

    setBrowserUploading(true);
    setBrowserActionError("");
    try {
      const res = await fetch(`${basePath}/files/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setBrowserActionError(message || t("fileBrowser.errors.uploadFile"));
        return;
      }

      setBrowserUploadFile(null);
      setBrowserUploadInputKey((prev) => prev + 1);
      await loadBrowserEntries();
    } catch {
      setBrowserActionError(t("fileBrowser.errors.uploadFile"));
    } finally {
      setBrowserUploading(false);
    }
  };

  const deleteBrowserPath = async (
    relativePath: string,
    entryType: WorkerListEntry["type"]
  ) => {
    if (!canManageFiles || !basePath) {
      return;
    }
    const cleanPath = normalizeRelativePath(relativePath);
    if (!cleanPath) {
      return;
    }

    const label =
      entryType === "dir" ? t("fileBrowser.labels.folder") : t("fileBrowser.labels.file");
    const confirmed = window.confirm(t("fileBrowser.confirmDeletePath", { label, path: cleanPath }));
    if (!confirmed) {
      return;
    }

    setBrowserDeletingPath(cleanPath);
    setBrowserActionError("");
    try {
      const res = await fetch(`${basePath}/files/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: cleanPath,
          recursive: entryType === "dir",
        }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setBrowserActionError(message || t("fileBrowser.errors.deletePath"));
        return;
      }

      if (filePath === cleanPath || filePath.startsWith(`${cleanPath}/`)) {
        setFilePath("");
        setFileContent("");
      }
      await loadBrowserEntries();
    } catch {
      setBrowserActionError(t("fileBrowser.errors.deletePath"));
    } finally {
      setBrowserDeletingPath("");
    }
  };

  const unzipArchiveInCurrentFolder = async (relativePath: string) => {
    if (!canManageFiles || !basePath) {
      return;
    }
    const cleanPath = normalizeRelativePath(relativePath);
    if (!cleanPath || !isZipArchiveName(cleanPath)) {
      return;
    }

    const targetFolder = browserPath || ".";
    setBrowserUnzippingPath(cleanPath);
    setBrowserActionError("");
    try {
      const res = await fetch(`${basePath}/files/unzip`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: cleanPath,
          dest: targetFolder,
        }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setBrowserActionError(message || t("fileBrowser.errors.unzipArchive"));
        return;
      }

      await loadBrowserEntries();
    } catch {
      setBrowserActionError(t("fileBrowser.errors.unzipArchive"));
    } finally {
      setBrowserUnzippingPath("");
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      if (!selectedConfigFile || !canManageFiles || !basePath) {
        setConfigContent("");
        setConfigRows([]);
        setUseKeyValueEditor(false);
        return;
      }

      setConfigLoading(true);
      setConfigError("");
      try {
        const res = await fetch(`${basePath}/files/read?path=${encodeURIComponent(selectedConfigFile.path)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const message = await res.text().catch(() => "");
          setConfigContent("");
          setConfigRows([]);
          setConfigError(message || t("configEditor.errors.loadConfig"));
          setUseKeyValueEditor(false);
          return;
        }

        const raw = await res.text();
        const normalized = decodeEscapedLineBreaks(raw);
        setConfigContent(normalized);

        const keyValue = shouldUseKeyValueEditor(selectedConfigFile.format, normalized);
        setUseKeyValueEditor(keyValue);
        setConfigRows(keyValue ? parseConfigRows(normalized) : []);
      } catch {
        setConfigContent("");
        setConfigRows([]);
        setUseKeyValueEditor(false);
        setConfigError(t("configEditor.errors.loadConfig"));
      } finally {
        setConfigLoading(false);
      }
    };

    void loadConfig();
  }, [basePath, canManageFiles, selectedConfigFile, t]);

  const saveConfig = async () => {
    if (!selectedConfigFile || !basePath || !canManageFiles) {
      return;
    }
    setConfigSaving(true);
    setConfigError("");
    try {
      const finalContent = useKeyValueEditor
        ? serializeConfigRows(configRows)
        : configContent;
      const res = await fetch(`${basePath}/files/write`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedConfigFile.path,
          content: finalContent,
        }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setConfigError(message || t("configEditor.errors.saveConfig"));
        return;
      }
      await loadBrowserEntries();
    } catch {
      setConfigError(t("configEditor.errors.saveConfig"));
    } finally {
      setConfigSaving(false);
    }
  };

  const updateConfigRow = (id: string, patch: Partial<ConfigRow>) => {
    setConfigRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const addConfigRow = () => {
    setConfigRows((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        key: "",
        value: "",
        keyLocked: false,
        valueLocked: false,
        custom: true,
      },
    ]);
  };

  const removeConfigRow = (id: string) => {
    setConfigRows((prev) => prev.filter((row) => row.id !== id));
  };

  const markInvalidFileSelection = () => {
    setFileError(t("fileEditor.errors.onlyRegularTextFiles"));
  };

  return {
    browserPath,
    setBrowserPath,
    browserEntries,
    browserLoading,
    browserError,
    browserActionError,
    browserUploadFile,
    setBrowserUploadFile,
    browserUploadInputKey,
    browserUploading,
    browserDownloadingPath,
    browserDeletingPath,
    browserUnzippingPath,
    filePath,
    fileContent,
    setFileContent,
    fileLoading,
    fileSaving,
    fileError,
    selectedConfigFileId,
    setSelectedConfigFileId,
    configContent,
    setConfigContent,
    configRows,
    useKeyValueEditor,
    configLoading,
    configSaving,
    configError,
    hasSelectedConfigFile: Boolean(selectedConfigFile),
    folderNavigationLockedRef,
    loadBrowserEntries,
    openFile,
    saveFile,
    downloadBrowserPath,
    uploadFileToCurrentFolder,
    deleteBrowserPath,
    unzipArchiveInCurrentFolder,
    saveConfig,
    updateConfigRow,
    addConfigRow,
    removeConfigRow,
    normalizeRelativePath,
    parentRelativePath,
    formatBytes,
    isZipArchiveName,
    markInvalidFileSelection,
  };
};
