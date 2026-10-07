import * as React from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cn } from "cn"

import {
  useSettings,
  DEFAULT_GENERATE_CONFIG,
  DEFAULT_CRITIQUE_CONFIG,
} from "@/contexts/settings-context"
import {
  getMySettings,
  saveCritiqueSetting,
  saveGenerateSetting,
  settingsApiEnabled,
  settingsPatchFromRemote,
  toWorkflowUpdate,
} from "@/api/endpoints/setting"
import {
  GEMINI_FREE_MODELS,
  getGeminiModelMeta,
  isGeminiFreeModel,
  WRITR_HOSTED_MODEL,
} from "@/lib/model-providers"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  GENERATE_PRESETS,
  CRITIQUE_PRESETS,
  type WorkflowPreset,
} from "@/pages/settings/presets"
import {
  settingsFormSchema,
  type SettingsFormValues,
} from "@/pages/settings/settings-form-schema"

import {
  Cloud,
  Save,
  RefreshCw,
  Sliders,
  Wand2,
  MessageSquareQuote,
  AlertCircle,
} from "lucide-react"

const GEMINI_MODEL_ITEMS = GEMINI_FREE_MODELS.map((model) => ({
  label: model.name,
  value: model.id,
}))

function toFormValues(
  geminiModel = WRITR_HOSTED_MODEL,
  generateConfig = DEFAULT_GENERATE_CONFIG,
  critiqueConfig = DEFAULT_CRITIQUE_CONFIG
): SettingsFormValues {
  return {
    geminiModel,
    generateConfig: generateConfig || DEFAULT_GENERATE_CONFIG,
    critiqueConfig: critiqueConfig || DEFAULT_CRITIQUE_CONFIG,
  }
}

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()

  const [activeWorkflowTab, setActiveWorkflowTab] = React.useState<
    "generate" | "critique"
  >("generate")

  const formValues = React.useMemo(
    () =>
      toFormValues(
        settings.geminiModel,
        settings.generateConfig,
        settings.critiqueConfig
      ),
    [settings.geminiModel, settings.generateConfig, settings.critiqueConfig]
  )

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    resetDefaultValues,
    setError,
    clearErrors,
    formState: { isSubmitting, errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: formValues,
    values: formValues,
    resetOptions: { keepDirtyValues: true },
  })

  const activePresets =
    activeWorkflowTab === "generate" ? GENERATE_PRESETS : CRITIQUE_PRESETS

  React.useEffect(() => {
    if (!settingsApiEnabled()) return
    let cancelled = false
    getMySettings()
      .then((remote) => {
        if (cancelled) return
        const patch = settingsPatchFromRemote(remote, isGeminiFreeModel)
        if (patch) updateSettings(patch)
      })
      .catch(() => {
        // Keep the copy already stored on this device.
      })
    return () => {
      cancelled = true
    }
  }, [updateSettings])

  const onSubmit = async (data: SettingsFormValues) => {
    clearErrors("root.serverError")
    try {
      if (settingsApiEnabled()) {
        // Sequential: both writes share one row, so the second must see the first insert.
        await saveGenerateSetting(toWorkflowUpdate(data.generateConfig, data.geminiModel))
        await saveCritiqueSetting(toWorkflowUpdate(data.critiqueConfig, data.geminiModel))
      }
      updateSettings({
        storageMode: "default",
        geminiModel: data.geminiModel,
        generateConfig: data.generateConfig,
        critiqueConfig: data.critiqueConfig,
      })
      resetDefaultValues(data)
      toast.success("Settings saved")
    } catch {
      setError("root.serverError", {
        type: "server",
        message: "Could not save settings — please retry",
      })
      toast.error("Could not save settings")
    }
  }

  const handleApplyPreset = React.useCallback(
    (preset: WorkflowPreset) => {
      const targetKey =
        activeWorkflowTab === "generate" ? "generateConfig" : "critiqueConfig"
      setValue(`${targetKey}.systemPrompt`, preset.systemPrompt, {
        shouldDirty: true,
      })
      setValue(`${targetKey}.temperature`, preset.temperature, {
        shouldDirty: true,
      })
      setValue(`${targetKey}.maxTokens`, preset.maxTokens, { shouldDirty: true })
      setValue(`${targetKey}.topP`, preset.topP, { shouldDirty: true })
      setValue(`${targetKey}.frequencyPenalty`, preset.frequencyPenalty, {
        shouldDirty: true,
      })
      setValue(`${targetKey}.contextChunks`, preset.contextChunks, {
        shouldDirty: true,
      })
      toast.success(`Applied ${preset.name}`)
    },
    [activeWorkflowTab, setValue]
  )

  const handleResetToDefault = React.useCallback(() => {
    const targetKey =
      activeWorkflowTab === "generate" ? "generateConfig" : "critiqueConfig"
    const defaultConf =
      activeWorkflowTab === "generate"
        ? DEFAULT_GENERATE_CONFIG
        : DEFAULT_CRITIQUE_CONFIG
    setValue(targetKey, defaultConf, { shouldDirty: true })
    toast.success("Reset to defaults")
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
        {errors.root?.serverError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p className="font-medium">{errors.root.serverError.message}</p>
          </div>
        ) : null}

        <Card className="rounded-[var(--radius-xl)] border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                <Cloud className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Cloud</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Gemini models with a free tier. No local setup.
                </p>
              </div>
            </div>
            <Controller
              control={control}
              name="geminiModel"
              render={({ field, fieldState }) => (
                <FieldGroup className="w-full sm:w-72">
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="gemini-model">Model</FieldLabel>
                    <Select
                      items={GEMINI_MODEL_ITEMS}
                      name={field.name}
                      value={field.value}
                      onValueChange={(value) => {
                        if (typeof value === "string" && isGeminiFreeModel(value)) {
                          field.onChange(value)
                        }
                      }}
                    >
                      <SelectTrigger
                        id="gemini-model"
                        ref={field.ref}
                        className="w-full"
                        aria-invalid={fieldState.invalid || undefined}
                        onBlur={field.onBlur}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" alignItemWithTrigger={false}>
                        <SelectGroup>
                          {GEMINI_MODEL_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {getGeminiModelMeta(field.value).hint}
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              )}
            />
          </div>
        </Card>

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
                  <MessageSquareQuote
                    className="size-3.5 text-primary"
                    aria-hidden="true"
                  />
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
              Mode: <span className="font-semibold text-foreground">Cloud</span>
            </p>

            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
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
