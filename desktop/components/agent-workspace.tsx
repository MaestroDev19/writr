"use client"

import { useState, useCallback } from "react"
import { useForm, useWatch } from "react-hook-form"
import {
  FileUp,
  ClipboardPaste,
  BookOpen,
  Bot,
  Wrench,
  ArrowUpIcon,
  PaperclipIcon,
  XIcon,
  FileText,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import {
  Bubble,
  BubbleContent,
} from "@/components/ui/bubble"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Message,
  MessageContent,
  MessageGroup,
} from "@/components/ui/message"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  fileHandler,
  readDocumentFromPath,
  acceptText,
  TARGET_FILE_ACCEPT,
  TARGET_FILE_TYPES_LABEL,
} from "@/lib/document-loader"
import { isTauri } from "@/lib/tauri"
import { buildAgent } from "@/lib/agents/build"
import { createModel } from "@/lib/model"
import { readChatSettings } from "@/lib/chat-settings"
import type { AgentId } from "@/lib/agents/prompts"
import { getCurrentUserId } from "@/lib/supabase"
import { Reasoning } from "@/components/ui/reasoning"
import { Sources, type SourceReference } from "@/components/ui/sources"
import { Tool, type ToolCallData } from "@/components/ui/tool"
import { MarkdownCleaner } from "@/components/ui/markdown-cleaner"
import { parseAgentOutput } from "@/lib/markdown-cleaner"

type TargetMode = "none" | "file" | "paste"

interface TargetDocument {
  title: string
  content: string
  sourceType: "file" | "paste"
  path?: string
}

interface ChatTurnMessage {
  id: string
  role: "user" | "assistant"
  content: string
  targetTitle?: string
  status?: "pending" | "done" | "error"
  reasoning?: string | null
  sources?: SourceReference[]
  toolCall?: ToolCallData | null
}

interface PromptFormValues {
  prompt: string
}

interface PasteFormValues {
  pasteContent: string
}

const AGENT_PROMPT_SUGGESTIONS: Record<string, string[]> = {
  write: [
    "Revise this draft slice for tighter tension and pacing",
    "Continue the scene following library notes",
    "Rewrite dialogue with natural subtext and realism",
  ],
  critique: [
    "Critique draft continuity against library notes",
    "Evaluate emotional stakes and character arcs",
    "Audit tone consistency and identify weak pacing",
  ],
  "story-bible": [
    "Summarize character traits and timeline from notes",
    "Audit world-building canon and rules",
  ],
  research: [
    "Check historical and setting accuracy for this scene",
    "Find sensory details to enrich the chapter atmosphere",
  ],
  "revision-planner": [
    "Create a step-by-step revision checklist for this draft",
    "Break down pacing adjustments scene by scene",
  ],
}

