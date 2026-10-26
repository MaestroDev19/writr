"use client"

import { AgentWorkspace } from "@/components/agent-workspace"
import { AppShell } from "@/components/app-shell"

export default function AnalysePage() {
  return (
    <AppShell
      title="Analyse"
      subtitle="Structured critique passes over a target draft with grounded continuity checks"
    >
      <AgentWorkspace
        agentName="Analyse"
        agentJob="Examines target draft for voice, pacing, and continuity grounded in Library notes"
        tools={["search_notes"]}
      />
    </AppShell>
  )
}
