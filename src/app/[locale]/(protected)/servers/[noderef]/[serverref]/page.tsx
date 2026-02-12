"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ServerStatus = "up" | "down" | "unknown";

type GameServerPermissions = {
  canView: boolean;
  canCreate: boolean;
  canControl: boolean;
  canManageFiles: boolean;
  canReadConsole: boolean;
};

type GameServerConfigFile = {
  id: string;
  title: string;
  path: string;
  format: string;
};

type GameServer = {
  id: string;
  nodeId: string;
  slug: string;
  name: string;
  templateId: string;
  templateName: string;
  stackName: string;
  rootPath: string;
  composePath: string;
  configFiles: GameServerConfigFile[];
  status: ServerStatus;
  statusOutput?: string;
  statusError?: string;
  permissions: GameServerPermissions;
};

type WorkerListEntry = {
  name: string;
  type: "dir" | "file" | "symlink" | "other";
  size: number;
};

type ConfigRow = {
  id: string;
  key: string;
  value: string;
  keyLocked: boolean;
  valueLocked: boolean;
  custom: boolean;
};

const keyValueFormats = new Set(["properties", "env", "ini", "cfg", "config", "kv"]);

const normalizeRelativePath = (value: string) => {
  const parts = value
    .replaceAll("\\", "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== ".");

  const clean: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      clean.pop();
      continue;
    }
    clean.push(part);
  }
  return clean.join("/");
};

const parentRelativePath = (value: string) => {
  const clean = normalizeRelativePath(value);
  if (!clean) {
    return "";
  }
  const parts = clean.split("/");
  parts.pop();
  return parts.join("/");
};

const joinRootPath = (rootPath: string, relativePath: string) => {
  const cleanRoot = rootPath.replaceAll("\\", "/").replace(/\/+$/, "");
  const cleanRelative = normalizeRelativePath(relativePath);
  if (!cleanRelative) {
    return cleanRoot;
  }
  return `${cleanRoot}/${cleanRelative}`;
};

const sortEntries = (entries: WorkerListEntry[]) =>
  [...entries].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });

const decodeEscapedLineBreaks = (value: string) => {
  if (value.includes("\n") || value.includes("\r")) {
    return value;
  }
  return value
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r");
};

const shouldUseKeyValueEditor = (format: string, content: string) => {
  const normalizedFormat = format.trim().toLowerCase();
  if (keyValueFormats.has(normalizedFormat)) {
    return true;
  }

  const lines = content
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length === 0) {
    return false;
  }

  const dataLines = lines.filter(
    (line) => !line.startsWith("#") && !line.startsWith(";")
  );
  if (dataLines.length === 0) {
    return false;
  }

  return dataLines.every((line) => line.includes("=") || line.includes(":"));
};

const parseConfigRows = (content: string): ConfigRow[] => {
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  const rows: ConfigRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
      rows.push({
        id: `row-${i}-${Math.random().toString(36).slice(2, 9)}`,
        key: line,
        value: "",
        keyLocked: true,
        valueLocked: true,
        custom: false,
      });
      continue;
    }

    const eqIdx = line.indexOf("=");
    const colonIdx = line.indexOf(":");
    let splitAt = -1;
    if (eqIdx >= 0 && colonIdx >= 0) {
      splitAt = Math.min(eqIdx, colonIdx);
    } else if (eqIdx >= 0) {
      splitAt = eqIdx;
    } else if (colonIdx >= 0) {
      splitAt = colonIdx;
    }

    if (splitAt < 0) {
      rows.push({
        id: `row-${i}-${Math.random().toString(36).slice(2, 9)}`,
        key: line,
        value: "",
        keyLocked: true,
        valueLocked: true,
        custom: false,
      });
      continue;
    }

    rows.push({
      id: `row-${i}-${Math.random().toString(36).slice(2, 9)}`,
      key: line.slice(0, splitAt).trim(),
      value: line.slice(splitAt + 1),
      keyLocked: true,
      valueLocked: false,
      custom: false,
    });
  }

  return rows;
};

const serializeConfigRows = (rows: ConfigRow[]) => {
  const lines: string[] = [];
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value;

    if (row.custom && key === "" && value.trim() === "") {
      continue;
    }
    if (row.valueLocked && !row.custom) {
      if (row.key.trim() !== "") {
        lines.push(row.key);
      }
      continue;
    }
    if (key === "") {
      continue;
    }
    lines.push(`${key}=${value}`);
  }

  if (lines.length === 0) {
    return "";
  }
  return `${lines.join("\n")}\n`;
};

