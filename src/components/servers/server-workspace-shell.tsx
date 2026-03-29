"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network } from "lucide-react";
import { useTranslations } from "next-intl";
import { SidebarAppNav } from "@/components/servers/sidebar-app-nav";
import { SidebarBrand } from "@/components/servers/sidebar-brand";
import { SidebarProfileMenu } from "@/components/servers/sidebar-profile-menu";
import { ServerSidebarNav } from "@/components/servers/server-sidebar-nav";
import { TeamSwitcher } from "@/components/team-switcher";
import ToggleLanguage from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useNodesList } from "@/features/nodes/hooks/use-nodes-list";
import {
  normalizeServerWorkspaceSection,
  type ServerWorkspaceSection,
} from "@/features/servers/navigation";
import type { GameServerListItem } from "@/features/servers/types";
import { usePathname } from "@/i18n/navigation";

type ServerWorkspaceShellProps = {
  children: React.ReactNode;
  currentNodeRef: string;
  currentServerRef?: string;
  onNodeChange?: (nodeRef: string) => void;
  showServerNavigation?: boolean;
  showNodeSwitcher?: boolean;
  pageTitle?: string;
};

type ServersChangedDetail = {
  nodeRef?: string;
  changeType?: "structure" | "status";
  serverRef?: string;
  status?: GameServerListItem["status"];
  statusOutput?: string;
  statusError?: string;
};

type ServersCacheEntry = {
  servers: GameServerListItem[];
  fetchedAt: number;
};

const serverListCacheByNode = new Map<string, ServersCacheEntry>();
const serverListCacheMaxAgeMs = 15_000;

