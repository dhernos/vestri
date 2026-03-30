"use client";

import Image from "next/image";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SidebarBrandProps = {
  title?: string;
  subtitle?: string;
  logoSrc?: string;
  logoAlt?: string;
  logoPlaceholder?: string;
};

export function SidebarBrand({
  title = "VESTRI",
  subtitle = "Control Panel",
  logoSrc = "/logos/vestri/vestri_transparent.svg",
  logoAlt = "Vestri logo",
  logoPlaceholder = "V",
}: SidebarBrandProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tabIndex={-1}
          className="cursor-default hover:bg-transparent active:bg-transparent"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-sidebar-border bg-card shadow-xs">
            {logoSrc ? (
              <Image
                src={logoSrc}
                alt={logoAlt}
                width={20}
                height={20}
                className="size-5 object-contain dark:invert dark:brightness-125"
                priority
              />
            ) : (
              <span className="text-[10px] font-semibold tracking-wide text-sidebar-primary">
                {logoPlaceholder}
              </span>
            )}
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
