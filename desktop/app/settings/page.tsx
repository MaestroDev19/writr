"use client"

import { AppShell } from "@/components/app-shell"
import { SettingsPanels } from "@/components/settings/settings-panels"

export default function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      subtitle="Local machine - Ollama, chat model, creativity"
    >
      <SettingsPanels />
    </AppShell>
  )
}
