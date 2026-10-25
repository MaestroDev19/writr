"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Laptop,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { StatusPill } from "@/components/status-pill"
import {
  EMBED_MODEL,
  RECOMMENDED_CHAT_MODEL,
  checkOllama,
  ensureLocalDatabase,
  getInstalledChatModel,
  hasEmbedModel,
  isEmbedModel,
  listOllamaModels,
  openOllamaInstallDocs,
  pullEmbedModel,
  pullModel,
} from "@/lib/setup"
import { readChatSettings, writeChatSettings } from "@/lib/chat-settings"
import { cn } from "@/lib/utils"

const WIZARD_STEPS = [
  { id: 0, title: "Welcome", icon: BookOpen },
  { id: 1, title: "Engine", icon: HardDrive },
  { id: 2, title: "Embeddings", icon: Sparkles },
  { id: 3, title: "AI Model", icon: Bot },
  { id: 4, title: "Ready", icon: ShieldCheck },
] as const

export function SetupGate({
  onReady,
  onSignOut,
}: {
  onReady: () => void
  onSignOut: () => void
}) {
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [checking, setChecking] = useState(false)
  const [copiedCors, setCopiedCors] = useState(false)

  // Step 1: Ollama
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [ollamaError, setOllamaError] = useState<string | null>(null)

  // Step 2: Embeddings
  const [embedOk, setEmbedOk] = useState<boolean | null>(null)
  const [pullingEmbed, setPullingEmbed] = useState(false)
  const [embedProgress, setEmbedProgress] = useState(0)
  const [embedStatus, setEmbedStatus] = useState("")

  // Step 3: Chat Model
  const [installedModels, setInstalledModels] = useState<string[]>([])
  const [selectedChatModel, setSelectedChatModel] = useState<string>(RECOMMENDED_CHAT_MODEL)
  const [pullingModel, setPullingModel] = useState(false)
  const [modelProgress, setModelProgress] = useState(0)
  const [modelStatus, setModelStatus] = useState("")

  // Step 4: Database & Final
  const [dbOk, setDbOk] = useState<boolean | null>(null)

  // Diagnostics check on Ollama
  const verifyOllama = useCallback(async () => {
    setChecking(true)
    setOllamaError(null)
    const res = await checkOllama()
    if (res.ok) {
      setOllamaOk(true)
      setOllamaError(null)
      // Populate installed models
      const models = await listOllamaModels()
      if (models) {
        const chats = models.filter((m) => !isEmbedModel(m))
        setInstalledModels(chats)
        const currentSaved = readChatSettings().model
        if (currentSaved && chats.includes(currentSaved)) {
          setSelectedChatModel(currentSaved)
        } else if (chats.length > 0) {
          setSelectedChatModel(chats[0])
        }
      }
    } else {
      setOllamaOk(false)
      if (res.error === "cors_blocked") {
        setOllamaError("CORS origin blocked. Set OLLAMA_ORIGINS=* and restart Ollama.")
      } else {
        setOllamaError("Ollama is not running or unreachable on port 11434.")
      }
    }
    setChecking(false)
  }, [])

  // Diagnostics check on Embeddings
  const verifyEmbeddings = useCallback(async () => {
    setChecking(true)
    const ok = await hasEmbedModel()
    setEmbedOk(ok)
    setChecking(false)
  }, [])

  // Initial diagnostics
  useEffect(() => {
    void verifyOllama()
    void verifyEmbeddings()
  }, [verifyOllama, verifyEmbeddings])

  // Download embed model
  const handleDownloadEmbed = async () => {
    setPullingEmbed(true)
    setEmbedProgress(0)
    setEmbedStatus("Starting download...")
    try {
      await pullEmbedModel(({ percent, status }) => {
        setEmbedProgress(percent)
        setEmbedStatus(status)
      })
      setEmbedOk(true)
      toast.success(`Indexed "${EMBED_MODEL}" for local vectors.`)
    } catch (err: unknown) {
      console.error(err)
      toast.error(`Failed to pull ${EMBED_MODEL}. Check Ollama connectivity.`)
    } finally {
      setPullingEmbed(false)
    }
  }

  // Download chat model
  const handleDownloadModel = async (modelName: string) => {
    setPullingModel(true)
    setModelProgress(0)
    setModelStatus("Starting download...")
    try {
      await pullModel(modelName, ({ percent, status }) => {
        setModelProgress(percent)
        setModelStatus(status)
      })
      setInstalledModels((prev) => (prev.includes(modelName) ? prev : [...prev, modelName]))
      setSelectedChatModel(modelName)
      const current = readChatSettings()
      writeChatSettings({ ...current, model: modelName })
      toast.success(`Model "${modelName}" is ready for agents.`)
    } catch (err: unknown) {
      console.error(err)
      toast.error(`Could not download ${modelName}.`)
    } finally {
      setPullingModel(false)
    }
  }

  // Step 4 init
  const handleInitWorkspace = async () => {
    setChecking(true)
    const res = await ensureLocalDatabase()
    setDbOk(res.ok)
    const current = readChatSettings()
    writeChatSettings({ ...current, model: selectedChatModel })
    setChecking(false)
    if (res.ok) {
      onReady()
    } else {
      toast.error(res.error || "Failed to initialize local SQLite database.")
    }
  }

  const copyCorsCommand = () => {
    const cmd = `$env:OLLAMA_ORIGINS="*"; ollama serve`
    void navigator.clipboard.writeText(cmd)
    setCopiedCors(true)
    toast.success("Copied PowerShell command to clipboard.")
    setTimeout(() => setCopiedCors(false), 2000)
  }

  return (
    <div dir="ltr" className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-background">
      {/* Top Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            W
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight">
            Writr Installation Wizard
          </span>
          <Badge variant="secondary" className="rounded-md font-mono text-[10px] uppercase">
            Step {currentStep + 1} of 5
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-md text-xs text-muted-foreground hover:text-foreground"
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </div>
      </header>

      {/* Stepper Navigation Bar */}
      <nav
        aria-label="Installation Progress"
        className="flex shrink-0 border-b border-border bg-muted/30 px-4 py-2 sm:px-8"
      >
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          {WIZARD_STEPS.map((step, idx) => {
            const isDone = currentStep > step.id
            const isCurrent = currentStep === step.id
            const Icon = step.icon
            return (
              <div key={step.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={step.id > currentStep}
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                    isCurrent && "bg-primary text-primary-foreground font-medium",
                    isDone && "text-foreground hover:bg-muted font-normal cursor-pointer",
                    !isDone && !isCurrent && "text-muted-foreground opacity-50 cursor-not-allowed"
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-3.5 text-primary" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
                {idx < WIZARD_STEPS.length - 1 ? (
                  <div className="h-px w-3 bg-border sm:w-6" aria-hidden />
                ) : null}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Center Wizard Body */}
      <ScrollArea className="h-full w-full flex-1">
        <main className="mx-auto flex w-full max-w-2xl flex-col p-5 sm:p-8">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-xs sm:p-8">
            {/* STEP 0: WELCOME */}
            {currentStep === 0 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="size-6" />
                  </div>
                  <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                    Welcome to Writr
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    A private, local-first writing studio for authors and novelists. Your manuscripts, character bibles, and local AI continuity models run 100% on this machine.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-4">
                    <ShieldCheck className="size-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">Zero Cloud Telemetry</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Drafts and notes never leave your computer or train third-party models.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-4">
                    <Database className="size-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">SQLite Vector Store</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Native embedded vectors provide instant grounded search and continuity.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-4">
                    <Bot className="size-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">Local AI Agents</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Write, Review, and Research assistants execute locally through Ollama.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <p className="text-xs text-muted-foreground">
                    Wizard configures engine, embeddings, and chat LLM.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-md gap-1.5"
                    onClick={() => setCurrentStep(1)}
                  >
                    Start Setup
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 1: OLLAMA ENGINE */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <HardDrive className="size-6" />
                    </div>
                    <StatusPill
                      label={
                        ollamaOk === true
                          ? "Engine Connected"
                          : ollamaOk === false
                            ? "Not Reachable"
                            : "Checking..."
                      }
                      tone={ollamaOk === true ? "ok" : ollamaOk === false ? "error" : "busy"}
                    />
                  </div>
                  <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                    Connect Local Inference Engine
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Writr uses <span className="font-medium text-foreground">Ollama</span> on port 11434 to run local neural networks completely offline.
                  </p>
                </div>

                {ollamaOk === true ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CheckCircle2 className="size-4 text-primary" />
                      Local engine connected at 127.0.0.1:11434
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ollama is responsive and ready to host embedding and text generation models.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-sm font-medium text-destructive">
                      {ollamaError || "Could not connect to Ollama service."}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Make sure Ollama is installed and running on your system. If you see a CORS 403 error on desktop, restart Ollama with OLLAMA_ORIGINS=*.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-md gap-1.5"
                        onClick={() => void openOllamaInstallDocs()}
                      >
                        <ExternalLink className="size-3.5" />
                        Download Ollama
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-md gap-1.5"
                        onClick={copyCorsCommand}
                      >
                        {copiedCors ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        Copy CORS Fix Command
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-md gap-1.5"
                        disabled={checking}
                        onClick={() => void verifyOllama()}
                      >
                        <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
                        Retry Connection
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md gap-1.5"
                    onClick={() => setCurrentStep(0)}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-md gap-1.5"
                    disabled={ollamaOk !== true}
                    onClick={() => setCurrentStep(2)}
                  >
                    Continue to Embeddings
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: EMBEDDINGS MODEL */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-6" />
                    </div>
                    <StatusPill
                      label={
                        embedOk === true
                          ? "Installed"
                          : pullingEmbed
                            ? "Downloading"
                            : "Missing"
                      }
                      tone={embedOk === true ? "ok" : pullingEmbed ? "busy" : "muted"}
                    />
                  </div>
                  <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                    Neural Embedding Model
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Embeddings convert character sheets, world building notes, and manuscript slices into vector coordinates for intelligent agent retrieval.
                  </p>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {EMBED_MODEL}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      ~274 MB
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Optimized high-dimensional semantic vector index designed specifically for literary context retrieval.
                  </p>

                  {embedOk ? (
                    <div className="flex items-center gap-2 pt-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="size-4" />
                      Model verified and ready in local Ollama storage.
                    </div>
                  ) : pullingEmbed ? (
                    <div className="flex flex-col gap-2 pt-2">
                      <Progress value={embedProgress}>
                        <ProgressLabel>{embedStatus || "Downloading..."}</ProgressLabel>
                        <ProgressValue />
                      </Progress>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-1 w-fit rounded-md gap-1.5"
                      onClick={() => void handleDownloadEmbed()}
                    >
                      <Sparkles className="size-3.5" />
                      Download {EMBED_MODEL}
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md gap-1.5"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-md gap-1.5"
                    disabled={embedOk !== true}
                    onClick={() => setCurrentStep(3)}
                  >
                    Continue to AI Model
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: WRITER INTELLIGENCE (CHAT LLM) */}
            {currentStep === 3 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="size-6" />
                    </div>
                    <StatusPill
                      label={
                        installedModels.length > 0
                          ? `Ready · ${selectedChatModel}`
                          : pullingModel
                            ? "Downloading"
                            : "Needs Model"
                      }
                      tone={installedModels.length > 0 ? "ok" : pullingModel ? "busy" : "busy"}
                    />
                  </div>
                  <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                    Choose Your Writing Assistant
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Select the local generative LLM used by Write, Review, and Research agents for chapter drafts and continuity critique.
                  </p>
                </div>

                {/* Recommended Model */}
                <div
                  className={cn(
                    "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
                    selectedChatModel === RECOMMENDED_CHAT_MODEL
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{RECOMMENDED_CHAT_MODEL}</span>
                      <Badge className="bg-primary text-primary-foreground font-mono text-[10px]">
                        Recommended
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">1.3 GB download · Fast on 4–8 GB RAM</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Compact, high-speed model with excellent prompt adherence and minimal RAM footprint. Ideal for laptops and desktop workstations.
                  </p>

                  {installedModels.includes(RECOMMENDED_CHAT_MODEL) ? (
                    <div className="flex items-center gap-2 pt-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="size-4" />
                      Installed locally.
                    </div>
                  ) : pullingModel && selectedChatModel === RECOMMENDED_CHAT_MODEL ? (
                    <div className="flex flex-col gap-2 pt-2">
                      <Progress value={modelProgress}>
                        <ProgressLabel>{modelStatus || "Downloading..."}</ProgressLabel>
                        <ProgressValue />
                      </Progress>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-1 w-fit rounded-md gap-1.5"
                      onClick={() => void handleDownloadModel(RECOMMENDED_CHAT_MODEL)}
                    >
                      <Bot className="size-3.5" />
                      Download {RECOMMENDED_CHAT_MODEL} (1.3 GB)
                    </Button>
                  )}
                </div>

                {/* Other Installed Models */}
                {installedModels.filter((m) => m !== RECOMMENDED_CHAT_MODEL).length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Other installed local models detected:
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {installedModels
                        .filter((m) => m !== RECOMMENDED_CHAT_MODEL)
                        .map((name) => {
                          const active = selectedChatModel === name
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSelectedChatModel(name)
                                const cur = readChatSettings()
                                writeChatSettings({ ...cur, model: name })
                              }}
                              className={cn(
                                "flex cursor-pointer items-center justify-between rounded-md border p-3 text-start transition-colors",
                                active
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border hover:bg-muted/50"
                              )}
                            >
                              <span className="font-mono text-xs font-medium">{name}</span>
                              {active ? <Check className="size-3.5 text-primary" /> : null}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md gap-1.5"
                    onClick={() => setCurrentStep(2)}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-md gap-1.5"
                    disabled={!selectedChatModel || installedModels.length === 0}
                    onClick={() => setCurrentStep(4)}
                  >
                    Continue to Final Prep
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: READY */}
            {currentStep === 4 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-6" />
                  </div>
                  <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                    Your Machine is Ready
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    All components are verified. Your workspace is configured for local-first drafting with private AI agents.
                  </p>
                </div>

                {/* Configuration Summary Card */}
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-muted/20 text-xs">
                  <div className="flex items-center justify-between p-3">
                    <span className="text-muted-foreground">Inference Engine</span>
                    <span className="font-medium text-foreground">Ollama · 127.0.0.1:11434</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-muted-foreground">Neural Embedding</span>
                    <span className="font-mono font-medium text-foreground">{EMBED_MODEL}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-muted-foreground">Active Agent Model</span>
                    <span className="font-mono font-medium text-foreground">{selectedChatModel}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-muted-foreground">Storage Engine</span>
                    <span className="font-medium text-foreground">Local SQLite Vector Database</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md gap-1.5"
                    onClick={() => setCurrentStep(3)}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className="rounded-md gap-2"
                    disabled={checking}
                    onClick={() => void handleInitWorkspace()}
                  >
                    {checking ? (
                      <Spinner className="size-4" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    Open Workspace
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </ScrollArea>
    </div>
  )
}
