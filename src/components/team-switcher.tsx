"use client"

import * as React from "react"
import { ChevronsUpDown, Plus } from "lucide-react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type TeamSwitcherOption = {
  id?: string
  name: string
  logo?: React.ElementType
  logoSrc?: string
  logoAlt?: string
  plan: string
}

type TeamSwitcherProps = {
  teams: TeamSwitcherOption[]
  activeTeamId?: string
  onTeamChange?: (team: TeamSwitcherOption) => void
  label?: string
  addLabel?: string
  addHref?: string
}

export function TeamSwitcher({
  teams,
  activeTeamId,
  onTeamChange,
  label = "Teams",
  addLabel = "Add team",
  addHref,
}: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const [activeTeam, setActiveTeam] = React.useState<TeamSwitcherOption | undefined>(
    teams[0]
  )

  React.useEffect(() => {
    if (teams.length === 0) {
      setActiveTeam(undefined)
      return
    }

    if (activeTeamId) {
      const matchedTeam = teams.find((team) => team.id === activeTeamId)
      if (matchedTeam) {
        setActiveTeam(matchedTeam)
        return
      }
    }

    setActiveTeam((current) => {
      if (
        current &&
        teams.some(
          (team) =>
            (team.id && current.id && team.id === current.id) ||
            (!team.id && !current.id && team.name === current.name)
        )
      ) {
        return current
      }
      return teams[0]
    })
  }, [activeTeamId, teams])

  if (!activeTeam) {
    return null
  }

  const handleTeamSelection = (team: TeamSwitcherOption) => {
    setActiveTeam(team)
    onTeamChange?.(team)
  }

  const renderTeamLogo = (
    team: TeamSwitcherOption,
    imageClassName: string,
    iconClassName: string,
    imageSize: number
  ) => {
    if (team.logoSrc) {
      return (
        <Image
          src={team.logoSrc}
          alt={team.logoAlt || `${team.name} logo`}
          width={imageSize}
          height={imageSize}
          className={cn("object-contain dark:invert dark:brightness-125", imageClassName)}
        />
      )
    }
    if (team.logo) {
      const Logo = team.logo
      return <Logo className={iconClassName} />
    }
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-sidebar-primary">
        {team.name.slice(0, 1)}
      </span>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div
                className={cn(
                  "flex aspect-square size-8 items-center justify-center rounded-lg",
                  activeTeam.logoSrc
                    ? "border border-sidebar-border bg-card shadow-xs"
                    : "bg-sidebar-primary text-sidebar-primary-foreground"
                )}
              >
                {renderTeamLogo(activeTeam, "size-5", "size-4", 20)}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {label}
            </DropdownMenuLabel>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id || team.name}
                onClick={() => handleTeamSelection(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-card">
                  {renderTeamLogo(team, "size-4", "size-3.5 shrink-0", 16)}
                </div>
                {team.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {addHref ? (
              <DropdownMenuItem className="gap-2 p-2" asChild>
                <Link href={addHref}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">{addLabel}</div>
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">{addLabel}</div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
