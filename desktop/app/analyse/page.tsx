"use client"

import { Microscope } from "lucide-react"
import { AgentComingSoon } from "@/components/agent-coming-soon"
import { AppShell } from "@/components/app-shell"

export default function AnalysePage() {
  return (
    <AppShell
      title="Analyse"
      subtitle="Findings by category with drill-down into Library evidence"
    >
      <AgentComingSoon
        title="Analyse"
        icon={Microscope}
        lead="Run structured passes over a target draft or project slice. Findings must cite notes or the draft, not invent continuity."
        bullets={[
          "Category findings (voice, continuity, pacing) with evidence links.",
          "Target document: you attach or select the slice under analysis.",
          "Tools start with search_notes; MCP tools appear when you enable them.",
          "Eval diagnostics stay power-user only - not a primary screen.",
        ]}
      />
    </AppShell>
  )
}
