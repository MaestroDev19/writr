"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Spinner, LoadingText } from "@/components/ui/spinner"

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6 text-primary" />
        <LoadingText
          messages={[
            "Checking authorization…",
            "Loading Writr workspace…",
            "Syncing account state…",
          ]}
          className="text-xs text-muted-foreground"
        />
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`)
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoadingScreen />
  return <>{children}</>
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/")
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) return <LoadingScreen />
  if (isAuthenticated) return <LoadingScreen />
  return <>{children}</>
}
