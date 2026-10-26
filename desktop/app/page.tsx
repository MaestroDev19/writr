"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RequireAuth } from "@/components/auth-guard"
import { useAuth } from "@/components/auth-provider"
import { SetupGate } from "@/components/setup/setup-gate"
import { Spinner, LoadingText } from "@/components/ui/spinner"
import { isSetupReady, markSetupReady } from "@/lib/setup-state"

function HomeContent() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (isSetupReady()) {
      router.replace("/home")
      return
    }
    setChecking(false)
  }, [router])

  if (checking) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background">
        <Spinner className="size-6 text-primary" />
        <LoadingText
          messages={[
            "Checking setup state…",
            "Initializing Writr environment…",
          ]}
          className="text-xs text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <SetupGate
      onReady={() => {
        markSetupReady()
        router.replace("/home")
      }}
      onSignOut={() => void signOut()}
    />
  )
}

export default function RootPage() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  )
}
