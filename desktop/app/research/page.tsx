"use client"

import { FileSearch } from "lucide-react"
import { AgentComingSoon } from "@/components/agent-coming-soon"
import { AppShell } from "@/components/app-shell"

export default function ResearchPage() {
  return (
    <AppShell
      title="Research"
      subtitle="Layered research on top of Library - citations stay local-first"
    >
      <AgentComingSoon
        title="Research"
        icon={FileSearch}
        lead="Absorbs Library search plus optional web or MCP sources. Imports still become Library notes before they become canon."
        bullets={[
          "Hybrid retrieve over this machine's library first.",
          "Notion and other MCP imports land as Library notes with link status.",
          "Citations show source title, ordinal, and score - no agent chrome on raw hits.",
          "Separate from Write: Research gathers; Write revises a target.",
        ]}
      />
    </AppShell>
  )
}
