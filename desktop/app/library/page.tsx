"use client"

import { AppShell } from "@/components/app-shell"
import { LibraryShell } from "@/components/library/library-shell"

export default function LibraryPage() {
  return (
    <AppShell
      title="Library"
      subtitle="Local notes evidence - file, paste, link, later Notion via MCP"
    >
      <LibraryShell />
    </AppShell>
  )
}