export default function ServerControlsPage() {
  const router = useRouter();
  const params = useParams<{ noderef: string; serverref: string }>();
  const nodeRef = typeof params?.noderef === "string" ? params.noderef : "";
  const serverRef = typeof params?.serverref === "string" ? params.serverref : "";

  const [server, setServer] = useState<GameServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stackActionLoading, setStackActionLoading] = useState<"" | "start" | "stop">("");
  const [stackError, setStackError] = useState("");
  const [serverDeleting, setServerDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [browserPath, setBrowserPath] = useState("");
  const [browserEntries, setBrowserEntries] = useState<WorkerListEntry[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState("");

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

  const basePath = useMemo(() => {
    if (!nodeRef || !serverRef) {
      return "";
    }
    return `/api/nodes/${encodeURIComponent(nodeRef)}/servers/${encodeURIComponent(serverRef)}`;
  }, [nodeRef, serverRef]);

  const loadServer = useCallback(async () => {
    if (!basePath) {
      setLoading(false);
      setError("Missing route params.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${basePath}?includeStatus=1`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        server?: GameServer;
        message?: string;
      };
      if (!res.ok || !data.server) {
        setServer(null);
        setError(data.message || "Failed to load server.");
        return;
      }
      setServer(data.server);
      setStackError("");
    } catch {
      setServer(null);
      setError("Failed to load server.");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadServer();
  }, [loadServer]);

  useEffect(() => {
    if (!server) {
      setSelectedConfigFileId("");
      return;
    }
    if (
      server.configFiles.length > 0 &&
      !server.configFiles.some((cfg) => cfg.id === selectedConfigFileId)
    ) {
      setSelectedConfigFileId(server.configFiles[0].id);
      return;
    }
    if (server.configFiles.length === 0) {
      setSelectedConfigFileId("");
    }
  }, [selectedConfigFileId, server]);

  const runStackAction = async (action: "start" | "stop") => {
    if (!server || !basePath) {
      return;
    }
    setStackActionLoading(action);
    setStackError("");
    try {
      const res = await fetch(`${basePath}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setStackError(data.message || `Failed to ${action} server.`);
        return;
      }
      await loadServer();
    } catch {
      setStackError(`Failed to ${action} server.`);
    } finally {
      setStackActionLoading("");
    }
  };

  const refreshStatus = async () => {
    if (!server || !basePath) {
      return;
    }
    try {
      const res = await fetch(`${basePath}/status`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: ServerStatus;
        output?: string;
        error?: string;
      };
      if (!res.ok) {
        return;
      }
      setServer((prev) =>
        prev
          ? {
              ...prev,
              status: data.status || "unknown",
              statusOutput: data.output || "",
              statusError: data.error || "",
            }
          : prev
      );
    } catch {
      // background refresh only
    }
  };

  const deleteServer = async () => {
    if (!server || !basePath || serverDeleting) {
      return;
    }
    const confirmed = window.confirm(
      `Delete server "${server.name}" (${server.slug})? This removes all files on the worker.`
    );
    if (!confirmed) {
      return;
    }

    setServerDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(basePath, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setDeleteError(data.message || "Failed to delete server.");
        return;
      }
      router.push(`/dashboard?node=${encodeURIComponent(nodeRef)}`);
    } catch {
      setDeleteError("Failed to delete server.");
    } finally {
      setServerDeleting(false);
    }
  };

  const loadBrowserEntries = useCallback(async () => {
    if (!server || !server.permissions.canManageFiles || !nodeRef) {
      setBrowserEntries([]);
      setBrowserError("");
      return;
    }

    setBrowserLoading(true);
    setBrowserError("");
    try {
      const fullPath = joinRootPath(server.rootPath, browserPath);
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(nodeRef)}/worker/fs/list?path=${encodeURIComponent(fullPath)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setBrowserEntries([]);
        setBrowserError(message || "Failed to load directory.");
        return;
      }
      const data = (await res.json().catch(() => [])) as WorkerListEntry[];
      const normalized = Array.isArray(data)
        ? data.filter((entry) => typeof entry?.name === "string")
        : [];
      setBrowserEntries(sortEntries(normalized));
    } catch {
      setBrowserEntries([]);
      setBrowserError("Failed to load directory.");
    } finally {
      setBrowserLoading(false);
    }
  }, [browserPath, nodeRef, server]);

  useEffect(() => {
    loadBrowserEntries();
  }, [loadBrowserEntries]);

  const openFile = async (relativePath: string) => {
    if (!server || !nodeRef) {
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
      const fullPath = joinRootPath(server.rootPath, cleanPath);
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(nodeRef)}/worker/fs/read?path=${encodeURIComponent(fullPath)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setFileContent("");
        setFileError(message || "Failed to load file.");
        return;
      }
      const raw = await res.text();
      setFileContent(decodeEscapedLineBreaks(raw));
    } catch {
      setFileContent("");
      setFileError("Failed to load file.");
    } finally {
      setFileLoading(false);
    }
  };

  const saveFile = async () => {
    if (!server || !nodeRef || !filePath) {
      return;
    }
    setFileSaving(true);
    setFileError("");
    try {
      const fullPath = joinRootPath(server.rootPath, filePath);
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/worker/fs/write`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: fullPath,
          content: fileContent,
        }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setFileError(message || "Failed to save file.");
        return;
      }
      await loadBrowserEntries();
    } catch {
      setFileError("Failed to save file.");
    } finally {
      setFileSaving(false);
    }
  };

  const selectedConfigFile = server?.configFiles.find(
    (cfg) => cfg.id === selectedConfigFileId
  );

  useEffect(() => {
    const loadConfig = async () => {
      if (!server || !selectedConfigFile || !server.permissions.canManageFiles || !nodeRef) {
        setConfigContent("");
        setConfigRows([]);
        setUseKeyValueEditor(false);
        return;
      }

      setConfigLoading(true);
      setConfigError("");
      try {
        const fullPath = joinRootPath(server.rootPath, selectedConfigFile.path);
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(nodeRef)}/worker/fs/read?path=${encodeURIComponent(fullPath)}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        if (!res.ok) {
          const message = await res.text().catch(() => "");
          setConfigContent("");
          setConfigRows([]);
          setConfigError(message || "Failed to load config.");
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
        setConfigError("Failed to load config.");
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, [nodeRef, selectedConfigFile, server]);

  const saveConfig = async () => {
    if (!server || !selectedConfigFile || !nodeRef) {
      return;
    }
    setConfigSaving(true);
    setConfigError("");
    try {
      const finalContent = useKeyValueEditor
        ? serializeConfigRows(configRows)
        : configContent;
      const fullPath = joinRootPath(server.rootPath, selectedConfigFile.path);
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/worker/fs/write`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: fullPath,
          content: finalContent,
        }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        setConfigError(message || "Failed to save config.");
        return;
      }
      await loadBrowserEntries();
    } catch {
      setConfigError("Failed to save config.");
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

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  if (error || !server) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <p className="text-red-600">{error || "Server not found."}</p>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          {server.name} ({server.slug})
        </h1>
        <p className="text-sm text-muted-foreground">
          Template: {server.templateName || server.templateId} | Stack: {server.stackName}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href={`/dashboard?node=${encodeURIComponent(nodeRef)}`}>
            Back to dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Status: {server.status}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => runStackAction("start")}
              disabled={!server.permissions.canControl || stackActionLoading !== ""}
            >
              {stackActionLoading === "start" ? "Starting..." : "Start"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => runStackAction("stop")}
              disabled={!server.permissions.canControl || stackActionLoading !== ""}
            >
              {stackActionLoading === "stop" ? "Stopping..." : "Stop"}
            </Button>
            <Button
              variant="secondary"
              onClick={refreshStatus}
              disabled={!server.permissions.canReadConsole}
            >
              Refresh status
            </Button>
            {server.permissions.canCreate ? (
              <Button
                variant="destructive"
                onClick={deleteServer}
                disabled={serverDeleting}
              >
                {serverDeleting ? "Deleting..." : "Delete server"}
              </Button>
            ) : null}
          </div>
          {stackError ? <p className="text-sm text-red-600">{stackError}</p> : null}
          {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Console (Read-Only)</CardTitle>
          <CardDescription>
            Command sending is still pending worker support.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
            {server.statusOutput || server.statusError || "No status output available."}
          </pre>
        </CardContent>
      </Card>

      {server.permissions.canManageFiles ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>File Browser</CardTitle>
              <CardDescription>
                Current folder: /{browserPath || "."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  value={browserPath}
                  onChange={(event) =>
                    setBrowserPath(normalizeRelativePath(event.target.value))
                  }
                  placeholder="data"
                />
                <Button
                  variant="secondary"
                  onClick={loadBrowserEntries}
                  disabled={browserLoading}
                >
                  {browserLoading ? "Loading..." : "Refresh"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBrowserPath(parentRelativePath(browserPath))}
                  disabled={!browserPath}
                >
                  Up one level
                </Button>
              </div>
              {browserError ? <p className="text-sm text-red-600">{browserError}</p> : null}
              <div className="max-h-72 space-y-2 overflow-auto">
                {browserEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries in this folder.</p>
                ) : (
                  browserEntries.map((entry) => {
                    const relativePath = normalizeRelativePath(
                      browserPath ? `${browserPath}/${entry.name}` : entry.name
                    );
                    return (
                      <button
                        key={`${entry.type}-${entry.name}`}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs"
                        onClick={() => {
                          if (entry.type === "dir") {
                            setBrowserPath(relativePath);
                            return;
                          }
                          openFile(relativePath);
                        }}
                      >
                        <span>
                          {entry.type === "dir" ? "[DIR] " : "[FILE] "}
                          {entry.name}
                        </span>
                        <span className="text-muted-foreground">{entry.size} B</span>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>File Editor</CardTitle>
              <CardDescription>{filePath || "Select a file from browser"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={fileContent}
                onChange={(event) => setFileContent(event.target.value)}
                className="min-h-64 w-full rounded-md border border-input bg-transparent p-2 text-xs"
                disabled={!filePath || fileLoading}
              />
              <div className="flex gap-2">
                <Button
                  onClick={saveFile}
                  disabled={!filePath || fileSaving || fileLoading}
                >
                  {fileSaving ? "Saving..." : "Save file"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => openFile(filePath)}
                  disabled={!filePath || fileLoading}
                >
                  Reload
                </Button>
              </div>
              {fileError ? <p className="text-sm text-red-600">{fileError}</p> : null}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>File Browser</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              File management is limited to owner/admin.
            </p>
          </CardContent>
        </Card>
      )}

      {server.permissions.canManageFiles ? (
        <Card>
          <CardHeader>
            <CardTitle>Config Editor</CardTitle>
            <CardDescription>
              Existing keys are read-only; values are editable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config-file-select">Config file</Label>
              <select
                id="config-file-select"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={selectedConfigFileId}
                onChange={(event) => setSelectedConfigFileId(event.target.value)}
                disabled={server.configFiles.length === 0}
              >
                {server.configFiles.length === 0 ? (
                  <option value="">No configured files</option>
                ) : (
                  server.configFiles.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.title} ({cfg.path})
                    </option>
                  ))
                )}
              </select>
            </div>

            {useKeyValueEditor ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Key</span>
                  <span>Value</span>
                  <span />
                </div>
                {configRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      value={row.key}
                      onChange={(event) =>
                        updateConfigRow(row.id, { key: event.target.value })
                      }
                      disabled={row.keyLocked}
                    />
                    <Input
                      value={row.value}
                      onChange={(event) =>
                        updateConfigRow(row.id, { value: event.target.value })
                      }
                      disabled={row.valueLocked}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => removeConfigRow(row.id)}
                      disabled={!row.custom}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={addConfigRow}
                  disabled={configLoading}
                >
                  Add setting
                </Button>
              </div>
            ) : (
              <textarea
                value={configContent}
                onChange={(event) => setConfigContent(event.target.value)}
                className="min-h-64 w-full rounded-md border border-input bg-transparent p-2 text-xs"
                disabled={!selectedConfigFile || configLoading}
              />
            )}

            <div className="flex gap-2">
              <Button
                onClick={saveConfig}
                disabled={!selectedConfigFile || configSaving || configLoading}
              >
                {configSaving ? "Saving..." : "Save config"}
              </Button>
            </div>
            {configError ? <p className="text-sm text-red-600">{configError}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
