"use client";

import { Bell, BellDot, LayoutDashboard, Network, UserCircle2 } from "lucide-react";
import { useEffect, useState, type ElementType } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  href: string;
  icon: ElementType;
  activeWhen: (pathname: string) => boolean;
};

const isPathActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function SidebarAppNav() {
  const tDashboard = useTranslations("DashboardPage");
  const tNodes = useTranslations("NodesPage");
  const tProfile = useTranslations("ProfilePage");
  const tNotifications = useTranslations("NotificationsPage");
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/notifications/unread", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { unread: number };
        if (!controller.signal.aborted) setUnread(data.unread);
      } catch {
        // Keep the last known state on transient failures.
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    window.addEventListener("vestri:notifications-changed", refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("vestri:notifications-changed", refresh);
    };
  }, [pathname]);

  const items: NavItem[] = [
    {
      title: tDashboard("title"),
      href: "/dashboard",
      icon: LayoutDashboard,
      activeWhen: (path) =>
        isPathActive(path, "/dashboard") || isPathActive(path, "/servers"),
    },
    {
      title: tNotifications("title"),
      href: "/notifications",
      icon: unread > 0 ? BellDot : Bell,
      activeWhen: (path) => isPathActive(path, "/notifications"),
    },
    {
      title: tNodes("title"),
      href: "/nodes",
      icon: Network,
      activeWhen: (path) => isPathActive(path, "/nodes"),
    },
    {
      title: tProfile("profilePageHeader"),
      href: "/profile",
      icon: UserCircle2,
      activeWhen: (path) => isPathActive(path, "/profile"),
    },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={item.activeWhen(pathname)}>
              <Link href={item.href}>
                <item.icon className={item.href === "/notifications" && unread > 0 ? "text-primary" : undefined} />
                <span>{item.title}</span>
                {item.href === "/notifications" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 text-xs font-medium tabular-nums text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
