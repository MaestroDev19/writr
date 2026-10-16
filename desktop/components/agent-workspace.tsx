"use client"

import { useState } from "react"
import {
  FileUp,
  ClipboardPaste,
  BookOpen,
  Bot,
  Wrench,
  ArrowUpIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type TargetMode = "none" | "file" | "paste"

export function AgentWorkspace({
  agentName,
  agentJob,
  tools = ["search_notes"],
}: {
  agentName: string
  agentJob: string
  tools?: string[]
}) {
  const [mode, setMode] = useState<TargetMode>("none")
  const [paste, setPaste] = useState("")
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")

  const hasTarget =
    (mode === "file" && !!fileLabel) ||
    (mode === "paste" && paste.trim().length > 0)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      <section
        aria-label="Target document"
        className="flex min-h-0 flex-col border-b border-border lg:border-e lg:border-b-0"
      >
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-muted/50 px-5 py-3.5">
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Target document
          </span>
          <Badge
            variant="secondary"
            className="rounded-md bg-muted px-2 py-0.5 tracking-normal normal-case"
          >
            Session only
          </Badge>
          <div className="ms-auto flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "file" ? "default" : "outline"}
              className="rounded-md"
              onClick={() => {
                setMode("file")
                setFileLabel("chapter-03.md")
              }}
            >
              <FileUp data-icon="inline-start" />
              Upload
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "paste" ? "default" : "outline"}
              className="rounded-md"
              onClick={() => setMode("paste")}
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

        <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
          {mode === "none" ? (
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
                  Upload or paste a scene, chapter, or outline. Notes stay in
                  Library. Notion import fills Library later, not this panel.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {mode === "file" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-md border border-border bg-card p-5">
              <Attachment
                state="done"
                size="sm"
                className="max-w-full rounded-md border-border"
              >
                <AttachmentMedia className="rounded-md">
                  <FileUp />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{fileLabel}</AttachmentTitle>
                  <AttachmentDescription>Markdown · attached</AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label="Remove attachment"
                    onClick={() => {
                      setMode("none")
                      setFileLabel(null)
                    }}
                  >
                    <XIcon />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
              <Separator />
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                Preview wires when the document loader is connected. The{" "}
                {agentName} agent will revise or review this file and call local
                tools against your Library.
              </p>
            </div>
          ) : null}

          {mode === "paste" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <Textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="Paste the draft slice for this session…"
                className="min-h-48 flex-1 resize-none rounded-md"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-md"
                  disabled={!paste.trim()}
                >
                  Use as target
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => {
                    setPaste("")
                    setMode("none")
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section
        aria-label={`${agentName} agent`}
        className="flex min-h-0 flex-col bg-muted/40"
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{agentName} agent</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {agentJob}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="rounded-md px-2 py-0.5 tracking-normal normal-case"
          >
            Soon
          </Badge>
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
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

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
          <MessageGroup
            className={cn(
              "min-h-0 flex-1 overflow-y-auto rounded-md border border-dashed border-border bg-background/70 p-4",
              !hasTarget && "opacity-70"
            )}
          >
            {hasTarget ? (
              <>
                <Message align="end">
                  <MessageContent>
                    <Bubble variant="default" align="end" className="rounded-md">
                      <BubbleContent className="rounded-md">
                        When chat is live, your prompts appear here.
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
                <Message align="start">
                  <MessageContent>
                    <Bubble variant="muted" className="rounded-md">
                      <BubbleContent className="rounded-md text-muted-foreground">
                        {agentName} replies and tool traces stream in this
                        thread.
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </>
            ) : (
              <p className="m-auto max-w-[18rem] text-center text-xs text-muted-foreground">
                Attach a target document to enable the agent dock.
              </p>
            )}
          </MessageGroup>

          {/* Prompt Input — AI Elements pattern (Input Group + Attachment) */}
          <form
            className="rounded-md border border-border bg-card"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            {fileLabel ? (
              <div className="flex gap-2 border-b border-border px-4 pt-4">
                <Attachment
                  state="done"
                  size="xs"
                  className="rounded-md border-border"
                >
                  <AttachmentMedia className="rounded-md">
                    <PaperclipIcon />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{fileLabel}</AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label="Detach"
                      onClick={() => {
                        setMode("none")
                        setFileLabel(null)
                      }}
                    >
                      <XIcon />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              </div>
            ) : null}
            <InputGroup className="h-auto border-0 border-transparent bg-transparent">
              <InputGroupTextarea
                disabled={!hasTarget}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  hasTarget
                    ? `Ask ${agentName}…`
                    : `Ask ${agentName}… (attach a target first)`
                }
                className="min-h-16 rounded-md"
              />
              <InputGroupAddon align="block-end" className="gap-1 border-0">
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={!hasTarget}
                  aria-label="Attach"
                  onClick={() => {
                    setMode("file")
                    setFileLabel("chapter-03.md")
                  }}
                >
                  <PaperclipIcon />
                </InputGroupButton>
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="ms-auto rounded-md"
                  disabled={!hasTarget || !prompt.trim()}
                  aria-label={`Run ${agentName}`}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </section>
    </div>
  )
}
