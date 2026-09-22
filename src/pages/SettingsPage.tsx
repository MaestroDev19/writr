import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "cn"
import {
  Cloud,
  CheckCircle2,
  Save,
  RefreshCw,
  Sliders,
  Wand2,
  MessageSquareQuote,
} from "lucide-react"

import {
  useSettings,
  DEFAULT_GENERATE_CONFIG,
  DEFAULT_CRITIQUE_CONFIG,
} from "@/contexts/settings-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AuthorPresetsStrip } from "@/components/settings/author-presets-strip"
import { SystemDirectiveCard } from "@/components/settings/system-directive-card"
import { InferenceControlsCard } from "@/components/settings/inference-controls-card"
import { WritingModelCard } from "@/components/settings/writing-model-card"
import {
  CRITIQUE_PRESETS,
  GENERATE_PRESETS,
  type WorkflowPreset,
} from "@/pages/settings/presets"
import {
  settingsFormSchema,
  type SettingsFormValues,
} from "@/pages/settings/settings-form-schema"

export default function SettingsPage() {
  const { settings, updateSettings, activeModelDisplayName } = useSettings()

  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [presetNotice, setPresetNotice] = React.useState<string | null>(null)
  const [activeWorkflowTab, setActiveWorkflowTab] = React.useState<"generate" | "critique">(
    "generate"
  )

  React.useEffect(() => {
    if (!saveSuccess) return
    const id = window.setTimeout(() => setSaveSuccess(false), 2500)
    return () => window.clearTimeout(id)
  }, [saveSuccess])

  React.useEffect(() => {
    if (!presetNotice) return
    const id = window.setTimeout(() => setPresetNotice(null), 3000)
    return () => window.clearTimeout(id)
  }, [presetNotice])

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      llmSource: settings.llmSource || "default",
      modelProvider: settings.modelProvider || "gemini",
      byokModel: settings.byokModel || "",
      apiKey: "",
      generateConfig: settings.generateConfig || DEFAULT_GENERATE_CONFIG,
      critiqueConfig: settings.critiqueConfig || DEFAULT_CRITIQUE_CONFIG,
    },
  })

  React.useEffect(() => {
    reset({
      llmSource: settings.llmSource || "default",
      modelProvider: settings.modelProvider || "gemini",
      byokModel: settings.byokModel || "",
      apiKey: "",
      generateConfig: settings.generateConfig || DEFAULT_GENERATE_CONFIG,
      critiqueConfig: settings.critiqueConfig || DEFAULT_CRITIQUE_CONFIG,
    })
  }, [settings, reset])

  const activePresets = activeWorkflowTab === "generate" ? GENERATE_PRESETS : CRITIQUE_PRESETS

  const onSubmit = (data: SettingsFormValues) => {
    if (data.llmSource === "byok" && !settings.byokKeyConfigured && !data.apiKey.trim()) {
      setError("apiKey", { message: "Paste your API key to use your own model." })
      return
    }

    const trimmedKey = data.apiKey.trim()
    updateSettings({
      llmSource: data.llmSource,
      modelProvider: data.modelProvider,
      byokModel: data.byokModel.trim(),
      byokKeyConfigured:
        data.llmSource === "byok"
          ? settings.byokKeyConfigured || Boolean(trimmedKey)
          : settings.byokKeyConfigured,
      byokKeyLast4: trimmedKey ? trimmedKey.slice(-4) : settings.byokKeyLast4,
      generateConfig: data.generateConfig,
      critiqueConfig: data.critiqueConfig,
    })
    setValue("apiKey", "")
    setSaveSuccess(true)
  }

  const handleApplyPreset = React.useCallback(
    (preset: WorkflowPreset) => {
      const targetKey = activeWorkflowTab === "generate" ? "generateConfig" : "critiqueConfig"
      setValue(`${targetKey}.systemPrompt`, preset.systemPrompt, { shouldDirty: true })
      setValue(`${targetKey}.temperature`, preset.temperature, { shouldDirty: true })
      setValue(`${targetKey}.maxTokens`, preset.maxTokens, { shouldDirty: true })
      setValue(`${targetKey}.topP`, preset.topP, { shouldDirty: true })
      setValue(`${targetKey}.frequencyPenalty`, preset.frequencyPenalty, { shouldDirty: true })
      setValue(`${targetKey}.contextChunks`, preset.contextChunks, { shouldDirty: true })
      setPresetNotice(`Applied: ${preset.name}`)
    },
    [activeWorkflowTab, setValue]
  )

  const handleResetToDefault = React.useCallback(() => {
    const targetKey = activeWorkflowTab === "generate" ? "generateConfig" : "critiqueConfig"
    const defaultConf =
      activeWorkflowTab === "generate" ? DEFAULT_GENERATE_CONFIG : DEFAULT_CRITIQUE_CONFIG
    setValue(targetKey, defaultConf, { shouldDirty: true })
    setPresetNotice("Reset to defaults")
  }, [activeWorkflowTab, setValue])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="text-pretty text-sm text-muted-foreground">
          Tune how Writr writes and reviews.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card className="rounded-[var(--radius-xl)] border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                <Cloud className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Cloud</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Notes and writing run in the cloud. No local setup.
                </p>
              </div>
            </div>
            <Badge variant="secondary">{activeModelDisplayName}</Badge>
          </div>
        </Card>

        <WritingModelCard
          control={control}
          setValue={setValue}
          keyConfigured={settings.byokKeyConfigured}
          keyLast4={settings.byokKeyLast4}
        />

        <Card
          aria-label="Writing style"
          className="rounded-[var(--radius-xl)] border-border bg-card p-4 shadow-xs sm:p-6"
        >
          <CardHeader className="gap-3 border-b border-border p-0 pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="size-5 text-primary" aria-hidden="true" />
                  <CardTitle className="text-lg font-bold text-foreground normal-case tracking-normal">
                    Writing style
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 max-w-xl text-xs">
                  Presets and controls for Write and Review.
                </CardDescription>
              </div>

              <div
                className="grid w-full grid-cols-2 gap-1 self-start rounded-[var(--radius)] border border-border bg-muted/60 p-1 sm:inline-flex sm:w-auto"
                role="tablist"
                aria-label="Style target"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeWorkflowTab === "generate"}
                  onClick={() => setActiveWorkflowTab("generate")}
                  className={cn(
                    "flex min-h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold transition-colors",
                    activeWorkflowTab === "generate"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Wand2 className="size-3.5 text-primary" aria-hidden="true" />
                  Write
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeWorkflowTab === "critique"}
                  onClick={() => setActiveWorkflowTab("critique")}
                  className={cn(
                    "flex min-h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold transition-colors",
                    activeWorkflowTab === "critique"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquareQuote className="size-3.5 text-primary" aria-hidden="true" />
                  Review
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6 p-0 pt-5">
            <AuthorPresetsStrip
              control={control}
              activeWorkflowTab={activeWorkflowTab}
              activePresets={activePresets}
              onApplyPreset={handleApplyPreset}
              presetNotice={presetNotice}
            />

            <SystemDirectiveCard
              control={control}
              setValue={setValue}
              getValues={getValues}
              activeWorkflowTab={activeWorkflowTab}
            />

            <InferenceControlsCard
              control={control}
              activeWorkflowTab={activeWorkflowTab}
              onResetToDefault={handleResetToDefault}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[var(--radius-xl)] border-border bg-card/60 p-4 shadow-xs">
          <CardContent className="flex flex-col items-stretch justify-between gap-3 p-0 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              Writer:{" "}
              <span className="font-semibold text-foreground">{activeModelDisplayName}</span>
            </p>

            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              {saveSuccess ? (
                <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Saved
                </span>
              ) : null}

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <RefreshCw data-icon="inline-start" className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save data-icon="inline-start" />
                    Save settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
