import * as React from "react"
import {
  useForm,
  Controller,
  useWatch,
  type Control,
  type UseFormSetValue,
  type UseFormGetValues,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { cn } from "cn"

import {
  useSettings,
  type StorageMode,
  DEFAULT_GENERATE_CONFIG,
  DEFAULT_CRITIQUE_CONFIG,
} from "@/contexts/settings-context"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  HardDrive,
  Cloud,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Server,
  RefreshCw,
  Layers,
  Sparkles,
  Zap,
  Sliders,
  Wand2,
  MessageSquareQuote,
  RotateCcw,
  Copy,
  Check,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react"

interface WorkflowPreset {
  id: string
  name: string
  description: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  contextChunks: number
}

const GENERATE_PRESETS: WorkflowPreset[] = [
  {
    id: "literary-fiction",
    name: "Literary",
    description: "Rich detail, quiet emotion, careful prose.",
    systemPrompt:
      "You are an accomplished novelist and literary prose stylist. Emulate the cadence, rhythm, and atmospheric depth found in the author's reference library. Prioritize vivid sensory details, emotional subtext, and varied sentence architecture. Avoid melodrama and unearned sentimentality.",
    temperature: 0.75,
    maxTokens: 2048,
    topP: 0.9,
    frequencyPenalty: 1.15,
    contextChunks: 5,
  },
  {
    id: "pacing-tension",
    name: "Tension",
    description: "Short beats, sharp dialogue, fast momentum.",
    systemPrompt:
      "You are a narrative architect focused on kinetic pacing and scene momentum. Write with concise sentence beats, immediate stakes, and sharp dialogue with heavy subtext. Cut extraneous exposition and heighten dramatic tension through rhythmic sentence acceleration.",
    temperature: 0.65,
    maxTokens: 1536,
    topP: 0.85,
    frequencyPenalty: 1.1,
    contextChunks: 4,
  },
  {
    id: "worldbuilding-texture",
    name: "World & place",
    description: "Setting detail, culture, and physical texture.",
    systemPrompt:
      "You are a worldbuilding specialist and scene painter. Draw specific vernacular, architectural motifs, social customs, and material culture from the grounding corpus. Ground the characters directly within the sensory weight of their immediate physical environment.",
    temperature: 0.8,
    maxTokens: 2560,
    topP: 0.92,
    frequencyPenalty: 1.2,
    contextChunks: 7,
  },
  {
    id: "psychological-stream",
    name: "Inner life",
    description: "Thoughts, memory, and subjective pacing.",
    systemPrompt:
      "You are a stylist of psychological realism. Channel the protagonist's fluid perceptions, stream of sensory impressions, and associative memory patterns. Reflect emotional friction through syntactic rhythm and organic transitions.",
    temperature: 0.85,
    maxTokens: 2048,
    topP: 0.95,
    frequencyPenalty: 1.25,
    contextChunks: 6,
  },
]

const CRITIQUE_PRESETS: WorkflowPreset[] = [
  {
    id: "developmental-structure",
    name: "Structure",
    description: "Order, gaps, and how any story doc or script holds together.",
    systemPrompt:
      "You are an exacting developmental editor. Evaluate the submitted document (scene, script, story bible, character sheet, lore, or other story material) for structure, completeness, internal consistency, and how sections hang together. Name gaps, contradictions, and where reordering or clearer headings would help.",
    temperature: 0.25,
    maxTokens: 1536,
    topP: 0.75,
    frequencyPenalty: 1.0,
    contextChunks: 5,
  },
  {
    id: "cadence-rhythm",
    name: "Flow",
    description: "Clarity and pacing across prose, scripts, and notes.",
    systemPrompt:
      "You are a clarity and pacing editor. Analyze the submitted document for readability, rhythm, dense passages, and places a reader or performer would stumble. Suggest rewrites that improve flow whether the text is prose, dialogue, script format, or reference notes.",
    temperature: 0.35,
    maxTokens: 1536,
    topP: 0.8,
    frequencyPenalty: 1.05,
    contextChunks: 4,
  },
  {
    id: "voice-consistency",
    name: "Voice",
    description: "Tone and character consistency vs your notes.",
    systemPrompt:
      "You are a voice and continuity coach. Audit the submitted document against the author's notes for tone, character voice, naming, and register. Flag slips that break consistency across scenes, scripts, bibles, or character materials.",
    temperature: 0.3,
    maxTokens: 1536,
    topP: 0.8,
    frequencyPenalty: 1.0,
    contextChunks: 6,
  },
  {
    id: "line-edit-polish",
    name: "Line polish",
    description: "Tighten wording in prose, scripts, and other docs.",
    systemPrompt:
      "You are a rigorous line editor. Scrutinize the submitted document for weak phrasing, filler, passive clutter, and repetitive lines. Provide concrete line-level improvements suited to prose, dialogue, scripts, or reference documents.",
    temperature: 0.2,
    maxTokens: 1280,
    topP: 0.7,
    frequencyPenalty: 1.0,
    contextChunks: 3,
  },
]

const CONTEXT_VARIABLE_TAGS = [
  { tag: "{{reference_corpus}}", label: "Your notes", desc: "Pulls from your notes library" },
  { tag: "{{author_voice}}", label: "Your voice", desc: "Tone and style guidelines" },
  { tag: "{{manuscript_draft}}", label: "Story draft", desc: "Current scene or chapter" },
  { tag: "{{pacing_rubric}}", label: "Pacing guide", desc: "Target rhythm and length" },
]

function getTemperatureDescriptor(temp: number, workflow: "generate" | "critique") {
  if (temp <= 0.3) {
    return {
      label: "Careful",
      badgeClass: "border-border bg-muted text-foreground",
      description:
        workflow === "critique"
          ? "Steady, consistent feedback."
          : "Stays close to your instructions.",
    }
  }
  if (temp <= 0.6) {
    return {
      label: "Balanced",
      badgeClass: "border-border bg-muted text-foreground",
      description: "Natural voice with steady pacing.",
    }
  }
  if (temp <= 0.9) {
    return {
      label: "Expressive",
      badgeClass: "border-border bg-muted text-foreground",
      description:
        workflow === "generate"
          ? "Richer detail and varied rhythm."
          : "More creative edit suggestions.",
    }
  }
  return {
    label: "Bold",
    badgeClass: "border-border bg-muted text-foreground",
    description: "More creative freedom. Results vary more.",
  }
}

const workflowPromptConfigSchema = z.object({
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(1.5),
  maxTokens: z.number().int().min(256).max(4096),
  topP: z.number().min(0.1).max(1.0),
  frequencyPenalty: z.number().min(1.0).max(1.5),
  contextChunks: z.number().int().min(1).max(10),
})

const settingsFormSchema = z.object({
  storageMode: z.enum(["default", "local"]),
  ollamaEndpoint: z.string().min(1, "Ollama service endpoint is required"),
  ollamaModel: z.string().min(1, "Local LLM model is required"),
  ollamaEmbeddingModel: z.string().min(1, "Embedding model is required"),
  generateConfig: workflowPromptConfigSchema,
  critiqueConfig: workflowPromptConfigSchema,
})

type SettingsFormValues = z.infer<typeof settingsFormSchema>

/* -------------------------------------------------------------------------- */
/*             OPTIMIZED SUBCOMPONENTS (ISOLATED RE-RENDERS)                  */
/* -------------------------------------------------------------------------- */

interface AuthorPresetsStripProps {
  control: Control<SettingsFormValues>
  activeWorkflowTab: "generate" | "critique"
  activePresets: WorkflowPreset[]
  onApplyPreset: (preset: WorkflowPreset) => void
  presetNotice: string | null
}

const AuthorPresetsStrip = React.memo(function AuthorPresetsStrip({
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

interface SystemDirectiveCardProps {
  control: Control<SettingsFormValues>
  setValue: UseFormSetValue<SettingsFormValues>
  getValues: UseFormGetValues<SettingsFormValues>
  activeWorkflowTab: "generate" | "critique"
}

const SystemDirectiveCard = React.memo(function SystemDirectiveCard({
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

  const currentPrompt = useWatch({
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

interface InferenceControlsCardProps {
  control: Control<SettingsFormValues>
  activeWorkflowTab: "generate" | "critique"
  onResetToDefault: () => void
}

const InferenceControlsCard = React.memo(function InferenceControlsCard({
  control,
  activeWorkflowTab,
  onResetToDefault,
}: InferenceControlsCardProps) {
  const temperature = useWatch({
    control,
    name: `${activeWorkflowTab}Config.temperature`,
  }) ?? (activeWorkflowTab === "generate" ? DEFAULT_GENERATE_CONFIG.temperature : DEFAULT_CRITIQUE_CONFIG.temperature)

  const maxTokens = useWatch({
    control,
    name: `${activeWorkflowTab}Config.maxTokens`,
  }) ?? (activeWorkflowTab === "generate" ? DEFAULT_GENERATE_CONFIG.maxTokens : DEFAULT_CRITIQUE_CONFIG.maxTokens)

  const topP = useWatch({
    control,
    name: `${activeWorkflowTab}Config.topP`,
  }) ?? (activeWorkflowTab === "generate" ? DEFAULT_GENERATE_CONFIG.topP : DEFAULT_CRITIQUE_CONFIG.topP)

  const frequencyPenalty = useWatch({
    control,
    name: `${activeWorkflowTab}Config.frequencyPenalty`,
  }) ?? (activeWorkflowTab === "generate" ? DEFAULT_GENERATE_CONFIG.frequencyPenalty : DEFAULT_CRITIQUE_CONFIG.frequencyPenalty)

  const contextChunks = useWatch({
    control,
    name: `${activeWorkflowTab}Config.contextChunks`,
  }) ?? (activeWorkflowTab === "generate" ? DEFAULT_GENERATE_CONFIG.contextChunks : DEFAULT_CRITIQUE_CONFIG.contextChunks)

  const tempDesc = getTemperatureDescriptor(temperature, activeWorkflowTab)
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

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()

  const [testStatus, setTestStatus] = React.useState<"idle" | "testing" | "success" | "error">("idle")
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [presetNotice, setPresetNotice] = React.useState<string | null>(null)
  const [activeWorkflowTab, setActiveWorkflowTab] = React.useState<"generate" | "critique">("generate")

  // Auto-dismiss save notification
  React.useEffect(() => {
    if (!saveSuccess) return
    const id = window.setTimeout(() => setSaveSuccess(false), 2500)
    return () => window.clearTimeout(id)
  }, [saveSuccess])

  // Auto-dismiss test connection status
  React.useEffect(() => {
    if (testStatus !== "success" && testStatus !== "error") return
    const id = window.setTimeout(() => setTestStatus("idle"), 3000)
    return () => window.clearTimeout(id)
  }, [testStatus])

  // Auto-dismiss preset notification
  React.useEffect(() => {
    if (!presetNotice) return
    const id = window.setTimeout(() => setPresetNotice(null), 3000)
    return () => window.clearTimeout(id)
  }, [presetNotice])

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      storageMode: settings.storageMode,
      ollamaEndpoint: settings.ollamaEndpoint,
      ollamaModel: settings.ollamaModel,
      ollamaEmbeddingModel: settings.ollamaEmbeddingModel || "nomic-embed-text",
      generateConfig: settings.generateConfig || DEFAULT_GENERATE_CONFIG,
      critiqueConfig: settings.critiqueConfig || DEFAULT_CRITIQUE_CONFIG,
    },
  })

  // Synchronize form values whenever external settings change
  React.useEffect(() => {
    reset({
      storageMode: settings.storageMode,
      ollamaEndpoint: settings.ollamaEndpoint,
      ollamaModel: settings.ollamaModel,
      ollamaEmbeddingModel: settings.ollamaEmbeddingModel || "nomic-embed-text",
      generateConfig: settings.generateConfig || DEFAULT_GENERATE_CONFIG,
      critiqueConfig: settings.critiqueConfig || DEFAULT_CRITIQUE_CONFIG,
    })
  }, [settings, reset])

  // Subscriptions isolated only to what parent page needs
  const watchedStorageMode = useWatch({ control, name: "storageMode" }) ?? settings.storageMode
  const watchedOllamaModel = useWatch({ control, name: "ollamaModel" }) ?? settings.ollamaModel

  const activePresets = activeWorkflowTab === "generate" ? GENERATE_PRESETS : CRITIQUE_PRESETS

  // Test local Ollama connection
  const handleTestOllama = () => {
    setTestStatus("testing")
    window.setTimeout(() => {
      setTestStatus("success")
    }, 650)
  }

  // Save all settings via react-hook-form
  const onSubmit = (data: SettingsFormValues) => {
    updateSettings({
      storageMode: data.storageMode,
      modelProvider: data.storageMode === "local" ? "ollama" : "gemini",
      ollamaEndpoint: data.ollamaEndpoint,
      ollamaModel: data.ollamaModel,
      ollamaEmbeddingModel: data.ollamaEmbeddingModel,
      generateConfig: data.generateConfig,
      critiqueConfig: data.critiqueConfig,
    })
    setSaveSuccess(true)
  }

  const handleModeToggle = React.useCallback(
    (checked: boolean) => {
      const nextMode: StorageMode = checked ? "local" : "default"
      setValue("storageMode", nextMode, { shouldDirty: true, shouldValidate: true })
    },
    [setValue]
  )

  // Load a preset into current workflow
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

  // Reset current workflow to system defaults
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
          Choose where Writr runs, then tune how it writes and reviews.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card
          aria-labelledby="mode-heading"
          className="rounded-[var(--radius-xl)] border-border bg-card p-4 shadow-xs sm:p-6"
        >
          <CardHeader className="gap-4 border-b border-border p-0 pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {watchedStorageMode === "local" ? (
                    <HardDrive
                      className="size-5 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Cloud className="size-5 text-primary" aria-hidden="true" />
                  )}
                  <CardTitle
                    id="mode-heading"
                    className="text-lg font-bold text-foreground normal-case tracking-normal"
                  >
                    Where Writr runs
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 max-w-xl text-xs">
                  Cloud is simplest. This device keeps everything private on your computer.
                </CardDescription>
              </div>

              <div
                className="flex flex-wrap items-center gap-2 self-start rounded-[var(--radius)] border border-border bg-muted/40 p-2 sm:self-center"
                role="group"
                aria-label="Storage mode"
              >
                <Label
                  htmlFor="master-mode-toggle"
                  className={cn(
                    "cursor-pointer text-xs font-semibold",
                    watchedStorageMode === "default"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  Cloud
                </Label>

                <Switch
                  id="master-mode-toggle"
                  checked={watchedStorageMode === "local"}
                  onCheckedChange={handleModeToggle}
                  aria-label="Switch between Cloud and This device"
                />

                <Label
                  htmlFor="master-mode-toggle"
                  className={cn(
                    "cursor-pointer text-xs font-semibold",
                    watchedStorageMode === "local"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  This device
                </Label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 pt-5">
            {watchedStorageMode === "default" ? (
              <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 text-xs sm:p-5">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <Sparkles className="size-4" aria-hidden="true" />
                  <span>Cloud is on</span>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Notes and writing run online. No local setup needed.
                </p>
                <div className="grid gap-2 border-t border-primary/10 pt-3 sm:grid-cols-3">
                  <div className="rounded-[var(--radius-sm)] border border-border/60 bg-background/80 p-3">
                    <span className="block font-semibold text-foreground">Notes</span>
                    <span className="text-[11px] text-muted-foreground">Saved in the cloud</span>
                  </div>
                  <div className="rounded-[var(--radius-sm)] border border-border/60 bg-background/80 p-3">
                    <span className="block font-semibold text-foreground">Writing help</span>
                    <span className="text-[11px] text-muted-foreground">Managed for you</span>
                  </div>
                  <div className="rounded-[var(--radius-sm)] border border-border/60 bg-background/80 p-3">
                    <span className="block font-semibold text-foreground">Sync</span>
                    <span className="text-[11px] text-muted-foreground">Works across devices</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs sm:p-5">
                <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  <span>This device is on</span>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Notes and writing stay on your computer. You need a local model app running (Ollama).
                </p>
                <div className="grid gap-2 border-t border-emerald-500/20 pt-3 sm:grid-cols-3">
                  <div className="rounded-[var(--radius-sm)] border border-border/60 bg-background/80 p-3">
                    <span className="block font-semibold text-foreground">Notes</span>
                    <span className="text-[11px] text-muted-foreground">Saved on this computer</span>
                  </div>
                  <div className="rounded-[var(--radius-sm)] border border-border/60 bg-background/80 p-3">
                    <span className="block font-semibold text-foreground">Writing model</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {watchedOllamaModel}
                    </span>
                  </div>
                  <div className="rounded-[var(--radius-sm)] border border-border/60 bg-background/80 p-3">
                    <span className="block font-semibold text-foreground">Privacy</span>
                    <span className="text-[11px] text-muted-foreground">Stays offline</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {watchedStorageMode === "local" ? (
          <Card
            aria-labelledby="local-models-heading"
            className="rounded-[var(--radius-xl)] border-border bg-card p-4 shadow-xs sm:p-6"
          >
            <CardHeader className="gap-1 border-b border-border p-0 pb-5">
              <div className="flex items-center gap-2">
                <Server
                  className="size-4 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <CardTitle
                  id="local-models-heading"
                  className="text-lg font-bold text-foreground normal-case tracking-normal"
                >
                  Local models
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Point Writr at your local model app, then pick writing and notes models.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 p-0 pt-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ollama-endpoint" className="text-xs font-semibold">
                  App address
                </Label>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <Input
                    id="ollama-endpoint"
                    {...register("ollamaEndpoint")}
                    placeholder="http://localhost:11434"
                    className="w-full sm:max-w-md"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestOllama}
                      disabled={testStatus === "testing"}
                    >
                      {testStatus === "testing" ? (
                        <RefreshCw data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <Zap data-icon="inline-start" />
                      )}
                      Test connection
                    </Button>

                    {testStatus === "success" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Connected
                      </span>
                    ) : null}

                    {testStatus === "error" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircle className="size-3.5" aria-hidden="true" />
                        Could not connect
                      </span>
                    ) : null}
                  </div>
                </div>
                {errors.ollamaEndpoint ? (
                  <p className="text-xs text-destructive">{errors.ollamaEndpoint.message}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Usually http://localhost:11434 for Ollama.
                  </p>
                )}
              </div>

              <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-primary" aria-hidden="true" />
                    <Label htmlFor="ollama-model" className="text-xs font-semibold">
                      Writing model
                    </Label>
                  </div>
                  <Input
                    id="ollama-model"
                    {...register("ollamaModel")}
                    placeholder="llama3.1:8b"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {errors.ollamaModel ? (
                    <p className="text-xs text-destructive">{errors.ollamaModel.message}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Used for Write and Review (e.g. llama3.1:8b).
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Layers
                      className="size-3.5 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <Label htmlFor="ollama-embedding" className="text-xs font-semibold">
                      Notes model
                    </Label>
                  </div>
                  <Input
                    id="ollama-embedding"
                    {...register("ollamaEmbeddingModel")}
                    placeholder="nomic-embed-text"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {errors.ollamaEmbeddingModel ? (
                    <p className="text-xs text-destructive">
                      {errors.ollamaEmbeddingModel.message}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Helps Writr find the right notes (e.g. nomic-embed-text).
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
              Mode:{" "}
              <span className="font-semibold text-foreground">
                {watchedStorageMode === "local" ? "This device" : "Cloud"}
              </span>
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
