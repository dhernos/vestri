"use client";

import { Bell, LayoutDashboard, Network, UserCircle2 } from "lucide-react";
import type { ElementType } from "react";
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
  const pathname = usePathname();

  const items: NavItem[] = [
    {
      title: tDashboard("title"),
      href: "/dashboard",
      icon: LayoutDashboard,
      activeWhen: (path) =>
        isPathActive(path, "/dashboard") || isPathActive(path, "/servers"),
    },
    {
      title: "Notifications",
      href: "/notifications",
      icon: Bell,
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
                <item.icon />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
