"use client"

import { AgentWorkspace } from "@/components/agent-workspace"
import { AppShell } from "@/components/app-shell"

export default function ReviewPage() {
  return (
    <AppShell
      title="Review"
      subtitle="Attach a target draft · agent scores and cites Library evidence"
    >
      <AgentWorkspace
        agentName="Review"
        agentJob="Feedback on the attached draft with grounded continuity checks"
        tools={["search_notes"]}
      />
    </AppShell>
  )
}
