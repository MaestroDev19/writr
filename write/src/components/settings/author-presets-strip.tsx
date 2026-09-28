import * as React from "react"
import { useWatch, type Control } from "react-hook-form"
import { cn } from "cn"
import { BookOpen } from "lucide-react"

import type { SettingsFormValues } from "@/pages/settings/settings-form-schema"
import type { WorkflowPreset } from "@/pages/settings/presets"

interface AuthorPresetsStripProps {
  control: Control<SettingsFormValues>
  activeWorkflowTab: "generate" | "critique"
  activePresets: WorkflowPreset[]
  onApplyPreset: (preset: WorkflowPreset) => void
  presetNotice: string | null
}

export const AuthorPresetsStrip = React.memo(function AuthorPresetsStrip({
  control,
  activeWorkflowTab,
  activePresets,
  onApplyPreset,
  presetNotice,
}: AuthorPresetsStripProps) {
  const currentPrompt = useWatch({
    control,
    name: `${activeWorkflowTab}Config.systemPrompt`,
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">Quick styles</span>
        </div>
        {presetNotice ? (
          <span className="text-[11px] font-medium text-primary">{presetNotice}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Tap one to apply</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {activePresets.map((preset) => {
          const isSelected = currentPrompt === preset.systemPrompt
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={cn(
                "min-h-[4.25rem] rounded-[var(--radius)] border p-3 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <span className="block text-xs font-semibold text-foreground">{preset.name}</span>
              <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {preset.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