export function AgentWorkspace({
  agentName,
  agentJob,
  tools = ["search_notes"],
}: {
  agentName: string
  agentJob: string
  tools?: string[]
}) {
  const [targetDoc, setTargetDoc] = useState<TargetDocument | null>(null)
  const [mode, setMode] = useState<TargetMode>("none")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // React Hook Form for Prompt Bar
  const {
    register: registerPrompt,
    handleSubmit: handlePromptSubmit,
    reset: resetPrompt,
    control: promptControl,
  } = useForm<PromptFormValues>({
    defaultValues: { prompt: "" },
  })

  // React Hook Form for Paste Mode
  const {
    register: registerPaste,
    handleSubmit: handlePasteSubmit,
    reset: resetPaste,
    control: pasteControl,
  } = useForm<PasteFormValues>({
    defaultValues: { pasteContent: "" },
  })

  // Watch field values reactively with useWatch
  const watchedPrompt = useWatch({ control: promptControl, name: "prompt" }) ?? ""
  const watchedPaste = useWatch({ control: pasteControl, name: "pasteContent" }) ?? ""

  // Derived state
  const hasTarget = !!targetDoc && targetDoc.content.trim().length > 0
  const charCount = targetDoc ? targetDoc.content.length : 0
  const wordCount = targetDoc
    ? (targetDoc.content.trim().match(/\S+/g)?.length ?? 0)
    : 0
  const pasteWordCount = watchedPaste.trim()
    ? (watchedPaste.trim().match(/\S+/g)?.length ?? 0)
    : 0
  const isPromptEmpty = !watchedPrompt.trim()

  // Native desktop or browser file picker using document-loader helpers
  const handleUploadFile = useCallback(async () => {
    setLoading(true)
    try {
      if (isTauri()) {
        const { open } = await import("@tauri-apps/plugin-dialog")
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: "Draft Documents",
              extensions: ["txt", "md", "docx", "pdf"],
            },
            { name: "All Files", extensions: ["*"] },
          ],
        })
        if (!selected || Array.isArray(selected)) {
          setLoading(false)
          return
        }

        const path = selected
        const filename = path.replace(/\\/g, "/").split("/").pop() || path
        const text = await readDocumentFromPath(path)
        setTargetDoc({
          title: filename,
          content: text,
          sourceType: "file",
          path,
        })
        setMode("file")
        toast.success(`Attached "${filename}" as target draft.`)
      } else {
        // Fallback for browser / webview environments
        const input = document.createElement("input")
        input.type = "file"
        input.accept = TARGET_FILE_ACCEPT
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return
          setLoading(true)
          try {
            const text = await fileHandler(file)
            setTargetDoc({
              title: file.name,
              content: text,
              sourceType: "file",
            })
            setMode("file")
            toast.success(`Attached "${file.name}" as target draft.`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            toast.error(msg || "Could not read file.")
          } finally {
            setLoading(false)
          }
        }
        input.click()
      }
    } catch (err) {
      console.error("Target document upload failed:", err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || "Failed to load document.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Drag and drop file ingestion
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const filePath = (file as unknown as { path?: string }).path
      let text = ""
      if (isTauri() && filePath) {
        text = await readDocumentFromPath(filePath)
      } else {
        text = await fileHandler(file)
      }
      setTargetDoc({
        title: file.name,
        content: text,
        sourceType: "file",
        path: filePath,
      })
      setMode("file")
      toast.success(`Attached "${file.name}" as target draft.`)
    } catch (err) {
      console.error("Drop load failed:", err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || "Could not read dropped file.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Form submit handler for Paste Mode
  const onPasteSubmit = handlePasteSubmit((data) => {
    try {
      const clean = acceptText(data.pasteContent)
      if (!clean) {
        toast.error("Please paste some text first.")
        return
      }
      const words = clean.trim().match(/\S+/g)?.length ?? 0
      const title = `Pasted Draft (${words.toLocaleString()} words)`
      setTargetDoc({
        title,
        content: clean,
        sourceType: "paste",
      })
      toast.success("Attached pasted text as target draft.")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || "Invalid text slice.")
    }
  })

  const [chatMessages, setChatMessages] = useState<ChatTurnMessage[]>([])
  const [isExecuting, setIsExecuting] = useState(false)

  // Resolve agentId from agentName
  const resolveAgentId = (name: string): AgentId => {
    const lower = name.toLowerCase().trim()
    if (lower === "critique" || lower === "review" || lower === "analyse") return "critique"
    if (lower === "story-bible" || lower === "story bible" || lower === "canon") return "story-bible"
    if (lower === "research") return "research"
    if (lower === "revision-planner" || lower === "revision planner" || lower === "plan") return "revision-planner"
    return "write"
  }
  const agentId = resolveAgentId(agentName)

  // Form submit handler for Prompt Bar
  const onPromptSubmit = handlePromptSubmit(async (data) => {
    const trimmed = data.prompt.trim()
    if (!trimmed || isExecuting) return

    const userMessageId = crypto.randomUUID()
    const assistantMessageId = crypto.randomUUID()

    setChatMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: trimmed,
        targetTitle: hasTarget && targetDoc ? targetDoc.title : undefined,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "pending",
      },
    ])

    resetPrompt()
    setIsExecuting(true)

    try {
      const settings = readChatSettings()
      if (!settings.model) {
        toast.error("Please pick a chat model in the header settings first.")
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                ...msg,
                content: "No chat model chosen. Please select a local model (such as qwen3.5:4b) from Chat Settings in the top bar.",
                status: "error",
              }
              : msg
          )
        )
        return
      }

      const model = createModel(settings, agentId)
      const agent = buildAgent({ agent: agentId, model })

      let instruction = trimmed
      if (hasTarget && targetDoc?.content) {
        instruction = `[Target Document Attached: "${targetDoc.title}"]\n${targetDoc.content}\n\n[Instruction]:\n${trimmed}`
      }

      const ownerId = getCurrentUserId() || "anonymous"

      const response = await agent.invoke(
        {
          messages: [{ role: "user", content: instruction }],
        },
        {
          recursionLimit: 12,
          context: { userId: ownerId },
        }
      )

      const messages = response.messages || []
      let finalContent = "Turn complete."
      let reasoningText: string | null = null
      let toolData: ToolCallData | null = null
      const extractedSources: SourceReference[] = []

      for (const m of messages) {
        // Inspect tool calls from AIMessage
        const aiToolCalls = (m as any).tool_calls
        if (Array.isArray(aiToolCalls) && aiToolCalls.length > 0) {
          const tc = aiToolCalls[0]
          toolData = {
            name: tc.name === "search_project" ? "search_notes" : tc.name,
            args: tc.args,
            status: "completed",
          }
        }

        // Inspect ToolMessage search outputs
        const isTool =
          (m as any).name === "search_project" ||
          (m as any)._getType?.() === "tool" ||
          (m as any).role === "tool"
        if (isTool && (m as any).content) {
          const rawToolContent =
            typeof (m as any).content === "string"
              ? (m as any).content
              : JSON.stringify((m as any).content)
          if (
            rawToolContent &&
            !rawToolContent.includes("No matching notes found.")
          ) {
            const blocks = rawToolContent.split(/\[Source:\s*([^\]]+)\]/g)
            for (let i = 1; i < blocks.length; i += 2) {
              const header = blocks[i].trim()
              const text = (blocks[i + 1] || "").trim()
              extractedSources.push({
                title: header,
                content: text.slice(0, 300),
              })
            }
          }
        }
      }

      const lastMessage = messages[messages.length - 1] as any
      if (lastMessage?.content) {
        const rawContent =
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content)
        const parsed = parseAgentOutput(rawContent)
        reasoningText = parsed.reasoning
        finalContent = parsed.content
      }

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: finalContent,
                reasoning: reasoningText,
                sources:
                  extractedSources.length > 0 ? extractedSources : undefined,
                toolCall: toolData,
                status: "done",
              }
            : msg
        )
      )
    } catch (err: any) {
      console.error("Agent execution error:", err)
      const errorMsg = err?.message || "Failed to execute agent turn. Make sure Ollama is running."
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${errorMsg}`, status: "error" }
            : msg
        )
      )
      toast.error(errorMsg)
    } finally {
      setIsExecuting(false)
    }
  })

  const handleClearTarget = useCallback(() => {
    setTargetDoc(null)
    setMode("none")
    resetPaste({ pasteContent: "" })
  }, [resetPaste])

  const handleCopyContent = useCallback(async () => {
    if (!targetDoc?.content) return
    try {
      await navigator.clipboard.writeText(targetDoc.content)
      setCopied(true)
      toast.success("Copied draft text to clipboard.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy text.")
    }
  }, [targetDoc?.content])

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const handleCopyMessage = useCallback(async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMsgId(msgId)
      toast.success("Copied message to clipboard.")
      setTimeout(() => setCopiedMsgId(null), 2000)
    } catch {
      toast.error("Could not copy message.")
    }
  }, [])

  const handleApplyToTarget = useCallback(
    (newText: string, applyMode: "replace" | "append") => {
      if (!targetDoc) return
      const updatedContent =
        applyMode === "replace"
          ? newText
          : `${targetDoc.content.trim()}\n\n${newText.trim()}`
      setTargetDoc((prev) => (prev ? { ...prev, content: updatedContent } : null))
      toast.success(
        applyMode === "replace"
          ? "Target draft replaced with agent revision."
          : "Agent revision appended to target draft."
      )
    },
    [targetDoc]
  )

  const handleResetChat = useCallback(() => {
    setChatMessages([])
    toast.info("Session dock reset.")
  }, [])

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:grid-rows-[minmax(0,1fr)]">
      <section
        aria-label="Target document"
        className="flex h-full min-h-0 flex-col overflow-hidden border-b border-border lg:border-b-0 lg:border-e"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-muted/50 px-5 py-3.5">
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Target document
          </span>
          {hasTarget ? (
            <Badge
              variant="secondary"
              className="rounded-md bg-muted px-2 py-0.5 tracking-normal normal-case"
            >
              {wordCount.toLocaleString()} words · {(charCount / 1024).toFixed(1)} KB
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="rounded-md bg-muted px-2 py-0.5 tracking-normal normal-case"
            >
              Session only
            </Badge>
          )}
          <div className="ms-auto flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "file" && hasTarget ? "default" : "outline"}
              className="rounded-md"
              disabled={loading}
              onClick={() => void handleUploadFile()}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FileUp data-icon="inline-start" />
              )}
              {hasTarget && mode === "file" ? "Change file" : "Upload"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "paste" ? "default" : "outline"}
              className="rounded-md"
              disabled={loading}
              onClick={() => {
                setMode("paste")
                if (!watchedPaste && targetDoc?.sourceType === "paste") {
                  resetPaste({ pasteContent: targetDoc.content })
                }
              }}
            >
              <ClipboardPaste data-icon="inline-start" />
              Paste
            </Button>
            <ButtonLink
              href="/library"
              size="sm"
              variant="outline"
              className="rounded-md"
            >
              <BookOpen data-icon="inline-start" />
              Library
            </ButtonLink>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8">
              <Spinner className="size-8 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Reading and parsing target document…
              </p>
              <p className="text-xs text-muted-foreground">
                Supported formats: {TARGET_FILE_TYPES_LABEL}
              </p>
            </div>
          ) : hasTarget && targetDoc ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 sm:p-6">
              <Attachment
                state="done"
                size="sm"
                className="max-w-full rounded-md border-border bg-card shadow-xs"
              >
                <AttachmentMedia className="rounded-md bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle className="truncate font-medium">
                    {targetDoc.title}
                  </AttachmentTitle>
                  <AttachmentDescription>
                    {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars ·{" "}
                    {targetDoc.sourceType === "file"
                      ? targetDoc.path
                        ? targetDoc.path
                        : "Local file"
                      : "Clipboard slice"}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label="Copy draft text"
                    title="Copy text"
                    onClick={() => void handleCopyContent()}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </AttachmentAction>
                  <AttachmentAction
                    aria-label="Detach target document"
                    title="Detach document"
                    onClick={handleClearTarget}
                  >
                    <XIcon className="size-3.5" />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                  <span className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Draft slice preview
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Target context for {agentName}
                  </span>
                </div>
                <ScrollArea className="h-full w-full flex-1">
                  <div className="max-w-prose whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-foreground select-text sm:p-5">
                    {targetDoc.content}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : mode === "paste" ? (
            <form
              onSubmit={onPasteSubmit}
              className="flex min-h-0 flex-1 flex-col gap-3 p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Paste slice of your draft
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {pasteWordCount.toLocaleString()} words
                </span>
              </div>
              <Textarea
                {...registerPaste("pasteContent")}
                placeholder="Paste the chapter, scene, or outline for this session…"
                className="min-h-56 flex-1 resize-none rounded-md font-sans text-sm leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-md"
                  disabled={!watchedPaste.trim()}
                >
                  Use as target
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => {
                    resetPaste({ pasteContent: "" })
                    if (!hasTarget) setMode("none")
                  }}
                >
                  Clear
                </Button>
              </div>
            </form>
          ) : (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col p-5 transition-colors sm:p-6",
                isDragging && "bg-muted/40 ring-2 ring-primary ring-inset"
              )}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(false)
              }}
              onDrop={(e) => void handleDrop(e)}
            >
              <Empty className="flex-1 justify-center rounded-md border border-dashed border-border bg-muted/20 p-8">
                <EmptyHeader>
                  <EmptyMedia
                    variant="icon"
                    className="rounded-md bg-primary text-primary-foreground"
                  >
                    <FileUp />
                  </EmptyMedia>
                  <EmptyTitle className="font-heading tracking-tight normal-case">
                    Attach the draft this agent works on
                  </EmptyTitle>
                  <EmptyDescription>
                    Upload Word (.docx), Markdown (.md), Text (.txt), or PDF. Or drag & drop here.
                    The {agentName} agent uses this slice as primary subject context and pulls continuity from your Library.
                  </EmptyDescription>
                </EmptyHeader>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleUploadFile()}
                  >
                    <FileUp data-icon="inline-start" />
                    Choose file
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMode("paste")}
                  >
                    <ClipboardPaste data-icon="inline-start" />
                    Paste slice
                  </Button>
                </div>
              </Empty>
            </div>
          )}
        </div>
      </section>

      <section
        aria-label={`${agentName} agent`}
        className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/40"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{agentName} agent</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {agentJob}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {chatMessages.length > 0 && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-7 gap-1 px-2 text-muted-foreground hover:text-foreground"
                onClick={handleResetChat}
                title="Reset session conversation"
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            )}
            <Badge
              variant="secondary"
              className="rounded-md px-2 py-0.5 tracking-normal normal-case"
            >
              Session dock
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <Wrench className="size-3" aria-hidden />
            Tools
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <Badge
                key={tool}
                variant="outline"
                className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] font-normal tracking-normal normal-case"
              >
                {tool}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] font-normal tracking-normal normal-case text-muted-foreground"
            >
              mcp/* later
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Continuity comes from Library via{" "}
            <code className="text-[11px]">search_notes</code>. The agent never
            invents the target file.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
          <ScrollArea className="h-full w-full min-h-0 flex-1 rounded-xl border border-dashed border-border bg-background/70">
            <MessageGroup className="min-h-full p-4">
            {chatMessages.length === 0 ? (
              hasTarget && targetDoc ? (
                <div className="flex flex-col gap-3">
                  <Message align="end">
                    <MessageContent>
                      <Bubble variant="default" align="end" className="rounded-xl">
                        <BubbleContent className="rounded-xl">
                          Target attached: {targetDoc.title} ({wordCount.toLocaleString()} words). Ready for your instructions.
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                  <Message align="start">
                    <MessageContent>
                      <Bubble variant="muted" className="rounded-xl">
                        <BubbleContent className="rounded-xl text-muted-foreground">
                          {agentName} is ready. Ask me to revise, critique, or expand this draft slice using your Library evidence.
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                  <div className="flex flex-col items-center gap-1.5 pt-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Suggested instructions:
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {(AGENT_PROMPT_SUGGESTIONS[agentId] || AGENT_PROMPT_SUGGESTIONS.write).map((sugg) => (
                        <button
                          key={sugg}
                          type="button"
                          onClick={() => resetPrompt({ prompt: sugg })}
                          className="cursor-pointer rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground"
                        >
                          {sugg}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="m-auto flex w-full max-w-lg flex-col items-center justify-center gap-3 p-4 text-center">
                  <div className="flex w-full justify-center">
                    <Bubble variant="muted" className="mx-auto rounded-xl">
                      <BubbleContent className="rounded-xl text-center text-muted-foreground">
                        {agentName} is ready. Chat directly below, or attach a target draft on the left anytime for in-depth revisions.
                      </BubbleContent>
                    </Bubble>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="mt-1 rounded-md"
                    onClick={() => void handleUploadFile()}
                  >
                    <FileUp data-icon="inline-start" />
                    Attach draft
                  </Button>
                  <div className="flex flex-col items-center gap-1.5 pt-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Quick prompts:
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {(AGENT_PROMPT_SUGGESTIONS[agentId] || AGENT_PROMPT_SUGGESTIONS.write).map((sugg) => (
                        <button
                          key={sugg}
                          type="button"
                          onClick={() => resetPrompt({ prompt: sugg })}
                          className="cursor-pointer rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground"
                        >
                          {sugg}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            ) : (
              chatMessages.map((msg) => (
                <Message
                  key={msg.id}
                  align={msg.role === "user" ? "end" : "start"}
                  className="w-full"
                >
                  <MessageContent>
                    {msg.role === "user" ? (
                      <div className="flex flex-col items-end gap-1.5">
                        {msg.targetTitle ? (
                          <span className="flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                            <PaperclipIcon className="size-2.5" />
                            {msg.targetTitle}
                          </span>
                        ) : null}
                        <Bubble variant="default" align="end" className="rounded-2xl">
                          <BubbleContent className="rounded-2xl whitespace-pre-wrap">
                            {msg.content}
                          </BubbleContent>
                        </Bubble>
                      </div>
                    ) : (
                      <div className="flex w-full flex-col items-start gap-2">
                        {/* 1. Reasoning AI Element (Trace) */}
                        {msg.reasoning || msg.status === "pending" ? (
                          <Reasoning
                            reasoning={msg.reasoning ?? ""}
                            isRunning={msg.status === "pending"}
                            title={
                              msg.status === "pending"
                                ? `${agentName} is analyzing & searching library notes…`
                                : "Reasoning process"
                            }
                          />
                        ) : null}

                        {/* 2. Tool Execution AI Element */}
                        {msg.toolCall ? <Tool tool={msg.toolCall} /> : null}

                        {/* 3. Library Sources Cited AI Element */}
                        {msg.sources && msg.sources.length > 0 ? (
                          <Sources sources={msg.sources} />
                        ) : null}

                        {/* 4. Response Content with MarkdownCleaner */}
                        {msg.status === "pending" ? (
                          <Bubble variant="muted" className="w-full rounded-2xl">
                            <BubbleContent className="rounded-2xl leading-relaxed">
                              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Spinner className="size-3.5 text-primary" />
                                Synthesizing {agentName.toLowerCase()} output with continuity…
                              </span>
                            </BubbleContent>
                          </Bubble>
                        ) : msg.status === "error" ? (
                          <Bubble variant="destructive" className="w-full rounded-2xl">
                            <BubbleContent className="rounded-2xl leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </BubbleContent>
                          </Bubble>
                        ) : (
                          <MarkdownCleaner
                            content={msg.content}
                            onApplyToDraft={handleApplyToTarget}
                            hasTargetDraft={hasTarget && !!targetDoc}
                          />
                        )}
                      </div>
                    )}
                  </MessageContent>
                </Message>
              ))
            )}
          </MessageGroup>
        </ScrollArea>

          {/* Prompt Input — AI Elements pattern (React Hook Form + Input Group + Attachment) */}
          <form
            className="shrink-0 rounded-xl border border-border bg-card shadow-xs"
            onSubmit={onPromptSubmit}
          >
            {hasTarget && targetDoc ? (
              <div className="flex gap-2 border-b border-border px-4 pt-3 pb-2">
                <Attachment
                  state="done"
                  size="xs"
                  className="rounded-md border-border"
                >
                  <AttachmentMedia className="rounded-md">
                    <PaperclipIcon />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle className="max-w-[200px] truncate">
                      {targetDoc.title}
                    </AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label="Detach"
                      onClick={handleClearTarget}
                    >
                      <XIcon />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              </div>
            ) : null}
            <InputGroup className="h-auto border-0 border-transparent bg-transparent">
              <InputGroupTextarea
                {...registerPrompt("prompt")}
                placeholder={
                  hasTarget
                    ? `Ask ${agentName} to revise, review, or expand…`
                    : `Ask ${agentName}…`
                }
                className="min-h-16 rounded-md"
              />
              <InputGroupAddon align="block-end" className="gap-1 border-0">
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Attach target file"
                  title="Attach target file"
                  onClick={() => void handleUploadFile()}
                >
                  <PaperclipIcon />
                </InputGroupButton>
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="ms-auto rounded-md"
                  disabled={isPromptEmpty || isExecuting}
                  aria-label={`Run ${agentName}`}
                >
                  {isExecuting ? <Spinner className="size-3.5" /> : <ArrowUpIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </section>
    </div>
  )
}
