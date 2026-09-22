import * as React from "react"
import { Controller, useWatch, type Control } from "react-hook-form"
import { RotateCcw, SlidersHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_CRITIQUE_CONFIG,
  DEFAULT_GENERATE_CONFIG,
} from "@/contexts/settings-context"
import { getCreativityLabel } from "@/lib/creativity-label"
import type { SettingsFormValues } from "@/pages/settings/settings-form-schema"

interface InferenceControlsCardProps {
  control: Control<SettingsFormValues>
  activeWorkflowTab: "generate" | "critique"
  onResetToDefault: () => void
}

export const InferenceControlsCard = React.memo(function InferenceControlsCard({
  control,
  activeWorkflowTab,
  onResetToDefault,
}: InferenceControlsCardProps) {
  const temperature =
    useWatch({
      control,
      name: `${activeWorkflowTab}Config.temperature`,
    }) ??
    (activeWorkflowTab === "generate"
      ? DEFAULT_GENERATE_CONFIG.temperature
      : DEFAULT_CRITIQUE_CONFIG.temperature)

  const maxTokens =
    useWatch({
      control,
      name: `${activeWorkflowTab}Config.maxTokens`,
    }) ??
    (activeWorkflowTab === "generate"
      ? DEFAULT_GENERATE_CONFIG.maxTokens
      : DEFAULT_CRITIQUE_CONFIG.maxTokens)

  const topP =
    useWatch({
      control,
      name: `${activeWorkflowTab}Config.topP`,
    }) ??
    (activeWorkflowTab === "generate"
      ? DEFAULT_GENERATE_CONFIG.topP
      : DEFAULT_CRITIQUE_CONFIG.topP)

  const frequencyPenalty =
    useWatch({
      control,
      name: `${activeWorkflowTab}Config.frequencyPenalty`,
    }) ??
    (activeWorkflowTab === "generate"
      ? DEFAULT_GENERATE_CONFIG.frequencyPenalty
      : DEFAULT_CRITIQUE_CONFIG.frequencyPenalty)

  const contextChunks =
    useWatch({
      control,
      name: `${activeWorkflowTab}Config.contextChunks`,
    }) ??
    (activeWorkflowTab === "generate"
      ? DEFAULT_GENERATE_CONFIG.contextChunks
      : DEFAULT_CRITIQUE_CONFIG.contextChunks)

  const tempDesc = getCreativityLabel(temperature, activeWorkflowTab)
  const estWordCount = Math.round(maxTokens * 0.75)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  return (
    <Card className="rounded-[var(--radius)] border-border bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/70 p-4 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-xs font-semibold text-foreground normal-case tracking-normal">
            Style controls
          </CardTitle>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResetToDefault}
          className="h-auto p-0 text-[11px] text-muted-foreground hover:bg-transparent hover:text-primary"
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 p-4">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="param-temperature" className="text-xs font-semibold">
                Creativity
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tabular-nums text-foreground">
                  {temperature.toFixed(2)}
                </span>
                <Badge variant="outline">{tempDesc.label}</Badge>
              </div>
            </div>

            <Controller
              control={control}
              name={`${activeWorkflowTab}Config.temperature`}
              render={({ field }) => (
                <input
                  id="param-temperature"
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={field.value}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  aria-label="Creativity"
                />
              )}
            />
            <p className="text-[11px] text-muted-foreground">{tempDesc.description}</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="param-max-tokens" className="text-xs font-semibold">
                Response length
              </Label>
              <span className="text-xs font-bold tabular-nums text-foreground">
                ~{estWordCount} words
              </span>
            </div>

            <Controller
              control={control}
              name={`${activeWorkflowTab}Config.maxTokens`}
              render={({ field }) => (
                <input
                  id="param-max-tokens"
                  type="range"
                  min="256"
                  max="4096"
                  step="128"
                  value={field.value}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  aria-label="Response length"
                />
              )}
            />
            <p className="text-[11px] text-muted-foreground">
              How long Writr’s reply can be.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="param-context-chunks" className="text-xs font-semibold">
                Notes used
              </Label>
              <span className="text-xs font-bold tabular-nums text-primary">
                {contextChunks} sections
              </span>
            </div>

            <Controller
              control={control}
              name={`${activeWorkflowTab}Config.contextChunks`}
              render={({ field }) => (
                <input
                  id="param-context-chunks"
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={field.value}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  aria-label="How many note sections to use"
                />
              )}
            />
            <p className="text-[11px] text-muted-foreground">
              How many pieces from your notes library Writr reads each time.
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            {showAdvanced ? "Hide advanced" : "More options"}
          </Button>

          {showAdvanced ? (
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="param-top-p" className="text-xs font-semibold">
                    Word variety
                  </Label>
                  <span className="text-xs font-bold tabular-nums">{topP.toFixed(2)}</span>
                </div>
                <Controller
                  control={control}
                  name={`${activeWorkflowTab}Config.topP`}
                  render={({ field }) => (
                    <input
                      id="param-top-p"
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      aria-label="Word variety"
                    />
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Lower = safer word choices. Higher = more unusual phrasing.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="param-repetition" className="text-xs font-semibold">
                    Avoid repeats
                  </Label>
                  <span className="text-xs font-bold tabular-nums">
                    {frequencyPenalty.toFixed(2)}
                  </span>
                </div>
                <Controller
                  control={control}
                  name={`${activeWorkflowTab}Config.frequencyPenalty`}
                  render={({ field }) => (
                    <input
                      id="param-repetition"
                      type="range"
                      min="1.0"
                      max="1.5"
                      step="0.05"
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      aria-label="Avoid repeats"
                    />
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Higher = less repeating the same phrases.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
})
