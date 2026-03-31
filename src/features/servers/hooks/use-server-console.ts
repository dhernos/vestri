"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import type { TranslateFn } from "@/features/servers/i18n";
import type {
  ConnectionStatus,
  ConsoleRefreshMode,
  ExecMessage,
  ServerStatus,
} from "@/features/servers/types";

type XTermRuntime = {
  TerminalCtor: typeof Terminal;
  FitAddonCtor: typeof FitAddon;
};

type UseServerConsoleParams = {
  basePath: string;
  serverId: string;
  canReadConsole: boolean;
  canUseInteractiveConsole: boolean;
  isServerUp: boolean;
  refreshServerStatus: () => Promise<ServerStatus | null>;
  t: TranslateFn;
};

const maxConsoleOutputChars = 250_000;
const consoleWSBaseURLOverride =
  process.env.NEXT_PUBLIC_CONSOLE_WS_BASE_URL?.trim() || "";
let xtermRuntimePromise: Promise<XTermRuntime> | null = null;

const toWebSocketOrigin = (rawURL: string) => {
  try {
    const parsed = new URL(rawURL);
    if (parsed.protocol === "https:") {
      parsed.protocol = "wss:";
    } else if (parsed.protocol === "http:") {
      parsed.protocol = "ws:";
    }
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      return "";
    }
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const isLocalHostName = (hostname: string) => {
  const value = hostname.toLowerCase();
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value === "[::1]"
  );
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

const readErrorMessage = async (
  res: Response,
  fallback: string
): Promise<string> => {
  const text = await res.text().catch(() => "");
  if (!text) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // ignore JSON parse errors
  }
  return text;
};

