"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SidebarBrandProps = {
  title?: string;
  subtitle?: string;
  logoPlaceholder?: string;
};

export function SidebarBrand({
  title = "VESTRI",
  subtitle = "Control Panel",
  logoPlaceholder = "LOGO",
}: SidebarBrandProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tabIndex={-1}
          className="cursor-default hover:bg-transparent active:bg-transparent"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-dashed border-sidebar-border bg-sidebar-primary/10 text-[10px] font-semibold tracking-wide text-sidebar-primary">
            {logoPlaceholder}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
