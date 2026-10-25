"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { RequireAuth } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import {
  KeyboardShortcuts,
  openShortcutsHelp,
} from "@/components/keyboard-shortcuts"
import { Spinner } from "@/components/ui/spinner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useChatSettings } from "@/components/chat-settings-provider"
import { isSetupReady } from "@/lib/setup-state"

function ShellInner({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}) {
  const router = useRouter()
  const [ready] = useState(() => isSetupReady())
  const { ollamaOk, statusLabel, statusTone } = useChatSettings()

  useEffect(() => {
    if (!ready) router.replace("/")
  }, [ready, router])

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen className="h-[100dvh] max-h-[100dvh] overflow-hidden">
      <KeyboardShortcuts />
      <div className="flex h-full w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {title ? (
            <AppTopbar
              title={title}
              subtitle={subtitle}
              ollamaOk={ollamaOk ?? true}
              statusLabel={statusLabel}
              statusTone={statusTone}
              actions={actions}
              onOpenShortcuts={openShortcutsHelp}
            />
          ) : null}
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <RequireAuth>
      <ShellInner title={title} subtitle={subtitle} actions={actions}>
        {children}
      </ShellInner>
    </RequireAuth>
  )
}
