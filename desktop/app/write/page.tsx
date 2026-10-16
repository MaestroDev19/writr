"use client"

import { AgentWorkspace } from "@/components/agent-workspace"
import { AppShell } from "@/components/app-shell"

export default function WritePage() {
  return (
    <AppShell
      title="Write"
      subtitle="Attach a target draft · agent revises with local search_notes"
    >
      <AgentWorkspace
        agentName="Write"
        agentJob="Revise the attached draft using Library evidence"
        tools={["search_notes"]}
      />
    </AppShell>
  )
}
