"use client";

import { Bell, ChevronsUpDown, LogOut, UserCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const getInitials = (name: string, email: string) => {
  const source = name.trim() || email.trim();
  if (!source) {
    return "U";
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};

export function SidebarProfileMenu() {
  const { isMobile } = useSidebar();
  const { data: session } = useAuth();
  const router = useRouter();
  const tProfile = useTranslations("ProfilePage");
  const tActiveSessions = useTranslations("ActiveSessions");

  const userName = session?.user?.name?.trim() || "User";
  const userEmail = session?.user?.email || "";
  const userImage = session?.user?.image || "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={userImage} alt={userName} />
                <AvatarFallback className="rounded-lg">
                  {getInitials(userName, userEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userName}</span>
                <span className="truncate text-xs">{userEmail}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <UserCircle2 className="size-4" />
                <span>{tProfile("profilePageHeader")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="flex items-center gap-2">
                <Bell className="size-4" />
                <span>Notifications</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                router.push("/logout");
              }}
            >
              <LogOut className="size-4" />
              <span>{tActiveSessions("buttons.logoutThisDevice")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
