"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  MessageSquareQuote,
  Settings,
  Sparkles,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { StatusPill } from "@/components/status-pill"
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
import { EMBED_MODEL } from "@/lib/setup"
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

const navItems = [
  { label: "Library", href: "/library", icon: LayoutDashboard },
  { label: "Write", href: "/write", icon: Sparkles },
  { label: "Review", href: "/review", icon: MessageSquareQuote },
] as const

export function AppNav({
  ollamaOk = true,
  modelLabel = EMBED_MODEL,
}: {
  ollamaOk?: boolean
  modelLabel?: string
}) {
  const pathname = usePathname()
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
    <div className="sticky top-0 z-40 w-full">
      <div className="h-0.5 w-full bg-primary" aria-hidden />
      <header className="border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 lg:gap-8">
            <Link
              href="/library"
              className="group flex items-center gap-2.5 rounded-md select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Writr Library"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
                W
              </span>
              <span className="text-base font-bold tracking-tight text-foreground">
                Writr
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="size-3.5" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <StatusPill
              className="hidden sm:inline-flex"
              label={ollamaOk ? `Local · ${modelLabel}` : "Ollama unreachable"}
              tone={ollamaOk ? "ok" : "error"}
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex cursor-pointer items-center justify-center rounded-full p-0.5 outline-hidden transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="User menu"
              >
                <Avatar className="size-8 shadow-xs ring-1 ring-border">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="normal-case tracking-normal">
                    <div className="truncate font-semibold text-foreground">
                      {displayName}
                    </div>
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
                    onClick={() => router.push("/library")}
                    className="gap-2"
                  >
                    <BookOpen className="size-3.5 text-muted-foreground" />
                    Library
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                    className="gap-2"
                  >
                    <Settings className="size-3.5 text-muted-foreground" />
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
          </div>
        </div>

        <nav
          className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 md:hidden"
          aria-label="Main mobile"
        >
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/settings"
            className={cn(
              "flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              pathname.startsWith("/settings")
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            <Settings className="size-3.5" aria-hidden />
            Settings
          </Link>
        </nav>
      </header>
    </div>
  )
}