export function ServerWorkspaceShell({
  children,
  currentNodeRef,
  currentServerRef = "",
  onNodeChange,
  showServerNavigation = true,
  showNodeSwitcher = showServerNavigation,
  pageTitle,
}: ServerWorkspaceShellProps) {
  const tDashboard = useTranslations("DashboardPage");
  const tNodes = useTranslations("NodesPage");
  const tGameServer = useTranslations("GameServerPanel");
  const tServer = useTranslations("ServerPage");
  const pathname = usePathname();

  const { nodes, loadNodes } = useNodesList({
    loadErrorMessage: tDashboard("errors.loadNodes"),
    clearOnError: true,
  });

  const [selectedNodeRef, setSelectedNodeRef] = useState(currentNodeRef);
  const [servers, setServers] = useState<GameServerListItem[]>([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [serversError, setServersError] = useState("");
  const [headerControlLoading, setHeaderControlLoading] = useState<
    "" | "start" | "stop"
  >("");
  const [headerControlError, setHeaderControlError] = useState("");

  const activeSection = useMemo<ServerWorkspaceSection>(() => {
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1);
    return normalizeServerWorkspaceSection(lastSegment);
  }, [pathname]);

  useEffect(() => {
    if (!showNodeSwitcher && !showServerNavigation) {
      return;
    }
    void loadNodes();
  }, [loadNodes, showNodeSwitcher, showServerNavigation]);

  useEffect(() => {
    setSelectedNodeRef(currentNodeRef);
  }, [currentNodeRef]);

  useEffect(() => {
    if (!showNodeSwitcher && !showServerNavigation) {
      setSelectedNodeRef(currentNodeRef);
      return;
    }

    if (nodes.length === 0) {
      setSelectedNodeRef("");
      return;
    }

    setSelectedNodeRef((current) => {
      if (current && nodes.some((node) => node.id === current)) {
        return current;
      }
      if (nodes.some((node) => node.id === currentNodeRef)) {
        return currentNodeRef;
      }
      return nodes[0].id;
    });
  }, [currentNodeRef, nodes, showNodeSwitcher, showServerNavigation]);

  const fetchServersWithStatus = useCallback(
    async (nodeRef: string): Promise<GameServerListItem[]> => {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(nodeRef)}/servers?includeStatus=1`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        servers?: GameServerListItem[];
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message || tGameServer("errors.loadServers"));
      }

      const rootServers = Array.isArray(data.servers) ? data.servers : [];
      const velocityServers = rootServers.filter(
        (server) => server.kind === "velocity",
      );

      if (velocityServers.length === 0) {
        return rootServers;
      }

      const backendResults = await Promise.allSettled(
        velocityServers.map((server) =>
          fetch(
            `/api/nodes/${encodeURIComponent(nodeRef)}/servers?parent=${encodeURIComponent(
              server.id,
            )}&includeStatus=1`,
            {
              credentials: "include",
              cache: "no-store",
            },
          ),
        ),
      );

      const backendServers: GameServerListItem[] = [];
      for (const result of backendResults) {
        if (result.status !== "fulfilled") {
          continue;
        }

        const backendsRes = result.value;
        const backendsData = (await backendsRes.json().catch(() => ({}))) as {
          servers?: GameServerListItem[];
        };
        if (!backendsRes.ok || !Array.isArray(backendsData.servers)) {
          continue;
        }
        backendServers.push(...backendsData.servers);
      }

      const merged = [...rootServers, ...backendServers];
      return merged.filter(
        (server, index, arr) =>
          arr.findIndex((entry) => entry.id === server.id) === index,
      );
    },
    [tGameServer],
  );

  const writeServersCache = useCallback(
    (nodeRef: string, nextServers: GameServerListItem[]) => {
      if (!nodeRef) {
        return;
      }
      serverListCacheByNode.set(nodeRef, {
        servers: nextServers,
        fetchedAt: Date.now(),
      });
    },
    [],
  );

  const loadServers = useCallback(
    async (nodeRef: string, silent = false) => {
      if (!showServerNavigation || !nodeRef) {
        setServers([]);
        setServersError("");
        setServersLoading(false);
        return;
      }

      const cached = serverListCacheByNode.get(nodeRef);
      let effectiveSilent = silent;
      if (!silent && cached) {
        setServers(cached.servers);
        setServersError("");
        setServersLoading(false);
        effectiveSilent = true;
        if (Date.now() - cached.fetchedAt <= serverListCacheMaxAgeMs) {
          return;
        }
      }

      if (!effectiveSilent) {
        setServersLoading(true);
      }
      if (!effectiveSilent) {
        setServersError("");
      }
      try {
        const nextServers = await fetchServersWithStatus(nodeRef);
        writeServersCache(nodeRef, nextServers);
        setServers(nextServers);
      } catch {
        if (!effectiveSilent) {
          setServers([]);
          setServersError(tGameServer("errors.loadServers"));
        }
      } finally {
        if (!effectiveSilent) {
          setServersLoading(false);
        }
      }
    },
    [
      fetchServersWithStatus,
      showServerNavigation,
      tGameServer,
      writeServersCache,
    ],
  );

  const refreshServerStatuses = useCallback(
    async (nodeRef: string) => {
      if (!showServerNavigation || !nodeRef) {
        return;
      }

      try {
        const latestServers = await fetchServersWithStatus(nodeRef);
        const statusById = new Map(
          latestServers.map((server) => [server.id, server]),
        );

        setServers((current) => {
          const next = current.map((server) => {
            const latest = statusById.get(server.id);
            if (!latest) {
              return server;
            }

            if (
              server.status === latest.status &&
              server.statusOutput === latest.statusOutput &&
              server.statusError === latest.statusError
            ) {
              return server;
            }

            return {
              ...server,
              status: latest.status,
              statusOutput: latest.statusOutput,
              statusError: latest.statusError,
            };
          });
          writeServersCache(nodeRef, next);
          return next;
        });
      } catch {
        // Silent on purpose: this is a background status refresh for the sidebar blobs only.
      }
    },
    [fetchServersWithStatus, showServerNavigation, writeServersCache],
  );

  useEffect(() => {
    if (!showServerNavigation) {
      setServers([]);
      setServersError("");
      setServersLoading(false);
      return;
    }
    void loadServers(selectedNodeRef);
  }, [loadServers, selectedNodeRef, showServerNavigation]);

  useEffect(() => {
    if (!showServerNavigation || !selectedNodeRef) {
      return;
    }

    const onServersChanged = (event: Event) => {
      const customEvent = event as CustomEvent<ServersChangedDetail>;
      const changedNodeRef = customEvent.detail?.nodeRef;
      if (changedNodeRef && changedNodeRef !== selectedNodeRef) {
        return;
      }

      const changeType = customEvent.detail?.changeType;
      const changedServerRef = customEvent.detail?.serverRef;
      const changedStatus = customEvent.detail?.status;

      if (changeType === "status" && changedServerRef && changedStatus) {
        setServers((current) => {
          const next = current.map((server) => {
            if (server.id !== changedServerRef) {
              return server;
            }
            return {
              ...server,
              status: changedStatus,
              statusOutput:
                customEvent.detail?.statusOutput ?? server.statusOutput,
              statusError:
                customEvent.detail?.statusError ?? server.statusError,
            };
          });
          writeServersCache(selectedNodeRef, next);
          return next;
        });
        return;
      }

      void loadServers(selectedNodeRef, true);
    };

    window.addEventListener("vestri:servers-changed", onServersChanged);
    return () => {
      window.removeEventListener("vestri:servers-changed", onServersChanged);
    };
  }, [loadServers, selectedNodeRef, showServerNavigation, writeServersCache]);

  useEffect(() => {
    if (!showServerNavigation || !selectedNodeRef) {
      return;
    }

    const refresh = () => {
      void refreshServerStatuses(selectedNodeRef);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshServerStatuses, selectedNodeRef, showServerNavigation]);

  const nodeOptions = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        name: node.name || node.slug || node.id,
        logo: Network,
        logoSrc: "/logos/vestri/vestri_transparent.svg",
        logoAlt: "Vestri logo",
        plan: node.accessRole,
      })),
    [nodes],
  );

  const activeNode = nodes.find((node) => node.id === selectedNodeRef) || null;
  const activeServer =
    servers.find((server) => server.id === currentServerRef) || null;
  const showServerStatus = Boolean(currentServerRef);
  const headerTitle = showServerStatus
    ? activeServer?.name || currentServerRef
    : pageTitle || tDashboard("title");
  const headerNodeLabel =
    activeNode?.name || activeNode?.slug || selectedNodeRef || tNodes("title");

  const refreshHeaderServerStatus = useCallback(
    async (
      nodeRef: string,
      serverRef: string,
    ): Promise<GameServerListItem["status"] | null> => {
      try {
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(nodeRef)}/servers/${encodeURIComponent(serverRef)}/status`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          status?: GameServerListItem["status"];
          output?: string;
          error?: string;
        };
        if (!res.ok) {
          return null;
        }

        const nextStatus = data.status || "unknown";
        const nextOutput = data.output || "";
        const nextError = data.error || "";

        setServers((current) => {
          const next = current.map((server) =>
            server.id === serverRef
              ? {
                  ...server,
                  status: nextStatus,
                  statusOutput: nextOutput,
                  statusError: nextError,
                }
              : server,
          );
          writeServersCache(nodeRef, next);
          return next;
        });

        window.dispatchEvent(
          new CustomEvent("vestri:servers-changed", {
            detail: {
              nodeRef,
              changeType: "status",
              serverRef,
              status: nextStatus,
              statusOutput: nextOutput,
              statusError: nextError,
            },
          }),
        );

        return nextStatus;
      } catch {
        return null;
      }
    },
    [writeServersCache],
  );

  const runHeaderServerAction = useCallback(async () => {
    if (!activeServer || !selectedNodeRef) {
      return;
    }
    if (!activeServer.permissions.canControl || headerControlLoading !== "") {
      return;
    }

    const action: "start" | "stop" =
      activeServer.status === "up" ? "stop" : "start";
    setHeaderControlLoading(action);
    setHeaderControlError("");
    try {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(selectedNodeRef)}/servers/${encodeURIComponent(activeServer.id)}/${action}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        setHeaderControlError(tServer(`controls.errors.${action}`));
        return;
      }

      const expectedStatus: GameServerListItem["status"] =
        action === "start" ? "up" : "down";
      let latestStatus = await refreshHeaderServerStatus(
        selectedNodeRef,
        activeServer.id,
      );
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (latestStatus === expectedStatus) {
          break;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 700);
        });
        latestStatus = await refreshHeaderServerStatus(
          selectedNodeRef,
          activeServer.id,
        );
      }
      if (!latestStatus) {
        void loadServers(selectedNodeRef, true);
      }
    } catch {
      setHeaderControlError(tServer(`controls.errors.${action}`));
    } finally {
      setHeaderControlLoading("");
    }
  }, [
    activeServer,
    headerControlLoading,
    loadServers,
    refreshHeaderServerStatus,
    selectedNodeRef,
    tServer,
  ]);

  useEffect(() => {
    setHeaderControlError("");
    setHeaderControlLoading("");
  }, [currentServerRef]);

  const headerCanControl = Boolean(
    showServerStatus && activeServer?.permissions.canControl,
  );
  const headerActionLabel =
    headerControlLoading === "start"
      ? tServer("controls.starting")
      : headerControlLoading === "stop"
        ? tServer("controls.stopping")
        : activeServer?.status === "up"
          ? tServer("controls.stop")
          : tServer("controls.start");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {showNodeSwitcher ? (
            <TeamSwitcher
              teams={nodeOptions}
              activeTeamId={selectedNodeRef}
              onTeamChange={(node) => {
                if (node.id) {
                  setSelectedNodeRef(node.id);
                  onNodeChange?.(node.id);
                }
              }}
              label={tNodes("title")}
              addLabel={tDashboard("buttons.manageNodes")}
              addHref="/nodes"
            />
          ) : (
            <SidebarBrand title="VESTRI" subtitle="Platform" />
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarAppNav />
          {showServerNavigation ? (
            <ServerSidebarNav
              nodeRef={selectedNodeRef}
              servers={servers}
              serversLoading={serversLoading}
              serversError={serversError}
              activeServerRef={currentServerRef}
              activeSection={activeSection}
            />
          ) : null}
        </SidebarContent>
        <SidebarFooter>
          <SidebarProfileMenu />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex min-w-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{headerTitle}</p>
              <p className="truncate text-xs text-muted-foreground">
                {headerNodeLabel}
                {showServerStatus
                  ? ` | ${tServer(`status.${activeServer?.status || "unknown"}`)}`
                  : ""}
              </p>
            </div>
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div>
              {showServerStatus && activeServer ? (
                <Button
                  type="button"
                  size="sm"
                  variant={
                    activeServer.status === "up" ? "destructive" : "default"
                  }
                  disabled={!headerCanControl || headerControlLoading !== ""}
                  onClick={() => {
                    void runHeaderServerAction();
                  }}
                  title={headerControlError || undefined}
                >
                  {headerActionLabel}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 px-4">
            <ThemeToggle />
            <ToggleLanguage compact />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
