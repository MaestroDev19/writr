"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { agentNav, settingsNav, workspaceNav } from "@/lib/nav"
import { cn } from "@/lib/utils"

function getInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return "W"
}

function NavGroup({
  label,
  items,
}: {
  label: string
  items: typeof workspaceNav
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="px-3 py-1.5">
      <SidebarGroupLabel className="h-7 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={active}
                  className={cn(
                    "h-9 rounded-md px-2.5",
                    active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </SidebarMenuButton>
                {item.status === "soon" ? (
                  <SidebarMenuBadge className="rounded-md bg-muted px-1.5 font-mono text-[10px] font-normal tracking-normal text-muted-foreground normal-case">
                    Soon
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  const router = useRouter()
  const { user, profile, signOut } = useAuth()

  const displayName =
    profile?.author_name ||
    (typeof user?.user_metadata?.author_name === "string"
      ? user.user_metadata.author_name
      : null) ||
    "Author"
  const email = user?.email ?? ""
  const avatarUrl =
    profile?.avatar_url ||
    (typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : "") ||
    ""
  const initials = getInitials(displayName, email)

  return (
    <Sidebar
      collapsible="none"
      variant="sidebar"
      className="w-[15.5rem] shrink-0 border-e border-sidebar-border bg-sidebar"
    >
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/home"
          className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            W
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span className="font-heading text-sm font-semibold tracking-tight">
              Writr
            </span>
            <span className="text-[11px] text-muted-foreground">
              Local workspace
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-3 py-3">
        <NavGroup label="Workspace" items={workspaceNav} />
        <NavGroup label="Agents" items={agentNav} />
        <NavGroup label="System" items={settingsNav} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-start text-sm outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-open:bg-sidebar-accent"
            aria-label="Account menu"
          >
            <Avatar className="size-8 shrink-0 rounded-md">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback className="rounded-md bg-muted text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
              <span className="truncate text-sm font-medium">{displayName}</span>
              {email ? (
                <span className="truncate text-[11px] text-muted-foreground">
                  {email}
                </span>
              ) : null}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="normal-case tracking-normal">
                <div className="truncate font-semibold">{displayName}</div>
                {email ? (
                  <div className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground">
                    {email}
                  </div>
                ) : null}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="gap-2"
              >
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onClick={() => void signOut()}
            >
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
