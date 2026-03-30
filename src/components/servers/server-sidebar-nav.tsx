"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  buildServerWorkspacePath,
  type ServerWorkspaceSection,
} from "@/features/servers/navigation";
import type { GameServerListItem, ServerStatus } from "@/features/servers/types";

type ServerSidebarNavProps = {
  nodeRef: string;
  servers: GameServerListItem[];
  serversLoading: boolean;
  serversError: string;
  activeServerRef: string;
  activeSection: ServerWorkspaceSection;
};

const statusDotClass = (status: ServerStatus) => {
  switch (status) {
    case "up":
      return "bg-success";
    case "down":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/50";
  }
};

export function ServerSidebarNav({
  nodeRef,
  servers,
  serversLoading,
  serversError,
  activeServerRef,
  activeSection,
}: ServerSidebarNavProps) {
  const tGameServer = useTranslations("GameServerPanel");
  const tDashboard = useTranslations("DashboardPage");
  const tServer = useTranslations("ServerPage");
  const createServerHref = nodeRef
    ? `/dashboard?node=${encodeURIComponent(nodeRef)}`
    : "/dashboard";

  const sectionItems: {
    section: ServerWorkspaceSection;
    title: string;
  }[] = [
    {
      section: "dashboard",
      title: tDashboard("title"),
    },
    {
      section: "config",
      title: tServer("configEditor.title"),
    },
    {
      section: "filesystem",
      title: tServer("fileBrowser.title"),
    },
    {
      section: "console",
      title: tServer("logs.title"),
    },
  ];

  const topLevelServers = servers.filter(
    (server) =>
      !(server.kind === "velocity-backend" && Boolean(server.parentServerId)),
  );
  const backendMap = new Map<string, GameServerListItem[]>();

  servers.forEach((server) => {
    if (server.kind !== "velocity-backend" || !server.parentServerId) {
      return;
    }
    const current = backendMap.get(server.parentServerId) || [];
    current.push(server);
    backendMap.set(server.parentServerId, current);
  });

  backendMap.forEach((value, key) => {
    value.sort((a, b) => a.name.localeCompare(b.name));
    backendMap.set(key, value);
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tGameServer("serverList.title")}</SidebarGroupLabel>
      <SidebarMenu>
        {serversLoading ? (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>{tServer("loading")}</SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}

        {!serversLoading && serversError ? (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>{serversError}</SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}

        {!serversLoading && !serversError && servers.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              {tGameServer("empty.servers")}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}

        {!serversLoading && !serversError
          ? topLevelServers.map((server) => {
              const backends = backendMap.get(server.id) || [];
              const isActiveServer = server.id === activeServerRef;
              const hasActiveBackend = backends.some(
                (backend) => backend.id === activeServerRef,
              );
              return (
                <Collapsible
                  key={server.id}
                  asChild
                  defaultOpen={isActiveServer || hasActiveBackend}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isActiveServer}
                        tooltip={server.name}
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            statusDotClass(server.status),
                          )}
                        />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {server.name}
                        </span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {sectionItems.map((sectionItem) => (
                          <SidebarMenuSubItem
                            key={`${server.id}-${sectionItem.section}`}
                          >
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                isActiveServer &&
                                activeSection === sectionItem.section
                              }
                            >
                              <Link
                                href={buildServerWorkspacePath(
                                  nodeRef,
                                  server.id,
                                  sectionItem.section,
                                )}
                              >
                                <span>{sectionItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}

                        {backends.length > 0 ? (
                          <li className="mt-1 px-2 py-1 text-[11px] uppercase tracking-wide text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                            {tServer("velocity.title")}
                          </li>
                        ) : null}

                        {backends.map((backend) => {
                          const isActiveBackend = backend.id === activeServerRef;
                          return (
                            <Collapsible
                              key={backend.id}
                              asChild
                              defaultOpen={isActiveBackend}
                              className="group/sub-collapsible"
                            >
                              <li>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton
                                    size="sm"
                                    isActive={isActiveBackend}
                                  >
                                    <span
                                      className={cn(
                                        "size-2 shrink-0 rounded-full",
                                        statusDotClass(backend.status),
                                      )}
                                    />
                                    <span>{backend.name}</span>
                                    <ChevronRight className="ml-auto size-3 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90" />
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <ul className="ml-2 mt-1 flex min-w-0 flex-col gap-1 border-l border-sidebar-border px-2 py-0.5 group-data-[collapsible=icon]:hidden">
                                    {sectionItems.map((sectionItem) => (
                                      <li key={`${backend.id}-${sectionItem.section}`}>
                                        <SidebarMenuSubButton
                                          asChild
                                          size="sm"
                                          isActive={
                                            isActiveBackend &&
                                            activeSection === sectionItem.section
                                          }
                                        >
                                          <Link
                                            href={buildServerWorkspacePath(
                                              nodeRef,
                                              backend.id,
                                              sectionItem.section,
                                            )}
                                          >
                                            <span>{sectionItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </li>
                                    ))}
                                  </ul>
                                </CollapsibleContent>
                              </li>
                            </Collapsible>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })
          : null}

        {!serversLoading && !serversError ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={tGameServer("buttons.createServer")}
              className="justify-center font-semibold"
            >
              <Link href={createServerHref} aria-label={tGameServer("buttons.createServer")}>
                <span className="w-full text-center">+</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  );
}
