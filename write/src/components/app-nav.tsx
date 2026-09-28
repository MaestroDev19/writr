import * as React from "react"
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
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import {
  Sun,
  Moon,
  Settings,
  LogOut,
  Search,
  Sparkles,
  MessageSquareQuote,
  LayoutDashboard,
  Menu,
  Cloud,
} from "lucide-react"
import { useSettings } from "@/contexts/settings-context"

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
  const { activeModelDisplayName } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)

  const isActive = (path: string) => location.pathname === path

  const displayName = profile?.author_name || user?.user_metadata?.author_name || "Author"
  const email = profile?.email || user?.email || ""
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || ""
  const initials = getInitials(displayName, email)

  const navItems = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Write", href: "/generate", icon: Sparkles },
    { label: "Review", href: "/critique", icon: MessageSquareQuote },
  ]

  const handleNavClick = (href: string) => {
    setIsDrawerOpen(false)
    navigate(href)
  }

  return (
    <div className="sticky top-0 z-40 w-full">
      {/* NeoBrutalist Violet Top Accent Stripe */}
      <div className="h-0.5 w-full bg-primary" />

      <header className="border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-2.5">
          {/* Left: Brand + Desktop Nav Links */}
          <div className="flex items-center gap-6 lg:gap-8">
            {/* Logo and Brand */}
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 select-none cursor-pointer group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              aria-label="Writr Home"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-xs shadow-xs transition-transform group-hover:scale-105">
                W
              </div>
              <span className="text-base font-bold tracking-tight text-foreground">
                Writr
              </span>
            </Link>

            {/* Desktop Navigation links */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Main">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex min-h-9 items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium transition-colors select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <item.icon className="size-3.5" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right: Search, Dark Mode, Avatar, Mobile Drawer Trigger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search Box / Command Shortcut */}
            <div className="hidden lg:flex items-center gap-2 rounded-[var(--radius)] border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground select-none">
              <Search className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Search notes…</span>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono font-medium text-foreground shadow-2xs">
                Ctrl K
              </kbd>
            </div>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-accent hover:text-accent-foreground cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              title="Toggle theme (press 'd')"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </button>

            {/* Desktop Avatar with Dropdown Menu */}
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex cursor-pointer items-center justify-center rounded-full p-0.5 transition-transform hover:scale-105 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
                      <LayoutDashboard className="size-3.5 text-muted-foreground" />
                      <span>Home</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigate("/settings")}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Settings className="size-3.5 text-muted-foreground" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator className="my-1 border-border" />

                  <DropdownMenuItem
                    onClick={signOut}
                    variant="destructive"
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                  >
                    <LogOut className="size-3.5 text-destructive" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Drawer Trigger (Hamburger Menu) */}
            <div className="md:hidden">
              <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerTrigger
                  className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-accent hover:text-accent-foreground cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open navigation drawer"
                >
                  <Menu className="size-4" />
                </DrawerTrigger>

                <DrawerContent side="right" className="w-[85vw] max-w-sm">
                  <DrawerHeader className="border-b border-border text-left">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 ring-1 ring-border" size="default">
                        {avatarUrl ? (
                          <AvatarImage src={avatarUrl} alt={displayName} />
                        ) : null}
                        <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <DrawerTitle className="text-base truncate">
                          {displayName}
                        </DrawerTitle>
                        <DrawerDescription className="truncate text-[11px]">
                          {email || "Signed in"}
                        </DrawerDescription>
                      </div>
                    </div>
                  </DrawerHeader>

                  {/* Orientation snapshot inside mobile drawer */}
                  <div className="my-3 rounded-[var(--radius)] border border-border bg-muted/30 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">Mode</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Cloud className="size-3" aria-hidden="true" />
                        Cloud
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Model</span>
                      <span className="max-w-[150px] truncate text-[11px] text-foreground">
                        {activeModelDisplayName}
                      </span>
                    </div>
                  </div>

                  {/* Nav Links in Drawer */}
                  <div className="flex flex-col gap-1 py-2" role="menu">
                    {navItems.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => handleNavClick(item.href)}
                          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition cursor-pointer text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                            active
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-foreground hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <item.icon className="size-4 shrink-0" aria-hidden="true" />
                            <span>{item.label}</span>
                          </div>
                        </button>
                      )
                    })}

                    {/* Settings drawer link */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false)
                        navigate("/settings")
                      }}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition cursor-pointer text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                        isActive("/settings")
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Settings className="size-4 shrink-0" />
                        <span>Settings</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Cloud
                      </span>
                    </button>
                  </div>

                  {/* Drawer Footer actions */}
                  <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                        <span>Theme</span>
                      </div>
                      <span className="capitalize text-muted-foreground">{theme}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false)
                        signOut()
                      }}
                      className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 cursor-pointer"
                    >
                      <LogOut className="size-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}