import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  Search,
  Sparkles,
  MessageSquareQuote,
  Database,
  LayoutDashboard,
} from "lucide-react"

function getInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return "W"
}

export function NavigationHeader() {
  const { theme, setTheme } = useTheme()
  const { profile, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path

  const displayName = profile?.author_name || user?.user_metadata?.author_name || "Author"
  const email = profile?.email || user?.email || ""
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || ""
  const initials = getInitials(displayName, email)

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Generate", href: "/generate", icon: Sparkles },
    { label: "Critique", href: "/critique", icon: MessageSquareQuote },
    { label: "Ingestion", href: "/ingestion", icon: Database },
  ]

  return (
    <div className="sticky top-0 z-40 w-full">
      {/* Violet Theme Top Accent Stripe */}
      <div className="h-0.5 w-full bg-primary" />

      <header className="border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          {/* Left: Brand + Nav Links */}
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Logo and Brand */}
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 select-none cursor-pointer group"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-xs shadow-xs transition-transform group-hover:scale-105">
                W
              </div>
              <span className="text-base font-bold tracking-tight text-foreground">
                Writr
              </span>
            </Link>

            {/* Navigation links (Dashboard, Generate, Critique, Ingestion) */}
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors select-none ${
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right: Search, Dark Mode Toggle, Avatar Dropdown */}
          <div className="flex items-center gap-3">
            {/* Search Box / Command Shortcut */}
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground select-none">
              <Search className="size-3.5 text-muted-foreground" />
              <span>Search...</span>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono font-medium text-foreground shadow-2xs">
                Ctrl K
              </kbd>
            </div>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-accent hover:text-accent-foreground cursor-pointer"
              title="Toggle theme (or press 'd')"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </button>

            {/* User Avatar with Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex cursor-pointer items-center justify-center rounded-full p-0.5 transition-transform hover:scale-105 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="User menu"
              >
                <Avatar className="size-8 ring-1 ring-border shadow-xs" size="sm">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2.5 py-2 text-xs normal-case tracking-normal">
                    <div className="font-semibold text-foreground truncate">
                      {displayName}
                    </div>
                    {email ? (
                      <div className="text-muted-foreground text-[11px] font-normal truncate mt-0.5">
                        {email}
                      </div>
                    ) : null}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-1 border-border" />

                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => navigate("/dashboard")}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <User className="size-3.5 text-muted-foreground" />
                    <span>Account Setting</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => navigate("/dashboard")}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Settings className="size-3.5 text-muted-foreground" />
                    <span>App Setting</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-1 border-border" />

                <DropdownMenuItem
                  onClick={signOut}
                  variant="destructive"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                >
                  <LogOut className="size-3.5 text-destructive" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Nav Links Strip */}
        <div className="flex sm:hidden items-center justify-around border-t border-border px-4 py-1.5 bg-muted/20">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="size-3" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </header>
    </div>
  )
}