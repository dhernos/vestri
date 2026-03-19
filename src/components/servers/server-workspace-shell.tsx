"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network } from "lucide-react";
import { useTranslations } from "next-intl";
import { SidebarAppNav } from "@/components/servers/sidebar-app-nav";
import { SidebarBrand } from "@/components/servers/sidebar-brand";
import { SidebarProfileMenu } from "@/components/servers/sidebar-profile-menu";
import { ServerSidebarNav } from "@/components/servers/server-sidebar-nav";
import { TeamSwitcher } from "@/components/team-switcher";
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

  const loadServers = useCallback(
    async (nodeRef: string) => {
      if (!showServerNavigation || !nodeRef) {
        setServers([]);
        setServersError("");
        setServersLoading(false);
        return;
      }

      setServersLoading(true);
      setServersError("");
      try {
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
          setServers([]);
          setServersError(data.message || tGameServer("errors.loadServers"));
          return;
        }
        const rootServers = Array.isArray(data.servers) ? data.servers : [];
        const velocityServers = rootServers.filter(
          (server) => server.kind === "velocity",
        );

        if (velocityServers.length === 0) {
          setServers(rootServers);
          return;
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
        const deduped = merged.filter(
          (server, index, arr) =>
            arr.findIndex((entry) => entry.id === server.id) === index,
        );
        setServers(deduped);
      } catch {
        setServers([]);
        setServersError(tGameServer("errors.loadServers"));
      } finally {
        setServersLoading(false);
      }
    },
    [showServerNavigation, tGameServer],
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

  const nodeOptions = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        name: node.name || node.slug || node.id,
        logo: Network,
        plan: node.accessRole,
      })),
    [nodes],
  );

  const activeNode = nodes.find((node) => node.id === selectedNodeRef) || null;
  const activeServer = servers.find((server) => server.id === currentServerRef) || null;
  const showServerStatus = Boolean(currentServerRef);
  const headerTitle = showServerStatus
    ? activeServer?.name || currentServerRef
    : pageTitle || tDashboard("title");
  const headerNodeLabel =
    activeNode?.name || activeNode?.slug || selectedNodeRef || tNodes("title");

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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b">
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
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
