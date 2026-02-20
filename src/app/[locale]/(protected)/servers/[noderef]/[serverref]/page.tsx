"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import styles from "./page.module.css";

type ServerStatus = "up" | "down" | "unknown";
type GameServerKind = "standalone" | "velocity" | "velocity-backend";

type GameServerPermissions = {
  canView: boolean;
  canCreate: boolean;
  canControl: boolean;
  canManageFiles: boolean;
  canReadConsole: boolean;
  canManage: boolean;
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
  kind: GameServerKind;
  parentServerId?: string;
  connectHost?: string;
  connectPort?: number;
  templateId: string;
  templateVersion?: string;
  templateName: string;
  softwareVersion?: string;
  gameVersion?: string;
  stackName: string;
  rootPath: string;
  composePath: string;
  configFiles: GameServerConfigFile[];
  status: ServerStatus;
  statusOutput?: string;
  statusError?: string;
  permissions: GameServerPermissions;
};

type GameServerTemplateVersionField = {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
};

type GameServerTemplateVersionConfig = {
  software?: GameServerTemplateVersionField;
  game?: GameServerTemplateVersionField;
};

type GameServerTemplate = {
  id: string;
  name: string;
  game: string;
  versionConfig?: GameServerTemplateVersionConfig;
};

type WorkerListEntry = {
  name: string;
  type: "dir" | "file" | "symlink" | "other";
  size: number;
};

type ServerInvite = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  serverId: string;
  serverName: string;
  serverSlug: string;
  inviterMail: string;
  email: string;
  permission: "admin" | "operator" | "viewer";
  expiresAt: string;
  createdAt: string;
};

type ServerGuest = {
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  serverId: string;
  serverName: string;
  serverSlug: string;
  userId: string;
  name?: string | null;
  email: string;
  permission: "admin" | "operator" | "viewer";
  createdAt: string;
};

type ConfigRow = {
  id: string;
  key: string;
  value: string;
  keyLocked: boolean;
  valueLocked: boolean;
  custom: boolean;
};

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";
type ConsoleRefreshMode = "auto" | "manual";

type ExecMessage = {
  type: string;
  data?: string;
  message?: string;
  cols?: number;
  rows?: number;
  code?: number;
};

type XTermRuntime = {
  TerminalCtor: typeof Terminal;
  FitAddonCtor: typeof FitAddon;
};

const keyValueFormats = new Set(["properties", "env", "ini", "cfg", "config", "kv"]);
const maxConsoleOutputChars = 250_000;
const folderNavigationDelayMs = 180;
let xtermRuntimePromise: Promise<XTermRuntime> | null = null;

const normalizeFieldOptions = (field?: GameServerTemplateVersionField): string[] => {
  if (!field || !Array.isArray(field.options)) {
    return [];
  }
  return field.options
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
};

const resolveFieldValue = (current: string, field?: GameServerTemplateVersionField): string => {
  if (!field) {
    return "";
  }

  const options = normalizeFieldOptions(field);
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

const sortEntries = (entries: WorkerListEntry[]) =>
  [...entries].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });

const downloadNameFromResponse = (contentDisposition: string | null, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      // fallback below
    }
  }

  const plainMatch = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallback;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "-";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const isZipArchiveName = (name: string) => name.trim().toLowerCase().endsWith(".zip");

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

const loadXtermRuntime = async (): Promise<XTermRuntime> => {
  if (!xtermRuntimePromise) {
    xtermRuntimePromise = Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ])
      .then(([xterm, fit]) => ({
        TerminalCtor: xterm.Terminal,
        FitAddonCtor: fit.FitAddon,
      }))
      .catch((error) => {
        xtermRuntimePromise = null;
        throw error;
      });
  }

  return xtermRuntimePromise;
};

