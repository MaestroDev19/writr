"use client"

/**
 * Dev-only gallery to review authenticated shells without a session.
 * Remove after UI pass. Guarded: only renders when NODE_ENV !== production.
 */
import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { AgentWorkspace } from "@/components/agent-workspace"
import { AgentComingSoon } from "@/components/agent-coming-soon"
import { LibraryShell } from "@/components/library/library-shell"
import { SettingsPanels } from "@/components/settings/settings-panels"
import { SetupGate } from "@/components/setup/setup-gate"
import { useChatSettings } from "@/components/chat-settings-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import { agentNav } from "@/lib/nav"
import {
  FileSearch,
  Kanban,
  Microscope,
  Send,
} from "lucide-react"
import type { CSSProperties } from "react"

type Pane =
  | "setup"
  | "home"
  | "library"
  | "write"
  | "review"
  | "plan"
  | "analyse"
  | "research"
  | "publish"
  | "settings"

const panes: { id: Pane; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "home", label: "Home" },
  { id: "library", label: "Library" },
  { id: "write", label: "Write" },
  { id: "review", label: "Review" },
  { id: "plan", label: "Plan" },
  { id: "analyse", label: "Analyse" },
  { id: "research", label: "Research" },
  { id: "publish", label: "Publish" },
  { id: "settings", label: "Settings" },
]

function ShellFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const { ollamaOk, statusLabel, statusTone } = useChatSettings()
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "15.5rem",
          "--sidebar-width-icon": "3.25rem",
        } as CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="flex min-h-[100dvh] flex-col overflow-hidden bg-background">
        <AppTopbar
          title={title}
          subtitle={subtitle}
          ollamaOk={ollamaOk ?? true}
          statusLabel={statusLabel}
          statusTone={statusTone}
        />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AuditBody({ pane }: { pane: Pane }) {
  if (pane === "setup") {
    return (
      <SetupGate onReady={() => undefined} onSignOut={() => undefined} />
    )
  }

  if (pane === "home") {
    return (
      <ShellFrame
        title="Home"
        subtitle="Local author workspace - notes in, agents on drafts you attach"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-4 py-6 sm:px-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Pick up the work on this machine
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {agentNav.map((item) => (
              <li key={item.href} className="px-4 py-3 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="ms-2 text-muted-foreground">{item.blurb}</span>
              </li>
            ))}
          </ul>
        </div>
      </ShellFrame>
    )
  }

  if (pane === "library") {
    return (
      <ShellFrame
        title="Library"
        subtitle="Local notes evidence - file, paste, link, later Notion via MCP"
      >
        <LibraryShell />
      </ShellFrame>
    )
  }

  if (pane === "write") {
    return (
      <ShellFrame
        title="Write"
        subtitle="Attach a target draft · agent revises with local search_notes"
      >
        <AgentWorkspace
          agentName="Write"
          agentJob="Revise the attached draft using Library evidence"
        />
      </ShellFrame>
    )
  }

  if (pane === "review") {
    return (
      <ShellFrame
        title="Review"
        subtitle="Attach a target draft · agent scores and cites Library evidence"
      >
        <AgentWorkspace
          agentName="Review"
          agentJob="Feedback on the attached draft with grounded continuity checks"
        />
      </ShellFrame>
    )
  }

  if (pane === "plan") {
    return (
      <ShellFrame title="Plan" subtitle="Boards for scenes, chapters, and threads">
        <AgentComingSoon
          title="Plan"
          icon={Kanban}
          lead="Structure the story without treating the board as an LLM chat."
          bullets={[
            "Scene and chapter boards with drag status.",
            "Open threads live beside the board.",
            "Write attaches the draft; Plan organizes work.",
          ]}
        />
      </ShellFrame>
    )
  }

  if (pane === "analyse") {
    return (
      <ShellFrame title="Analyse" subtitle="Findings by category with evidence">
        <AgentComingSoon
          title="Analyse"
          icon={Microscope}
          lead="Structured passes over a target draft or project slice."
          bullets={[
            "Category findings with evidence links.",
            "You attach the slice under analysis.",
            "Tools start with search_notes.",
          ]}
        />
      </ShellFrame>
    )
  }

  if (pane === "research") {
    return (
      <ShellFrame title="Research" subtitle="Layered research on Library notes">
        <AgentComingSoon
          title="Research"
          icon={FileSearch}
          lead="Hybrid retrieve first; MCP imports land as Library notes."
          bullets={[
            "Local library retrieve first.",
            "Notion MCP imports become notes.",
            "Citations stay raw evidence hits.",
          ]}
        />
      </ShellFrame>
    )
  }

  if (pane === "publish") {
    return (
      <ShellFrame title="Publish" subtitle="Synopsis, blurb, and query">
        <AgentComingSoon
          title="Publish"
          icon={Send}
          lead="Outbound packaging. You choose which draft feeds the agent."
          bullets={[
            "You attach the synopsis source.",
            "Outputs stay session artifacts until saved.",
            "Separate job from Write.",
          ]}
        />
      </ShellFrame>
    )
  }

  return (
    <ShellFrame
      title="Settings"
      subtitle="Local machine - Ollama, chat model, creativity"
    >
      <SettingsPanels />
    </ShellFrame>
  )
}

export default function UiAuditPage() {
  const [pane, setPane] = useState<Pane>("library")

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Not available.</p>
      </div>
    )
  }

  return (
    <div dir="ltr" className="flex min-h-[100dvh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2">
        <span className="me-2 text-xs font-medium text-muted-foreground">
          UI audit
        </span>
        {panes.map((p) => (
          <Button
            key={p.id}
            size="xs"
            variant={pane === p.id ? "default" : "outline"}
            onClick={() => setPane(p.id)}
          >
            {p.label}
          </Button>
        ))}
        <ButtonLink href="/login" size="xs" variant="ghost">
          Login
        </ButtonLink>
      </div>
      <AuditBody pane={pane} />
    </div>
  )
}
