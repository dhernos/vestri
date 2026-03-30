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
let xtermRuntimePromise: Promise<XTermRuntime> | null = null;

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
  const logsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consoleSnapshotRequestRef = useRef(0);
  const consoleHasOutputRef = useRef(false);

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const execSocketRef = useRef<WebSocket | null>(null);
  const execRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${window.location.host}${basePath}/console/logs/ws?${params.toString()}`;
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
      if (logsSocketRef.current && logsSocketRef.current.readyState <= WebSocket.OPEN) {
        logsSocketRef.current.close();
      }
      logsSocketRef.current = null;
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

      let socket: WebSocket;
      try {
        socket = new WebSocket(buildConsoleLogsWSURL(tailMode));
      } catch {
        if (!cancelled) {
          setConsoleError(t("logs.errors.connectStream"));
          setConsoleStatus("error");
          void scheduleReconnect();
        }
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
    buildConsoleLogsWSURL,
    refreshServerStatus,
    shouldConnectLogStream,
    t,
  ]);

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
        terminal?.write(`\r\n[${t("interactive.terminal.connected")}]\r\n`);
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
          setExecError(t("interactive.errors.connectionFailed"));
        }
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }
        if (execSocketRef.current === socket) {
          execSocketRef.current = null;
        }
        terminal?.write(`\r\n[${t("interactive.terminal.disconnected")}]\r\n`);
        setExecStatus("disconnected");

        const closedQuickly = connectedAtMs > 0 && Date.now() - connectedAtMs < 1500;
        if (receivedSessionEndSignal || closedQuickly) {
          if (closedQuickly && !receivedSessionEndSignal) {
            setExecError(t("interactive.errors.closedImmediately"));
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
      cleanupSocket();
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
