import * as React from "react"
import {
  Controller,
  useWatch,
  type Control,
  type UseFormGetValues,
  type UseFormSetValue,
} from "react-hook-form"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CONTEXT_VARIABLE_TAGS } from "@/pages/settings/presets"
import type { SettingsFormValues } from "@/pages/settings/settings-form-schema"

interface SystemDirectiveCardProps {
  control: Control<SettingsFormValues>
  setValue: UseFormSetValue<SettingsFormValues>
  getValues: UseFormGetValues<SettingsFormValues>
  activeWorkflowTab: "generate" | "critique"
}

export const SystemDirectiveCard = React.memo(function SystemDirectiveCard({
  control,
  setValue,
  getValues,
  activeWorkflowTab,
}: SystemDirectiveCardProps) {
  const [copiedPrompt, setCopiedPrompt] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  React.useEffect(() => {
    if (!copiedPrompt) return
    const id = window.setTimeout(() => setCopiedPrompt(false), 2000)
    return () => window.clearTimeout(id)
  }, [copiedPrompt])

  const currentPrompt =
    useWatch({
      control,
      name: `${activeWorkflowTab}Config.systemPrompt`,
    }) ?? ""

  const systemPromptTokensEstimate = Math.ceil(currentPrompt.length / 4)

  const handleCopyPrompt = async () => {
    try {
      const targetKey = activeWorkflowTab === "generate" ? "generateConfig" : "critiqueConfig"
      const promptVal = getValues(`${targetKey}.systemPrompt`)
      await navigator.clipboard.writeText(promptVal)
      setCopiedPrompt(true)
    } catch {
      // clipboard access fallback
    }
  }

  const handleInsertTag = (tag: string) => {
    const targetKey = activeWorkflowTab === "generate" ? "generateConfig" : "critiqueConfig"
    const current = getValues(`${targetKey}.systemPrompt`) || ""
    const el = textareaRef.current
    if (!el) {
      setValue(`${targetKey}.systemPrompt`, `${current} ${tag}`, { shouldDirty: true })
      return
    }
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const updated = `${current.slice(0, start)} ${tag} ${current.slice(end)}`
    setValue(`${targetKey}.systemPrompt`, updated, { shouldDirty: true })
    setTimeout(() => {
      el.focus()
      const nextPos = start + tag.length + 2
      el.setSelectionRange(nextPos, nextPos)
    }, 50)
  }

  return (
    <Card className="rounded-[var(--radius)] border-border bg-card/50">
      <CardHeader className="gap-2 p-4 pb-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xs font-semibold text-foreground normal-case tracking-normal">
              Writing instructions ({activeWorkflowTab === "generate" ? "Write" : "Review"})
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Tell Writr how to sound and what to prioritize.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              ~{systemPromptTokensEstimate} words est.
            </span>
            <Button type="button" variant="outline" size="xs" onClick={handleCopyPrompt}>
              {copiedPrompt ? (
                <>
                  <Check data-icon="inline-start" />
                  Copied
                </>
              ) : (
                <>
                  <Copy data-icon="inline-start" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-4 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-[11px] text-muted-foreground">Insert:</span>
          {CONTEXT_VARIABLE_TAGS.map((v) => (
            <Button
              key={v.tag}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => handleInsertTag(v.tag)}
              title={v.desc}
            >
              + {v.label}
            </Button>
          ))}
        </div>

        <Controller
          control={control}
          name={`${activeWorkflowTab}Config.systemPrompt`}
          render={({ field }) => (
            <textarea
              id="system-prompt"
              ref={(el) => {
                field.ref(el)
                textareaRef.current = el
              }}
              rows={5}
              value={field.value}
              onChange={field.onChange}
              placeholder="e.g. Write in a quiet literary voice. Keep dialogue short…"
              autoComplete="off"
              className="w-full resize-y rounded-[var(--radius)] border border-border bg-background p-3 text-sm leading-relaxed outline-hidden transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          )}
        />
      </CardContent>
    </Card>
  )
})