export default function ServerControlsPage() {
  const router = useRouter();
  const params = useParams<{ noderef: string; serverref: string }>();
  const nodeRef = typeof params?.noderef === "string" ? params.noderef : "";
  const serverRef = typeof params?.serverref === "string" ? params.serverref : "";

  const [server, setServer] = useState<GameServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [velocityTemplates, setVelocityTemplates] = useState<GameServerTemplate[]>([]);
  const [velocityBackends, setVelocityBackends] = useState<GameServer[]>([]);
  const [velocityLoading, setVelocityLoading] = useState(false);
  const [velocityError, setVelocityError] = useState("");
  const [velocityCreateError, setVelocityCreateError] = useState("");
  const [velocityCreating, setVelocityCreating] = useState(false);
  const [velocityTemplateId, setVelocityTemplateId] = useState("");
  const [velocityBackendName, setVelocityBackendName] = useState("");
  const [velocityBackendSoftwareVersion, setVelocityBackendSoftwareVersion] = useState("");
  const [velocityBackendGameVersion, setVelocityBackendGameVersion] = useState("");

  const [stackActionLoading, setStackActionLoading] = useState<"" | "start" | "stop">("");
  const [stackError, setStackError] = useState("");
  const [serverDeleting, setServerDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const [invites, setInvites] = useState<ServerInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState("");
  const [guests, setGuests] = useState<ServerGuest[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [removingGuestUserId, setRemovingGuestUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"admin" | "operator" | "viewer">("operator");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [consoleStatus, setConsoleStatus] = useState<ConnectionStatus>("idle");
  const [consoleError, setConsoleError] = useState("");
  const [consoleRefreshMode, setConsoleRefreshMode] =
    useState<ConsoleRefreshMode>("auto");
  const [consoleSnapshotLoading, setConsoleSnapshotLoading] = useState(false);
  const [execStatus, setExecStatus] = useState<ConnectionStatus>("idle");
  const [execError, setExecError] = useState("");
  const [execSessionActive, setExecSessionActive] = useState(false);

  const consoleOutputRef = useRef<HTMLPreElement | null>(null);
  const logsAbortRef = useRef<AbortController | null>(null);
  const logsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consoleSnapshotRequestRef = useRef(0);
  const consoleHasOutputRef = useRef(false);
  const folderNavigationLockedRef = useRef(false);
  const folderNavigationUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const execSocketRef = useRef<WebSocket | null>(null);
  const execRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const basePath = useMemo(() => {
    if (!nodeRef || !serverRef) {
      return "";
    }
    return `/api/nodes/${encodeURIComponent(nodeRef)}/servers/${encodeURIComponent(serverRef)}`;
  }, [nodeRef, serverRef]);
  const serverId = server?.id || "";
  const isServerUp = server?.status === "up";
  const canReadConsole = Boolean(server?.permissions.canReadConsole);
  const canUseInteractiveConsole = Boolean(server?.permissions.canManage);
  const canConnectLogStream = canReadConsole && isServerUp;
  const canConnectInteractiveConsole = canUseInteractiveConsole && isServerUp;
  const shouldConnectLogStream = canConnectLogStream && consoleRefreshMode === "auto";
  const shouldConnectInteractiveConsole =
    canConnectInteractiveConsole && execSessionActive;
  const isVelocityServer = server?.kind === "velocity";
  const selectedVelocityTemplate = useMemo(
    () => velocityTemplates.find((template) => template.id === velocityTemplateId) || null,
    [velocityTemplateId, velocityTemplates]
  );
  const velocitySoftwareField = selectedVelocityTemplate?.versionConfig?.software;
  const velocityGameField = selectedVelocityTemplate?.versionConfig?.game;
  const velocitySoftwareOptions = useMemo(
    () => normalizeFieldOptions(velocitySoftwareField),
    [velocitySoftwareField]
  );
  const velocityGameOptions = useMemo(
    () => normalizeFieldOptions(velocityGameField),
    [velocityGameField]
  );

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

  const loadVelocityData = useCallback(async () => {
    if (!nodeRef || !server || server.kind !== "velocity") {
      setVelocityTemplates([]);
      setVelocityBackends([]);
      setVelocityTemplateId("");
      setVelocityError("");
      return;
    }

    setVelocityLoading(true);
    setVelocityError("");
    try {
      const [templatesResult, backendsResult] = await Promise.allSettled([
        fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers/templates`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(
          `/api/nodes/${encodeURIComponent(nodeRef)}/servers?parent=${encodeURIComponent(
            server.id
          )}&includeStatus=1`,
          {
            credentials: "include",
            cache: "no-store",
          }
        ),
      ]);

      const nextErrors: string[] = [];
      let nextTemplates: GameServerTemplate[] = [];
      let nextBackends: GameServer[] = [];

      if (templatesResult.status === "fulfilled") {
        const templatesRes = templatesResult.value;
        const templatesData = (await templatesRes.json().catch(() => ({}))) as {
          templates?: GameServerTemplate[];
          message?: string;
        };
        if (templatesRes.ok) {
          const allTemplates = Array.isArray(templatesData.templates) ? templatesData.templates : [];
          nextTemplates = allTemplates.filter(
            (template) =>
              template.game?.toLowerCase() === "minecraft" &&
              template.id.toLowerCase() === "minecraft-vanilla"
          );
        } else {
          nextErrors.push(templatesData.message || "Failed to load backend templates.");
        }
      } else {
        nextErrors.push("Failed to load backend templates.");
      }

      if (backendsResult.status === "fulfilled") {
        const backendsRes = backendsResult.value;
        const backendsData = (await backendsRes.json().catch(() => ({}))) as {
          servers?: GameServer[];
          message?: string;
        };
        if (backendsRes.ok) {
          nextBackends = Array.isArray(backendsData.servers) ? backendsData.servers : [];
        } else {
          nextErrors.push(backendsData.message || "Failed to load velocity backends.");
        }
      } else {
        nextErrors.push("Failed to load velocity backends.");
      }

      setVelocityTemplates(nextTemplates);
      setVelocityBackends(nextBackends);

      if (nextTemplates.length === 0) {
        setVelocityTemplateId("");
      } else if (!velocityTemplateId) {
        setVelocityTemplateId(nextTemplates[0].id);
      } else if (!nextTemplates.some((template) => template.id === velocityTemplateId)) {
        setVelocityTemplateId(nextTemplates[0].id);
      }

      if (nextErrors.length > 0) {
        setVelocityError(nextErrors.join(" "));
      }
    } catch {
      setVelocityError("Failed to load velocity backend data.");
    } finally {
      setVelocityLoading(false);
    }
  }, [nodeRef, server, velocityTemplateId]);

  useEffect(() => {
    if (!server || server.kind !== "velocity") {
      setVelocityTemplates([]);
      setVelocityBackends([]);
      setVelocityTemplateId("");
      setVelocityError("");
      setVelocityCreateError("");
      return;
    }
    void loadVelocityData();
  }, [loadVelocityData, server]);

  useEffect(() => {
    setVelocityBackendSoftwareVersion((current) => resolveFieldValue(current, velocitySoftwareField));
  }, [velocitySoftwareField]);

  useEffect(() => {
    setVelocityBackendGameVersion((current) => resolveFieldValue(current, velocityGameField));
  }, [velocityGameField]);

  const appendConsoleOutput = useCallback((chunk: string) => {
    if (!chunk) {
      return;
    }
    setConsoleOutput((prev) => {
      const next = `${prev}${chunk}`;
      if (next.length <= maxConsoleOutputChars) {
        return next;
      }
      return next.slice(next.length - maxConsoleOutputChars);
    });
  }, []);

  const buildConsoleLogsURL = useCallback(
    (follow: boolean, tail: string) => {
      const params = new URLSearchParams();
      params.set("follow", follow ? "1" : "0");
      params.set("tail", tail);
      return `${basePath}/console/logs/stream?${params.toString()}`;
    },
    [basePath]
  );

  const loadConsoleSnapshot = useCallback(
    async (signal?: AbortSignal) => {
      if (!basePath || !canReadConsole || consoleRefreshMode !== "manual") {
        return;
      }

      const requestID = ++consoleSnapshotRequestRef.current;
      setConsoleSnapshotLoading(true);
      setConsoleError("");
      setConsoleOutput("");

      try {
        const res = await fetch(buildConsoleLogsURL(false, "all"), {
          credentials: "include",
          cache: "no-store",
          signal,
        });
        if (requestID !== consoleSnapshotRequestRef.current) {
          return;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setConsoleError(text || "Failed to load console logs.");
          return;
        }

        if (!res.body) {
          const text = await res.text().catch(() => "");
          if (requestID !== consoleSnapshotRequestRef.current) {
            return;
          }
          if (text.length <= maxConsoleOutputChars) {
            setConsoleOutput(text);
          } else {
            setConsoleOutput(text.slice(text.length - maxConsoleOutputChars));
          }
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          if (signal?.aborted || requestID !== consoleSnapshotRequestRef.current) {
            try {
              await reader.cancel();
            } catch {
              // ignore cancel errors
            }
            return;
          }

          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          appendConsoleOutput(decoder.decode(value, { stream: true }));
        }

        const tail = decoder.decode();
        if (tail) {
          appendConsoleOutput(tail);
        }
      } catch {
        if (requestID !== consoleSnapshotRequestRef.current || signal?.aborted) {
          return;
        }
        setConsoleError("Failed to load console logs.");
      } finally {
        if (requestID === consoleSnapshotRequestRef.current) {
          setConsoleSnapshotLoading(false);
        }
      }
    },
    [appendConsoleOutput, basePath, buildConsoleLogsURL, canReadConsole, consoleRefreshMode]
  );

  useEffect(() => {
    consoleSnapshotRequestRef.current += 1;
    setConsoleOutput("");
    setConsoleStatus("idle");
    setConsoleError("");
    setConsoleSnapshotLoading(false);
    setExecSessionActive(false);
  }, [serverId]);

  useEffect(() => {
    if (!basePath || !canReadConsole) {
      consoleSnapshotRequestRef.current += 1;
      setConsoleOutput("");
      setConsoleStatus("idle");
      setConsoleError("");
      setConsoleSnapshotLoading(false);
      return;
    }
  }, [basePath, canReadConsole]);

  useEffect(() => {
    if (consoleRefreshMode === "auto") {
      consoleSnapshotRequestRef.current += 1;
      setConsoleSnapshotLoading(false);
    }
  }, [consoleRefreshMode]);

  useEffect(() => {
    if (!canConnectInteractiveConsole && execSessionActive) {
      setExecSessionActive(false);
    }
  }, [canConnectInteractiveConsole, execSessionActive]);

  useEffect(() => {
    const node = consoleOutputRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [consoleOutput]);

  useEffect(() => {
    consoleHasOutputRef.current = consoleOutput.length > 0;
  }, [consoleOutput]);

  useEffect(() => {
    if (!basePath || !shouldConnectLogStream) {
      setConsoleStatus("idle");
      logsAbortRef.current?.abort();
      logsAbortRef.current = null;
      if (logsRetryTimerRef.current) {
        clearTimeout(logsRetryTimerRef.current);
        logsRetryTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let reconnectAttempt = 0;
    let initialHistoryLoaded = false;

    const cleanup = () => {
      logsAbortRef.current?.abort();
      logsAbortRef.current = null;
      if (logsRetryTimerRef.current) {
        clearTimeout(logsRetryTimerRef.current);
        logsRetryTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) {
        return;
      }
      reconnectAttempt += 1;
      const delay = Math.min(8000, 1000 * reconnectAttempt);
      setConsoleStatus("reconnecting");
      logsRetryTimerRef.current = setTimeout(() => {
        logsRetryTimerRef.current = null;
        void connectLogs();
      }, delay);
    };

    const connectLogs = async () => {
      if (cancelled) {
        return;
      }

      const controller = new AbortController();
      logsAbortRef.current = controller;
      setConsoleStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");

      try {
        const tailMode =
          initialHistoryLoaded || consoleHasOutputRef.current ? "0" : "all";
        const res = await fetch(buildConsoleLogsURL(true, tailMode), {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          const message = await res.text().catch(() => "");
          setConsoleError(message || "Failed to connect to log stream.");
          setConsoleStatus("error");
          scheduleReconnect();
          return;
        }

        if (!res.body) {
          setConsoleError("Log stream did not provide a readable body.");
          setConsoleStatus("error");
          scheduleReconnect();
          return;
        }

        setConsoleError("");
        setConsoleStatus("connected");
        reconnectAttempt = 0;
        if (!initialHistoryLoaded) {
          initialHistoryLoaded = true;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          appendConsoleOutput(decoder.decode(value, { stream: true }));
        }

        if (!cancelled) {
          const tail = decoder.decode();
          if (tail) {
            appendConsoleOutput(tail);
          }
          setConsoleStatus("disconnected");
          scheduleReconnect();
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setConsoleError("Log stream interrupted.");
          setConsoleStatus("error");
          scheduleReconnect();
        }
      } finally {
        if (logsAbortRef.current === controller) {
          logsAbortRef.current = null;
        }
      }
    };

    void connectLogs();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [appendConsoleOutput, basePath, buildConsoleLogsURL, shouldConnectLogStream]);

  useEffect(() => {
    if (!basePath || !shouldConnectInteractiveConsole) {
      setExecStatus("idle");
      setExecError("");
      execSocketRef.current?.close();
      execSocketRef.current = null;
      if (execRetryTimerRef.current) {
        clearTimeout(execRetryTimerRef.current);
        execRetryTimerRef.current = null;
      }
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      return;
    }

    const host = terminalHostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let reconnectAttempt = 0;
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let dataSubscription: { dispose: () => void } | null = null;
    let resizeSubscription: { dispose: () => void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let receivedSessionEndSignal = false;
    let connectedAtMs = 0;

    const cleanupSocket = () => {
      if (execSocketRef.current && execSocketRef.current.readyState <= WebSocket.OPEN) {
        execSocketRef.current.close();
      }
      execSocketRef.current = null;
    };

    const disposeTerminal = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      dataSubscription?.dispose();
      dataSubscription = null;
      resizeSubscription?.dispose();
      resizeSubscription = null;
      terminal?.dispose();
      terminal = null;
      fitAddon = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
    };

    const sendMessage = (message: ExecMessage) => {
      const socket = execSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify(message));
    };

    const sendResize = () => {
      if (!terminal || !fitAddon) {
        return;
      }
      fitAddon.fit();
      sendMessage({
        type: "resize",
        cols: terminal.cols,
        rows: terminal.rows,
      });
    };

    let connectExec = () => {};

    const scheduleReconnect = () => {
      if (cancelled) {
        return;
      }
      reconnectAttempt += 1;
      const delay = Math.min(8000, 1000 * reconnectAttempt);
      setExecStatus("reconnecting");
      execRetryTimerRef.current = setTimeout(() => {
        execRetryTimerRef.current = null;
        connectExec();
      }, delay);
    };

    const handleIncoming = (payload: string) => {
      let message: ExecMessage | null = null;
      try {
        message = JSON.parse(payload) as ExecMessage;
      } catch {
        terminal?.write(payload);
        return;
      }

      if (!message || typeof message.type !== "string") {
        return;
      }

      if (message.type === "output") {
        if (typeof message.data === "string") {
          terminal?.write(message.data);
        }
        return;
      }

      if (message.type === "error") {
        receivedSessionEndSignal = true;
        const text = message.message || "Interactive console error.";
        setExecError(text);
        setExecStatus("error");
        terminal?.write(`\r\n[error] ${text}\r\n`);
        return;
      }

      if (message.type === "exit") {
        receivedSessionEndSignal = true;
        const code = typeof message.code === "number" ? message.code : -1;
        terminal?.write(`\r\n[session ended: exit ${code}]\r\n`);
        setExecStatus("disconnected");
      }
    };

    connectExec = () => {
      if (cancelled) {
        return;
      }

      cleanupSocket();
      setExecStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      connectedAtMs = 0;
      receivedSessionEndSignal = false;

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const socketURL = `${proto}://${window.location.host}${basePath}/console/exec/ws`;
      const socket = new WebSocket(socketURL);
      execSocketRef.current = socket;

      socket.onopen = () => {
        connectedAtMs = Date.now();
        reconnectAttempt = 0;
        setExecStatus("connected");
        setExecError("");
        terminal?.write("\r\n[interactive session connected]\r\n");
        sendResize();
      };

      socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          handleIncoming(event.data);
        }
      };

      socket.onerror = () => {
        if (!cancelled) {
          setExecStatus("error");
          setExecError("Interactive console connection failed.");
        }
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }
        if (execSocketRef.current === socket) {
          execSocketRef.current = null;
        }
        terminal?.write("\r\n[interactive session disconnected]\r\n");
        setExecStatus("disconnected");

        const closedQuickly = connectedAtMs > 0 && Date.now() - connectedAtMs < 1500;
        if (receivedSessionEndSignal || closedQuickly) {
          if (closedQuickly && !receivedSessionEndSignal) {
            setExecError(
              "Interactive session closed immediately. Check worker logs/container state."
            );
          }
          return;
        }

        scheduleReconnect();
      };
    };

    const setupTerminal = async () => {
      host.innerHTML = "";
      setExecStatus("connecting");
      setExecError("");

      try {
        const runtime = await loadXtermRuntime();
        if (cancelled) {
          return;
        }

        terminal = new runtime.TerminalCtor({
          cursorBlink: true,
          convertEol: true,
          fontSize: 13,
          scrollback: 5000,
          theme: {
            background: "#111111",
          },
        });
        fitAddon = new runtime.FitAddonCtor();
        terminal.loadAddon(fitAddon);
        terminal.open(host);
        fitAddon.fit();
        terminal.write("Connecting to interactive console...\r\n");

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;

        dataSubscription = terminal.onData((data) => {
          sendMessage({ type: "input", data });
        });
        resizeSubscription = terminal.onResize(({ cols, rows }) => {
          sendMessage({ type: "resize", cols, rows });
        });

        resizeObserver = new ResizeObserver(() => {
          sendResize();
        });
        resizeObserver.observe(host);

        connectExec();
      } catch {
        if (!cancelled) {
          setExecStatus("error");
          setExecError("Failed to load xterm runtime.");
        }
      }
    };

    void setupTerminal();

    return () => {
      cancelled = true;
      if (execRetryTimerRef.current) {
        clearTimeout(execRetryTimerRef.current);
        execRetryTimerRef.current = null;
      }
      cleanupSocket();
      disposeTerminal();
    };
  }, [basePath, shouldConnectInteractiveConsole, serverId]);

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
    if (action === "stop") {
      setExecSessionActive(false);
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
      `Delete server "${server.name}"? This removes all files on the worker.`
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

  const createVelocityBackend = async () => {
    if (!nodeRef || !server || server.kind !== "velocity" || !velocityTemplateId) {
      return;
    }

    setVelocityCreating(true);
    setVelocityCreateError("");
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeRef)}/servers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: velocityTemplateId,
          name: velocityBackendName.trim(),
          agreementAccepted: true,
          softwareVersion: velocitySoftwareField ? velocityBackendSoftwareVersion.trim() : "",
          gameVersion: velocityGameField ? velocityBackendGameVersion.trim() : "",
          parentServerRef: server.id,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setVelocityCreateError(data.message || "Failed to create velocity backend server.");
        return;
      }

      setVelocityBackendName("");
      await loadVelocityData();
    } catch {
      setVelocityCreateError("Failed to create velocity backend server.");
    } finally {
      setVelocityCreating(false);
    }
  };

  const loadBrowserEntries = useCallback(async () => {
    if (!server || !server.permissions.canManageFiles || !basePath) {
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
      if (folderNavigationUnlockTimerRef.current) {
        clearTimeout(folderNavigationUnlockTimerRef.current);
        folderNavigationUnlockTimerRef.current = null;
      }
      folderNavigationUnlockTimerRef.current = setTimeout(() => {
        folderNavigationLockedRef.current = false;
        folderNavigationUnlockTimerRef.current = null;
      }, folderNavigationDelayMs);
    }
  }, [basePath, browserPath, server]);

  useEffect(() => {
    loadBrowserEntries();
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
    if (!server || !basePath) {
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
    if (!server || !basePath || !filePath) {
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

  const downloadBrowserPath = async (
    relativePath: string,
    entryType: WorkerListEntry["type"]
  ) => {
    if (!server || !basePath) {
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
        setBrowserActionError(message || "Failed to download path.");
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
      setBrowserActionError("Failed to download path.");
    } finally {
      setBrowserDownloadingPath("");
    }
  };

  const uploadFileToCurrentFolder = async () => {
    if (!server || !basePath || !browserUploadFile) {
      return;
    }

    const uploadPath = normalizeRelativePath(
      browserPath ? `${browserPath}/${browserUploadFile.name}` : browserUploadFile.name
    );
    if (!uploadPath) {
      setBrowserActionError("Invalid upload path.");
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
        setBrowserActionError(message || "Failed to upload file.");
        return;
      }

      setBrowserUploadFile(null);
      setBrowserUploadInputKey((prev) => prev + 1);
      await loadBrowserEntries();
    } catch {
      setBrowserActionError("Failed to upload file.");
    } finally {
      setBrowserUploading(false);
    }
  };

  const deleteBrowserPath = async (
    relativePath: string,
    entryType: WorkerListEntry["type"]
  ) => {
    if (!server || !basePath) {
      return;
    }
    const cleanPath = normalizeRelativePath(relativePath);
    if (!cleanPath) {
      return;
    }

    const label = entryType === "dir" ? "folder" : "file";
    const confirmed = window.confirm(`Delete ${label} "${cleanPath}"?`);
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
        setBrowserActionError(message || "Failed to delete path.");
        return;
      }

      if (filePath === cleanPath || filePath.startsWith(`${cleanPath}/`)) {
        setFilePath("");
        setFileContent("");
      }
      await loadBrowserEntries();
    } catch {
      setBrowserActionError("Failed to delete path.");
    } finally {
      setBrowserDeletingPath("");
    }
  };

  const unzipArchiveInCurrentFolder = async (relativePath: string) => {
    if (!server || !basePath) {
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
        setBrowserActionError(message || "Failed to unzip archive.");
        return;
      }

      await loadBrowserEntries();
    } catch {
      setBrowserActionError("Failed to unzip archive.");
    } finally {
      setBrowserUnzippingPath("");
    }
  };

  const selectedConfigFile = server?.configFiles.find(
    (cfg) => cfg.id === selectedConfigFileId
  );

  useEffect(() => {
    const loadConfig = async () => {
      if (!server || !selectedConfigFile || !server.permissions.canManageFiles || !basePath) {
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
  }, [basePath, selectedConfigFile, server]);

  const saveConfig = async () => {
    if (!server || !selectedConfigFile || !basePath) {
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

  const loadInvites = useCallback(async () => {
    if (!server || !server.permissions.canManage || !basePath) {
      setInvites([]);
      return;
    }

    setInvitesLoading(true);
    setInviteError("");
    try {
      const res = await fetch(`${basePath}/invites`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        invites?: ServerInvite[];
      };
      if (!res.ok) {
        setInvites([]);
        return;
      }
      setInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch {
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }, [basePath, server]);

  const loadGuests = useCallback(async () => {
    if (!server || !server.permissions.canManage || !basePath) {
      setGuests([]);
      return;
    }

    setGuestsLoading(true);
    try {
      const res = await fetch(`${basePath}/guests`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        guests?: ServerGuest[];
      };
      if (!res.ok) {
        setGuests([]);
        return;
      }
      setGuests(Array.isArray(data.guests) ? data.guests : []);
    } catch {
      setGuests([]);
    } finally {
      setGuestsLoading(false);
    }
  }, [basePath, server]);

  useEffect(() => {
    if (!server || !server.permissions.canManage) {
      setInvites([]);
      setGuests([]);
      return;
    }
    loadInvites();
    loadGuests();
  }, [loadGuests, loadInvites, server]);

  const createInvite = async () => {
    if (!server || !basePath || inviteSubmitting) {
      return;
    }

    setInviteSubmitting(true);
    setInviteError("");
    try {
      const res = await fetch(`${basePath}/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          permission: invitePermission,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setInviteError(data.message || "Failed to create invite.");
        return;
      }
      setInviteEmail("");
      await Promise.all([loadInvites(), loadGuests()]);
    } catch {
      setInviteError("Failed to create invite.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!basePath) {
      return;
    }
    setRevokingInviteId(inviteId);
    try {
      const res = await fetch(`${basePath}/invites/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        return;
      }
      await loadInvites();
    } finally {
      setRevokingInviteId("");
    }
  };

  const removeGuest = async (guestUserId: string) => {
    if (!basePath) {
      return;
    }
    setRemovingGuestUserId(guestUserId);
    try {
      const res = await fetch(`${basePath}/guests/${encodeURIComponent(guestUserId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        return;
      }
      await loadGuests();
    } finally {
      setRemovingGuestUserId("");
    }
  };

  const refreshConsoleOutput = () => {
    if (
      !canReadConsole ||
      consoleSnapshotLoading ||
      consoleRefreshMode !== "manual"
    ) {
      return;
    }
    void loadConsoleSnapshot();
  };

  const clearLogOutput = () => {
    setConsoleOutput("");
  };

  const startExecSession = () => {
    if (!canConnectInteractiveConsole) {
      return;
    }
    setExecError("");
    setExecSessionActive(true);
  };

  const stopExecSession = () => {
    setExecSessionActive(false);
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
        <h1 className="text-3xl font-bold">{server.name}</h1>
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
            {server.permissions.canManage ? (
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

      {isVelocityServer ? (
        <Card>
          <CardHeader>
            <CardTitle>Velocity Backends</CardTitle>
            <CardDescription>
              Minecraft backend servers are attached to the same internal Docker network and are not
              shown on the main server list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="velocity-backend-template">Template</Label>
                <select
                  id="velocity-backend-template"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={velocityTemplateId}
                  onChange={(event) => setVelocityTemplateId(event.target.value)}
                  disabled={velocityCreating || velocityTemplates.length === 0}
                >
                  {velocityTemplates.length === 0 ? (
                    <option value="">No backend templates available</option>
                  ) : (
                    velocityTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="velocity-backend-name">Identifier</Label>
                <Input
                  id="velocity-backend-name"
                  value={velocityBackendName}
                  onChange={(event) => setVelocityBackendName(event.target.value)}
                  placeholder="backend-1"
                  disabled={velocityCreating}
                />
              </div>
              {velocitySoftwareField ? (
                <div className="space-y-2">
                  <Label htmlFor="velocity-backend-software">
                    {velocitySoftwareField.label || "Server type"}
                  </Label>
                  {velocitySoftwareOptions.length > 0 ? (
                    <select
                      id="velocity-backend-software"
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      value={velocityBackendSoftwareVersion}
                      onChange={(event) => setVelocityBackendSoftwareVersion(event.target.value)}
                      disabled={velocityCreating}
                    >
                      {velocitySoftwareOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="velocity-backend-software"
                      value={velocityBackendSoftwareVersion}
                      onChange={(event) => setVelocityBackendSoftwareVersion(event.target.value)}
                      placeholder={velocitySoftwareField.placeholder || ""}
                      disabled={velocityCreating}
                    />
                  )}
                </div>
              ) : null}
              {velocityGameField ? (
                <div className="space-y-2">
                  <Label htmlFor="velocity-backend-game-version">
                    {velocityGameField.label || "Game version"}
                  </Label>
                  {velocityGameOptions.length > 0 ? (
                    <select
                      id="velocity-backend-game-version"
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      value={velocityBackendGameVersion}
                      onChange={(event) => setVelocityBackendGameVersion(event.target.value)}
                      disabled={velocityCreating}
                    >
                      {velocityGameOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="velocity-backend-game-version"
                      value={velocityBackendGameVersion}
                      onChange={(event) => setVelocityBackendGameVersion(event.target.value)}
                      placeholder={velocityGameField.placeholder || ""}
                      disabled={velocityCreating}
                    />
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={createVelocityBackend}
                disabled={velocityCreating || !velocityTemplateId}
              >
                {velocityCreating ? "Creating..." : "Create backend server"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void loadVelocityData();
                }}
                disabled={velocityLoading}
              >
                {velocityLoading ? "Refreshing..." : "Refresh backends"}
              </Button>
            </div>
            {velocityError ? <p className="text-sm text-red-600">{velocityError}</p> : null}
            {velocityCreateError ? <p className="text-sm text-red-600">{velocityCreateError}</p> : null}

            {velocityBackends.length === 0 ? (
              <p className="text-sm text-muted-foreground">No backend servers attached yet.</p>
            ) : (
              <div className="space-y-2">
                {velocityBackends.map((backend) => (
                  <div
                    key={backend.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{backend.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Connect from Velocity:{" "}
                        {backend.connectHost || `vestri-${backend.slug}`}:
                        {backend.connectPort || 25565}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{backend.status}</span>
                      <Button asChild size="sm" variant="secondary">
                        <Link
                          href={`/servers/${encodeURIComponent(nodeRef)}/${encodeURIComponent(
                            backend.id
                          )}`}
                        >
                          Open controls
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Console Logs (Read-Only)</CardTitle>
          <CardDescription>
            Switch between manual refresh and automatic live updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={consoleRefreshMode === "auto" ? "secondary" : "outline"}
              onClick={() => setConsoleRefreshMode("auto")}
              disabled={!canReadConsole}
            >
              Auto update
            </Button>
            <Button
              variant={consoleRefreshMode === "manual" ? "secondary" : "outline"}
              onClick={() => setConsoleRefreshMode("manual")}
              disabled={!canReadConsole}
            >
              Manual refresh
            </Button>
            <Button
              variant="outline"
              onClick={refreshConsoleOutput}
              disabled={
                !canReadConsole ||
                consoleSnapshotLoading ||
                consoleRefreshMode !== "manual"
              }
            >
              {consoleSnapshotLoading ? "Refreshing..." : "Refresh now"}
            </Button>
            <Button
              variant="ghost"
              onClick={clearLogOutput}
              disabled={consoleOutput.length === 0}
            >
              Clear output
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Refresh mode:{" "}
            {consoleRefreshMode === "auto" ? "Automatic updates" : "Manual refresh"}
          </p>
          {consoleRefreshMode === "auto" ? (
            <p className="text-xs text-muted-foreground">
              Stream status: {consoleStatus}
            </p>
          ) : null}
          {!isServerUp && consoleRefreshMode === "auto" ? (
            <p className="text-xs text-muted-foreground">
              Server is offline. Start the server to open a live stream.
            </p>
          ) : null}
          {consoleError ? <p className="text-sm text-red-600">{consoleError}</p> : null}
          <pre
            ref={consoleOutputRef}
            className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs"
          >
            {consoleOutput ||
              (consoleSnapshotLoading
                ? "Loading logs..."
                : !canReadConsole
                ? "You don't have permission to read console logs."
                : consoleRefreshMode === "manual"
                ? "No logs loaded. Click \"Refresh now\"."
                : consoleStatus === "connected"
                ? "Connected. Waiting for new log lines..."
                : "Waiting for log stream...")}
          </pre>
        </CardContent>
      </Card>

      {canUseInteractiveConsole ? (
        <Card>
          <CardHeader>
            <CardTitle>Interactive Console</CardTitle>
            <CardDescription>
              Owner/Admin only. Session is proxied through backend and worker.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={startExecSession}
                disabled={!canConnectInteractiveConsole || execSessionActive}
              >
                {execSessionActive ? "Session running..." : "Start interactive session"}
              </Button>
              <Button
                variant="outline"
                onClick={stopExecSession}
                disabled={!execSessionActive}
              >
                Stop session
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Session status: {execStatus}
            </p>
            {!isServerUp ? (
              <p className="text-xs text-muted-foreground">
                Interactive console is only available while the server is running.
              </p>
            ) : null}
            {execError ? <p className="text-sm text-red-600">{execError}</p> : null}
            {execSessionActive ? (
              <div
                ref={terminalHostRef}
                className={`h-96 w-full overflow-hidden rounded-md border bg-black p-2 ${styles.terminalScope}`}
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                Interactive session is idle. Click "Start interactive session".
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

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
                <Button
                  variant="outline"
                  onClick={() => setBrowserPath("")}
                  disabled={!browserPath}
                >
                  Go to root
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
                <Input
                  key={browserUploadInputKey}
                  type="file"
                  className="max-w-xs"
                  onChange={(event) =>
                    setBrowserUploadFile(event.target.files?.[0] || null)
                  }
                />
                <Button
                  onClick={uploadFileToCurrentFolder}
                  disabled={!browserUploadFile || browserUploading}
                >
                  {browserUploading ? "Uploading..." : "Upload to current folder"}
                </Button>
              </div>
              {browserError ? <p className="text-sm text-red-600">{browserError}</p> : null}
              {browserActionError ? (
                <p className="text-sm text-red-600">{browserActionError}</p>
              ) : null}
              <div className="max-h-72 space-y-2 overflow-auto">
                {browserEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries in this folder.</p>
                ) : (
                  browserEntries.map((entry) => {
                    const relativePath = normalizeRelativePath(
                      browserPath ? `${browserPath}/${entry.name}` : entry.name
                    );
                    const sizeLabel =
                      entry.type === "dir" ? "" : formatBytes(entry.size);
                    const isDownloading = browserDownloadingPath === relativePath;
                    const isDeleting = browserDeletingPath === relativePath;
                    const canUnzip = entry.type === "file" && isZipArchiveName(entry.name);
                    const isUnzipping = browserUnzippingPath === relativePath;
                    const typeLabel =
                      entry.type === "dir"
                        ? "[DIR] "
                        : entry.type === "file"
                        ? "[FILE] "
                        : entry.type === "symlink"
                        ? "[SYMLINK] "
                        : "[OTHER] ";
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
                              setBrowserPath(relativePath);
                              return;
                            }
                            if (entry.type !== "file") {
                              setFileError("Only regular text files can be opened.");
                              return;
                            }
                            openFile(relativePath);
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
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            void downloadBrowserPath(relativePath, entry.type);
                          }}
                          disabled={isDownloading || isDeleting || isUnzipping}
                        >
                          {isDownloading ? "Downloading..." : "Download"}
                        </Button>
                        {canUnzip ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void unzipArchiveInCurrentFolder(relativePath);
                            }}
                            disabled={isDeleting || isDownloading || isUnzipping}
                          >
                            {isUnzipping ? "Unzipping..." : "Unzip"}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            void deleteBrowserPath(relativePath, entry.type);
                          }}
                          disabled={isDeleting || isDownloading || isUnzipping}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
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
              File management is limited to server owner/admin.
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

      {server.permissions.canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Access Management</CardTitle>
            <CardDescription>
              Invite users and manage server-specific permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="friend@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-permission">Role</Label>
                <select
                  id="invite-permission"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={invitePermission}
                  onChange={(event) =>
                    setInvitePermission(
                      event.target.value as "admin" | "operator" | "viewer"
                    )
                  }
                >
                  <option value="admin">admin (full server access)</option>
                  <option value="operator">operator (start/stop + status)</option>
                  <option value="viewer">viewer (status only)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={createInvite}
                disabled={inviteSubmitting || inviteEmail.trim() === ""}
              >
                {inviteSubmitting ? "Sending invite..." : "Create invite"}
              </Button>
            </div>
            {inviteError ? <p className="text-sm text-red-600">{inviteError}</p> : null}

            <div className="space-y-2">
              <h3 className="font-medium">Pending invites</h3>
              {invitesLoading ? <p className="text-sm">Loading...</p> : null}
              {!invitesLoading && invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invites.</p>
              ) : null}
              {!invitesLoading &&
                invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p>
                        {invite.email} - {invite.permission}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Inviter: {invite.inviterMail} | Expires:{" "}
                        {new Date(invite.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeInvite(invite.id)}
                      disabled={revokingInviteId === invite.id}
                    >
                      {revokingInviteId === invite.id ? "Revoking..." : "Revoke"}
                    </Button>
                  </div>
                ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Guests</h3>
              {guestsLoading ? <p className="text-sm">Loading...</p> : null}
              {!guestsLoading && guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No guests assigned.</p>
              ) : null}
              {!guestsLoading &&
                guests.map((guest) => (
                  <div
                    key={guest.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p>
                        {guest.name || guest.email} - {guest.permission}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {guest.email} | Added: {new Date(guest.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeGuest(guest.userId)}
                      disabled={removingGuestUserId === guest.userId}
                    >
                      {removingGuestUserId === guest.userId ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