export const useServerConsole = ({
  basePath,
  serverId,
  canReadConsole,
  canUseInteractiveConsole,
  isServerUp,
  refreshServerStatus,
  t,
}: UseServerConsoleParams) => {
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
  const logsSocketRef = useRef<WebSocket | null>(null);
  const logsStreamAbortRef = useRef<AbortController | null>(null);
  const logsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consoleSnapshotRequestRef = useRef(0);
  const consoleHasOutputRef = useRef(false);

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const execRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const execStreamAbortRef = useRef<AbortController | null>(null);

  const canConnectLogStream = canReadConsole && isServerUp;
  const canConnectInteractiveConsole = canUseInteractiveConsole && isServerUp;
  const shouldConnectLogStream = canConnectLogStream && consoleRefreshMode === "auto";
  const shouldConnectInteractiveConsole =
    canConnectInteractiveConsole && execSessionActive;

  const appendConsoleOutput = useCallback((chunk: string) => {
    if (!chunk) {
      return;
    }
    setConsoleOutput((prev) => {
      const normalizedChunk = prev.length === 0 && chunk === "\n" ? "" : chunk;
      if (!normalizedChunk) {
        return prev;
      }
      const next = `${prev}${normalizedChunk}`;
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

  const buildConsoleLogsWSURL = useCallback(
    (tail: string) => {
      const params = new URLSearchParams();
      params.set("follow", "1");
      params.set("tail", tail);
      const path = `${basePath}/console/logs/ws?${params.toString()}`;
      const candidates: string[] = [];
      const addCandidate = (url: string) => {
        if (url && !candidates.includes(url)) {
          candidates.push(url);
        }
      };

      if (consoleWSBaseURLOverride) {
        const wsOrigin = toWebSocketOrigin(consoleWSBaseURLOverride);
        if (wsOrigin) {
          addCandidate(`${wsOrigin}${path}`);
        }
      }

      const host = window.location.host;
      const hostname = window.location.hostname;
      const preferSecureFromHTTP =
        window.location.protocol === "http:" && !isLocalHostName(hostname);
      if (window.location.protocol === "https:" || preferSecureFromHTTP) {
        addCandidate(`wss://${host}${path}`);
      }
      const fallbackProto = window.location.protocol === "https:" ? "wss" : "ws";
      addCandidate(`${fallbackProto}://${host}${path}`);

      return candidates[0] || "";
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
          setConsoleError(text || t("logs.errors.loadSnapshot"));
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
        setConsoleError(t("logs.errors.loadSnapshot"));
      } finally {
        if (requestID === consoleSnapshotRequestRef.current) {
          setConsoleSnapshotLoading(false);
        }
      }
    },
    [appendConsoleOutput, basePath, buildConsoleLogsURL, canReadConsole, consoleRefreshMode, t]
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
      if (logsSocketRef.current && logsSocketRef.current.readyState <= WebSocket.OPEN) {
        logsSocketRef.current.close();
      }
      logsSocketRef.current = null;
      if (logsStreamAbortRef.current) {
        logsStreamAbortRef.current.abort();
        logsStreamAbortRef.current = null;
      }
      if (logsRetryTimerRef.current) {
        clearTimeout(logsRetryTimerRef.current);
        logsRetryTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let reconnectAttempt = 0;
    let initialHistoryLoaded = false;
    let preferStreamTransport = true;

    const cleanup = () => {
      if (logsSocketRef.current && logsSocketRef.current.readyState <= WebSocket.OPEN) {
        logsSocketRef.current.close();
      }
      logsSocketRef.current = null;
      if (logsStreamAbortRef.current) {
        logsStreamAbortRef.current.abort();
        logsStreamAbortRef.current = null;
      }
      if (logsRetryTimerRef.current) {
        clearTimeout(logsRetryTimerRef.current);
        logsRetryTimerRef.current = null;
      }
    };

    const canRetryLogsConnection = async () => {
      if (cancelled) {
        return false;
      }

      const latestStatus = await refreshServerStatus();
      if (cancelled) {
        return false;
      }

      if (latestStatus && latestStatus !== "up") {
        return false;
      }
      if (latestStatus !== "up") {
        return false;
      }
      return true;
    };

    const scheduleReconnect = async () => {
      if (cancelled) {
        return;
      }
      const canRetry = await canRetryLogsConnection();
      if (!canRetry || cancelled) {
        setConsoleStatus("idle");
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

    const connectLogsViaStream = async (tailMode: string) => {
      if (logsSocketRef.current && logsSocketRef.current.readyState <= WebSocket.OPEN) {
        logsSocketRef.current.close();
      }
      logsSocketRef.current = null;

      if (logsStreamAbortRef.current) {
        logsStreamAbortRef.current.abort();
        logsStreamAbortRef.current = null;
      }

      const abortController = new AbortController();
      logsStreamAbortRef.current = abortController;

      try {
        let streamTailMode = tailMode;

        // Some upstream log stream implementations do not replay full history
        // reliably on follow-mode requests, so fetch history once first.
        if (!initialHistoryLoaded && tailMode === "all") {
          const historyRes = await fetch(buildConsoleLogsURL(false, "all"), {
            credentials: "include",
            cache: "no-store",
            signal: abortController.signal,
          });
          if (cancelled || abortController.signal.aborted) {
            return;
          }
          if (historyRes.ok) {
            if (historyRes.body) {
              const historyReader = historyRes.body.getReader();
              const historyDecoder = new TextDecoder();
              while (true) {
                const { done, value } = await historyReader.read();
                if (cancelled || abortController.signal.aborted) {
                  try {
                    await historyReader.cancel();
                  } catch {
                    // ignore cancel errors
                  }
                  return;
                }
                if (done) {
                  break;
                }
                appendConsoleOutput(historyDecoder.decode(value, { stream: true }));
              }
              const historyTail = historyDecoder.decode();
              if (historyTail) {
                appendConsoleOutput(historyTail);
              }
            } else {
              const historyText = await historyRes.text().catch(() => "");
              if (historyText) {
                appendConsoleOutput(historyText);
              }
            }
            initialHistoryLoaded = true;
            streamTailMode = "0";
          }
        }

        const res = await fetch(buildConsoleLogsURL(true, streamTailMode), {
          credentials: "include",
          cache: "no-store",
          signal: abortController.signal,
        });

        if (cancelled || abortController.signal.aborted) {
          return;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (cancelled || abortController.signal.aborted) {
            return;
          }
          setConsoleError(text || t("logs.errors.connectStream"));
          setConsoleStatus("error");
          void scheduleReconnect();
          return;
        }

        setConsoleError("");
        setConsoleStatus("connected");
        reconnectAttempt = 0;
        if (!initialHistoryLoaded) {
          initialHistoryLoaded = true;
        }

        if (!res.body) {
          const text = await res.text().catch(() => "");
          if (cancelled || abortController.signal.aborted) {
            return;
          }
          if (text) {
            appendConsoleOutput(text);
          }
          setConsoleStatus("disconnected");
          void scheduleReconnect();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (cancelled || abortController.signal.aborted) {
            try {
              await reader.cancel();
            } catch {
              // ignore cancel errors
            }
            return;
          }
          if (done) {
            break;
          }
          appendConsoleOutput(decoder.decode(value, { stream: true }));
        }

        const tail = decoder.decode();
        if (tail) {
          appendConsoleOutput(tail);
        }

        if (!cancelled && !abortController.signal.aborted) {
          setConsoleStatus("disconnected");
          void scheduleReconnect();
        }
      } catch {
        if (!cancelled && !abortController.signal.aborted) {
          setConsoleError(t("logs.errors.interrupted"));
          setConsoleStatus("error");
          void scheduleReconnect();
        }
      } finally {
        if (logsStreamAbortRef.current === abortController) {
          logsStreamAbortRef.current = null;
        }
      }
    };

    const connectLogs = async () => {
      if (cancelled) {
        return;
      }

      const canConnectNow = await canRetryLogsConnection();
      if (!canConnectNow || cancelled) {
        setConsoleStatus("idle");
        return;
      }

      if (logsSocketRef.current && logsSocketRef.current.readyState <= WebSocket.OPEN) {
        logsSocketRef.current.close();
      }
      setConsoleStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      setConsoleError("");

      const tailMode =
        initialHistoryLoaded || consoleHasOutputRef.current ? "0" : "all";

      if (preferStreamTransport) {
        void connectLogsViaStream(tailMode);
        return;
      }

      let socket: WebSocket;
      try {
        socket = new WebSocket(buildConsoleLogsWSURL(tailMode));
      } catch {
        preferStreamTransport = true;
        void connectLogsViaStream(tailMode);
        return;
      }

      logsSocketRef.current = socket;
      let hadSocketError = false;

      socket.onopen = () => {
        if (cancelled) {
          socket.close();
          return;
        }
        setConsoleError("");
        setConsoleStatus("connected");
        reconnectAttempt = 0;
        if (!initialHistoryLoaded) {
          initialHistoryLoaded = true;
        }
      };

      socket.onmessage = (event) => {
        if (cancelled) {
          return;
        }
        if (typeof event.data === "string") {
          appendConsoleOutput(event.data);
          return;
        }
        if (event.data instanceof Blob) {
          void event.data
            .text()
            .then((value) => {
              if (!cancelled) {
                appendConsoleOutput(value);
              }
            })
            .catch(() => {
              // ignore blob decode failures
            });
          return;
        }
        if (event.data instanceof ArrayBuffer) {
          appendConsoleOutput(new TextDecoder().decode(event.data));
        }
      };

      socket.onerror = () => {
        if (!cancelled) {
          hadSocketError = true;
          setConsoleError(t("logs.errors.interrupted"));
          setConsoleStatus("error");
        }
      };

      socket.onclose = () => {
        if (logsSocketRef.current === socket) {
          logsSocketRef.current = null;
        }
        if (cancelled) {
          return;
        }
        if (!hadSocketError) {
          setConsoleStatus("disconnected");
        } else {
          preferStreamTransport = true;
        }
        void scheduleReconnect();
      };
    };

    void connectLogs();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    appendConsoleOutput,
    basePath,
    buildConsoleLogsURL,
    buildConsoleLogsWSURL,
    refreshServerStatus,
    shouldConnectLogStream,
    t,
  ]);

  useEffect(() => {
    if (!basePath || !shouldConnectInteractiveConsole) {
      setExecStatus("idle");
      setExecError("");
      if (execRetryTimerRef.current) {
        clearTimeout(execRetryTimerRef.current);
        execRetryTimerRef.current = null;
      }
      if (execStreamAbortRef.current) {
        execStreamAbortRef.current.abort();
        execStreamAbortRef.current = null;
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
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let inputFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingInput = "";
    let inputFlushInFlight = false;
    let receivedSessionEndSignal = false;
    let activeSessionId = "";
    let connectedAtMs = 0;

    const disposeTerminal = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (resizeDebounceTimer) {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = null;
      }
      dataSubscription?.dispose();
      dataSubscription = null;
      resizeSubscription?.dispose();
      resizeSubscription = null;
      if (inputFlushTimer) {
        clearTimeout(inputFlushTimer);
        inputFlushTimer = null;
      }
      terminal?.dispose();
      terminal = null;
      fitAddon = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
    };

    const abortExecStream = () => {
      if (execStreamAbortRef.current) {
        execStreamAbortRef.current.abort();
        execStreamAbortRef.current = null;
      }
    };

    const deleteExecSession = async () => {
      if (!activeSessionId) {
        return;
      }
      const targetSession = activeSessionId;
      activeSessionId = "";
      abortExecStream();
      try {
        await fetch(
          `${basePath}/console/exec/session?session=${encodeURIComponent(targetSession)}`,
          {
            method: "DELETE",
            credentials: "include",
            cache: "no-store",
          }
        );
      } catch {
        // ignore cleanup failures
      }
    };

    const postExecAction = async (path: "input" | "resize", payload: object) => {
      if (!activeSessionId || cancelled) {
        return false;
      }
      try {
        const res = await fetch(`${basePath}/console/exec/${path}`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const msg = await readErrorMessage(
            res,
            t("interactive.errors.connectionFailed")
          );
          if (!cancelled) {
            setExecStatus("error");
            setExecError(msg);
          }
          return false;
        }
        return true;
      } catch {
        if (!cancelled) {
          setExecStatus("error");
          setExecError(t("interactive.errors.connectionFailed"));
        }
        return false;
      }
    };

    const flushPendingInput = async () => {
      if (cancelled || !activeSessionId || inputFlushInFlight) {
        return;
      }
      if (pendingInput.length === 0) {
        return;
      }
      inputFlushInFlight = true;
      const chunk = pendingInput;
      pendingInput = "";
      const ok = await postExecAction("input", {
        sessionId: activeSessionId,
        data: chunk,
      });
      inputFlushInFlight = false;
      if (!ok) {
        pendingInput = `${chunk}${pendingInput}`;
        if (!cancelled && !inputFlushTimer) {
          inputFlushTimer = setTimeout(() => {
            inputFlushTimer = null;
            void flushPendingInput();
          }, 250);
        }
        return;
      }
      if (!cancelled && pendingInput.length > 0 && !inputFlushTimer) {
        inputFlushTimer = setTimeout(() => {
          inputFlushTimer = null;
          void flushPendingInput();
        }, 0);
      }
    };

    const queueInput = (data: string) => {
      if (!data || !activeSessionId || cancelled) {
        return;
      }
      pendingInput += data;
      if (!inputFlushTimer) {
        inputFlushTimer = setTimeout(() => {
          inputFlushTimer = null;
          void flushPendingInput();
        }, 25);
      }
    };

    const sendResizeNow = async () => {
      if (!terminal || !fitAddon || !activeSessionId || cancelled) {
        return;
      }
      fitAddon.fit();
      await postExecAction("resize", {
        sessionId: activeSessionId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    };

    const queueResize = () => {
      if (resizeDebounceTimer) {
        clearTimeout(resizeDebounceTimer);
      }
      resizeDebounceTimer = setTimeout(() => {
        resizeDebounceTimer = null;
        void sendResizeNow();
      }, 120);
    };

    const scheduleReconnect = () => {
      if (cancelled || receivedSessionEndSignal || !activeSessionId) {
        return;
      }
      reconnectAttempt += 1;
      const delay = Math.min(8000, 1000 * reconnectAttempt);
      setExecStatus("reconnecting");
      execRetryTimerRef.current = setTimeout(() => {
        execRetryTimerRef.current = null;
        void connectExecStream();
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
        const text = message.message || t("interactive.errors.generic");
        setExecError(text);
        setExecStatus("error");
        terminal?.write(`\r\n[${t("interactive.terminal.errorPrefix")} ${text}]\r\n`);
        return;
      }

      if (message.type === "exit") {
        receivedSessionEndSignal = true;
        const code = typeof message.code === "number" ? message.code : -1;
        terminal?.write(`\r\n[${t("interactive.terminal.sessionEnded", { code })}]\r\n`);
        setExecStatus("disconnected");
        activeSessionId = "";
      }
    };

    const connectExecStream = async () => {
      if (cancelled || !activeSessionId) {
        return;
      }

      abortExecStream();
      setExecStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      setExecError("");
      connectedAtMs = 0;

      const abortController = new AbortController();
      execStreamAbortRef.current = abortController;
      let streamBuffer = "";

      try {
        const res = await fetch(
          `${basePath}/console/exec/stream?session=${encodeURIComponent(activeSessionId)}`,
          {
            credentials: "include",
            cache: "no-store",
            signal: abortController.signal,
          }
        );
        if (cancelled || abortController.signal.aborted) {
          return;
        }
        if (!res.ok) {
          const msg = await readErrorMessage(
            res,
            t("interactive.errors.connectionFailed")
          );
          if (cancelled || abortController.signal.aborted) {
            return;
          }
          setExecStatus("error");
          setExecError(msg);
          scheduleReconnect();
          return;
        }
        if (!res.body) {
          setExecStatus("error");
          setExecError(t("interactive.errors.connectionFailed"));
          scheduleReconnect();
          return;
        }

        connectedAtMs = Date.now();
        reconnectAttempt = 0;
        setExecStatus("connected");
        setExecError("");
        terminal?.write(`\r\n[${t("interactive.terminal.connected")}]\r\n`);
        void sendResizeNow();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (cancelled || abortController.signal.aborted) {
            try {
              await reader.cancel();
            } catch {
              // ignore cancel errors
            }
            return;
          }
          if (done) {
            break;
          }

          streamBuffer += decoder.decode(value, { stream: true });
          let newlineIndex = streamBuffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const line = streamBuffer.slice(0, newlineIndex).trim();
            streamBuffer = streamBuffer.slice(newlineIndex + 1);
            if (line) {
              handleIncoming(line);
            }
            newlineIndex = streamBuffer.indexOf("\n");
          }
        }

        const tailChunk = `${streamBuffer}${decoder.decode()}`.trim();
        if (tailChunk) {
          handleIncoming(tailChunk);
        }

        if (cancelled || abortController.signal.aborted) {
          return;
        }
        terminal?.write(`\r\n[${t("interactive.terminal.disconnected")}]\r\n`);
        setExecStatus("disconnected");
        if (receivedSessionEndSignal) {
          return;
        }
        const closedQuickly = connectedAtMs > 0 && Date.now() - connectedAtMs < 1500;
        if (closedQuickly) {
          setExecError(t("interactive.errors.closedImmediately"));
          return;
        }
        scheduleReconnect();
      } catch {
        if (cancelled || abortController.signal.aborted) {
          return;
        }
        setExecStatus("error");
        setExecError(t("interactive.errors.connectionFailed"));
        scheduleReconnect();
      } finally {
        if (execStreamAbortRef.current === abortController) {
          execStreamAbortRef.current = null;
        }
      }
    };

    const createExecSession = async () => {
      try {
        const res = await fetch(`${basePath}/console/exec/session`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const msg = await readErrorMessage(
            res,
            t("interactive.errors.connectionFailed")
          );
          if (!cancelled) {
            setExecStatus("error");
            setExecError(msg);
          }
          return "";
        }
        const data = (await res.json().catch(() => ({}))) as {
          sessionId?: string;
        };
        if (typeof data.sessionId !== "string" || !data.sessionId.trim()) {
          if (!cancelled) {
            setExecStatus("error");
            setExecError(t("interactive.errors.connectionFailed"));
          }
          return "";
        }
        return data.sessionId.trim();
      } catch {
        if (!cancelled) {
          setExecStatus("error");
          setExecError(t("interactive.errors.connectionFailed"));
        }
        return "";
      }
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
            background: "var(--terminal-bg)",
            foreground: "var(--terminal-fg)",
          },
        });
        fitAddon = new runtime.FitAddonCtor();
        terminal.loadAddon(fitAddon);
        terminal.open(host);
        fitAddon.fit();
        terminal.write(`${t("interactive.terminal.connecting")}\r\n`);

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;

        dataSubscription = terminal.onData((data) => {
          queueInput(data);
        });
        resizeSubscription = terminal.onResize(() => {
          queueResize();
        });

        resizeObserver = new ResizeObserver(() => {
          queueResize();
        });
        resizeObserver.observe(host);

        const sessionId = await createExecSession();
        if (!sessionId || cancelled) {
          return;
        }
        activeSessionId = sessionId;
        reconnectAttempt = 0;
        receivedSessionEndSignal = false;
        await connectExecStream();
      } catch {
        if (!cancelled) {
          setExecStatus("error");
          setExecError(t("interactive.errors.loadRuntime"));
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
      abortExecStream();
      void deleteExecSession();
      disposeTerminal();
    };
  }, [basePath, shouldConnectInteractiveConsole, serverId, t]);

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

  return {
    consoleOutput,
    consoleStatus,
    consoleError,
    consoleRefreshMode,
    setConsoleRefreshMode,
    consoleSnapshotLoading,
    consoleOutputRef,
    refreshConsoleOutput,
    clearLogOutput,
    canConnectInteractiveConsole,
    execSessionActive,
    execStatus,
    execError,
    terminalHostRef,
    startExecSession,
    stopExecSession,
  };
};
