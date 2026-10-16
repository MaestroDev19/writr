"use client"

import { Send } from "lucide-react"
import { AgentComingSoon } from "@/components/agent-coming-soon"
import { AppShell } from "@/components/app-shell"

export default function PublishPage() {
  return (
    <AppShell
      title="Publish"
      subtitle="Synopsis, blurb, and query - separate from the working draft"
    >
      <AgentComingSoon
        title="Publish"
        icon={Send}
        lead="Outbound packaging surfaces. You choose which draft or outline feeds the agent; Library supplies continuity facts."
        bullets={[
          "Target: synopsis source you attach (not silent Notion fetch).",
          "Outputs stay session artifacts until you save them.",
          "Does not replace Write - packaging is a different job.",
          "Settings chat model applies when this agent ships.",
        ]}
      />
    </AppShell>
  )
}
