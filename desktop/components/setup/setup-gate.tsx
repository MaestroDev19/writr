"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BookOpen,
  Bot,
  Database,
  HardDrive,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { StatusPill } from "@/components/status-pill"
import {
  EMBED_MODEL,
  RECOMMENDED_CHAT_MODEL,
  ensureLocalDatabase,
  hasEmbedModel,
  getInstalledChatModel,
  initialSetupSteps,
  pullEmbedModel,
  pullModel,
  openOllamaInstallDocs,
  checkOllama,
} from "@/lib/setup"
import { readChatSettings, writeChatSettings } from "@/lib/chat-settings"
import type { SetupStep } from "@/types/library"
import { cn } from "@/lib/utils"

function stepTone(status: SetupStep["status"]) {
  if (status === "done") return "ok" as const
  if (status === "error") return "error" as const
  if (status === "active") return "busy" as const
  return "muted" as const
}

const stepIcons = {
  ollama: HardDrive,
  model: Sparkles,
  embed_model: Sparkles,
  chat_model: Bot,
  database: Database,
} as const

const unlocks = [
  "Library notes on this machine",
  "Write and Review with a target draft",
  "Plan, Analyse, Research, Publish surfaces",
  "Notion import via MCP later",
] as const

export function SetupGate({
  onReady,
  onSignOut,
}: {
  onReady: () => void
  onSignOut: () => void
}) {
  const [steps, setSteps] = useState<SetupStep[]>(initialSetupSteps)
  const [running, setRunning] = useState(false)
  const [liveMessage, setLiveMessage] = useState("Checking this machine...")

  const patchStep = useCallback(
    (id: SetupStep["id"], patch: Partial<SetupStep>) => {
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    },
    []
  )

  const runChecks = useCallback(async () => {
    setRunning(true)
    setSteps(initialSetupSteps())
    setLiveMessage("Checking Ollama...")

    patchStep("ollama", { status: "active", detail: "Pinging 127.0.0.1:11434" })
    const ollamaCheck = await checkOllama()
    if (!ollamaCheck.ok) {
      if (ollamaCheck.error === "cors_blocked") {
        patchStep("ollama", {
          status: "error",
          detail: "CORS blocked. Set OLLAMA_ORIGINS=* and restart Ollama.",
        })
        setLiveMessage("Ollama rejected desktop connection (CORS 403). Set OLLAMA_ORIGINS=* and restart Ollama.")
      } else {
        patchStep("ollama", {
          status: "error",
          detail: "Ollama unreachable",
        })
        setLiveMessage("Ollama unreachable. Install it, then retry.")
      }
      setRunning(false)
      return
    }
    patchStep("ollama", { status: "done", detail: "Reachable" })

    setLiveMessage(`Checking ${EMBED_MODEL}...`)
    patchStep("embed_model", {
      status: "active",
      detail: `Looking for ${EMBED_MODEL}`,
      progress: 10,
    })
    const modelOk = await hasEmbedModel()
    if (!modelOk) {
      try {
        await pullEmbedModel(({ percent, status }) => {
          patchStep("embed_model", {
            status: "active",
            detail: status,
            progress: percent,
          })
          setLiveMessage(`Pulling ${EMBED_MODEL}... ${status}`)
        })
      } catch {
        patchStep("embed_model", {
          status: "error",
          detail: `Model missing - run: ollama pull ${EMBED_MODEL}`,
          progress: undefined,
        })
        setLiveMessage(`Pull ${EMBED_MODEL} in Ollama, then retry.`)
        setRunning(false)
        return
      }
      if (!(await hasEmbedModel())) {
        patchStep("embed_model", {
          status: "error",
          detail: `Model missing - run: ollama pull ${EMBED_MODEL}`,
          progress: undefined,
        })
        setLiveMessage(`Pull ${EMBED_MODEL} in Ollama, then retry.`)
        setRunning(false)
        return
      }
    }
    patchStep("embed_model", { status: "done", detail: EMBED_MODEL, progress: 100 })

    setLiveMessage("Checking chat LLM...")
    patchStep("chat_model", {
      status: "active",
      detail: "Checking installed models",
      progress: 10,
    })
    const existingChat = await getInstalledChatModel()
    if (existingChat) {
      patchStep("chat_model", {
        status: "done",
        detail: `Installed · ${existingChat}`,
        progress: 100,
      })
      const current = readChatSettings()
      if (!current.model) {
        writeChatSettings({ ...current, model: existingChat })
      }
    } else {
      setLiveMessage(`Pulling small LLM (${RECOMMENDED_CHAT_MODEL})...`)
      patchStep("chat_model", {
        status: "active",
        detail: `Pulling ${RECOMMENDED_CHAT_MODEL} (Recommended small LLM)`,
        progress: 0,
      })
      try {
        await pullModel(RECOMMENDED_CHAT_MODEL, ({ percent, status }) => {
          patchStep("chat_model", {
            status: "active",
            detail: status,
            progress: percent,
          })
          setLiveMessage(`Pulling ${RECOMMENDED_CHAT_MODEL}... ${status}`)
        })
        patchStep("chat_model", {
          status: "done",
          detail: RECOMMENDED_CHAT_MODEL,
          progress: 100,
        })
        const current = readChatSettings()
        writeChatSettings({ ...current, model: RECOMMENDED_CHAT_MODEL })
      } catch {
        patchStep("chat_model", {
          status: "error",
          detail: `Model missing - run: ollama pull ${RECOMMENDED_CHAT_MODEL}`,
          progress: undefined,
        })
        setLiveMessage(`Pull ${RECOMMENDED_CHAT_MODEL} in Ollama, then retry.`)
        setRunning(false)
        return
      }
    }

    setLiveMessage("Preparing local database...")
    patchStep("database", { status: "active", detail: "Migrating" })
    const db = await ensureLocalDatabase()
    if (!db.ok) {
      patchStep("database", {
        status: "error",
        detail: db.error ?? "Database failed",
      })
      setLiveMessage(db.error ?? "Local database failed.")
      setRunning(false)
      return
    }
    patchStep("database", { status: "done", detail: "Ready" })
    setLiveMessage("Machine ready. Open the workspace when you are.")
    setRunning(false)
  }, [patchStep])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runChecks()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [runChecks])

  useEffect(() => {
    const onFocus = () => {
      const blocked = steps.some((s) => s.status === "error")
      if (blocked && !running) void runChecks()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [steps, running, runChecks])

  const allDone = steps.every((s) => s.status === "done")
  const hasError = steps.some((s) => s.status === "error")

  return (
    <div dir="ltr" className="flex min-h-[100dvh] w-full flex-col bg-background">
      <header className="flex w-full shrink-0 items-center justify-between border-b border-border px-5 py-3 sm:px-8">
        <p className="font-heading text-lg font-semibold tracking-tight">Writr</p>
        <Button type="button" variant="outline" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </header>

      <div className="grid w-full flex-1 md:grid-cols-[minmax(16rem,0.9fr)_minmax(20rem,1.1fr)]">
        <aside className="relative hidden border-e border-border bg-muted/50 md:flex md:flex-col md:justify-between md:gap-8 md:px-8 md:py-10 lg:px-10 lg:py-12">
          <div className="flex max-w-[28rem] flex-col gap-4">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="size-4" aria-hidden />
            </span>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              One local workspace for notes and agents
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Setup unlocks Library, Write, Review, and the rest of the shell on
              this machine. Auth is only your identity.
            </p>
          </div>
          <ul className="flex max-w-[28rem] flex-col gap-2.5">
            {unlocks.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm leading-relaxed text-foreground"
              >
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex w-full min-w-0 flex-col justify-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="mx-auto flex w-full max-w-[28rem] flex-col gap-6">
            <div className="flex w-full flex-col gap-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                Get this machine ready
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Embeddings stay local. Auth is identity only.
              </p>
            </div>

            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {liveMessage}
            </div>

            <ul className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card">
              {steps.map((step) => {
                const Icon = stepIcons[step.id]
                return (
                  <li
                    key={step.id}
                    className="flex flex-col gap-2 border-b border-border px-4 py-3.5 last:border-b-0"
                  >
                    <div className="flex w-full items-center gap-3">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md border",
                          step.status === "done" &&
                            "border-primary bg-primary text-primary-foreground",
                          step.status === "active" &&
                            "border-primary/30 bg-primary/5",
                          step.status === "error" &&
                            "border-destructive/40 text-destructive",
                          step.status === "pending" &&
                            "border-border text-muted-foreground"
                        )}
                      >
                        {step.status === "active" ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <Icon className="size-3.5" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{step.label}</p>
                        {step.detail ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {step.detail}
                          </p>
                        ) : null}
                      </div>
                      <StatusPill
                        label={
                          step.status === "done"
                            ? "Ready"
                            : step.status === "error"
                              ? "Failed"
                              : step.status === "active"
                                ? "Working"
                                : "Waiting"
                        }
                        tone={stepTone(step.status)}
                      />
                    </div>
                    {step.status === "active" &&
                    typeof step.progress === "number" ? (
                      <div className="ps-11">
                        <Progress value={step.progress}>
                          <ProgressLabel>Pull progress</ProgressLabel>
                          <ProgressValue />
                        </Progress>
                      </div>
                    ) : null}
                    {step.id === "ollama" && step.status === "error" ? (
                      <div className="flex flex-wrap gap-2 ps-11">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void openOllamaInstallDocs()}
                        >
                          Open install
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={running}
                          onClick={() => void runChecks()}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : null}
                    {step.id !== "ollama" && step.status === "error" ? (
                      <div className="ps-11">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={running}
                          onClick={() => void runChecks()}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={!allDone || running}
              onClick={onReady}
            >
              Open workspace
            </Button>
            {hasError ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {liveMessage}
              </p>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
