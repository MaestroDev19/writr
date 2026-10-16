"use client"

import { Kanban } from "lucide-react"
import { AgentComingSoon } from "@/components/agent-coming-soon"
import { AppShell } from "@/components/app-shell"

export default function PlanPage() {
  return (
    <AppShell
      title="Plan"
      subtitle="Boards for scenes, chapters, and threads - not a chat agent"
    >
      <AgentComingSoon
        title="Plan"
        icon={Kanban}
        lead="Structure the story without treating the board as an LLM chat. Agents can read plan state later; you own the structure."
        bullets={[
          "Scene and chapter boards with drag status (AuthorOS phase).",
          "Open threads and continuity flags live beside the board.",
          "No target document here - Plan organizes work; Write attaches the draft.",
          "Library notes remain evidence, not automatic canon.",
        ]}
      />
    </AppShell>
  )
}
