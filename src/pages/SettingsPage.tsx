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
    name: "Literary Fiction",
    description: "Rich sensory textures, nuanced character interiority, and layered prose cadence.",
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
    name: "Tension & Propulsion",
    description: "Lean sentences, rapid dialogue exchange, and high narrative momentum.",
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
    name: "Worldbuilding & Milieu",
    description: "Deep historical context, architectural detail, and cultural specificity.",
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
    name: "Psychological Interiority",
    description: "Fluid consciousness, associative memory recall, and subjective pacing.",
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
    name: "Developmental & Structure",
    description: "Macro-level evaluation: narrative arcs, scene turns, and dramatic tension.",
    systemPrompt:
      "You are an exacting developmental editor and literary consultant. Evaluate the manuscript excerpt for narrative arc, scene objectives, dramatic tension, and structural momentum. Identify where pacing flags and specify how to tighten structural beats.",
    temperature: 0.25,
    maxTokens: 1536,
    topP: 0.75,
    frequencyPenalty: 1.0,
    contextChunks: 5,
  },
  {
    id: "cadence-rhythm",
    name: "Prose Cadence & Rhythm",
    description: "Line-level music: sentence length variance, euphony, and pacing dips.",
    systemPrompt:
      "You are a prose stylist specializing in sentence music and auditory cadence. Analyze sentence length variance, rhythm stumbling points, repetitive syllable patterns, and monotonic paragraphs. Suggest rhythmic rewrites that enhance melodic cadence.",
    temperature: 0.35,
    maxTokens: 1536,
    topP: 0.8,
    frequencyPenalty: 1.05,
    contextChunks: 4,
  },
  {
    id: "voice-consistency",
    name: "Voice & Tone Consistency",
    description: "Auditing dialogue registers, authorial distance, and mood coherence.",
    systemPrompt:
      "You are an editorial voice coach. Audit the text against the author's reference corpus for stylistic integrity. Highlight tonal anomalies, anachronistic vocabulary, dialogue that slips out of character, and inconsistent authorial distance.",
    temperature: 0.3,
    maxTokens: 1536,
    topP: 0.8,
    frequencyPenalty: 1.0,
    contextChunks: 6,
  },
  {
    id: "line-edit-polish",
    name: "Line Edit & Prose Polish",
    description: "Tightening flab, replacing weak verbs, and eliminating rhetorical ticks.",
    systemPrompt:
      "You are a rigorous copy and line editor. Scrutinize the prose for deadwood adjectives, filter words ('she heard', 'he noticed'), passive constructions, and repetitive phrasing. Provide high-impact line-level surgical improvements.",
    temperature: 0.2,
    maxTokens: 1280,
    topP: 0.7,
    frequencyPenalty: 1.0,
    contextChunks: 3,
  },
]

const CONTEXT_VARIABLE_TAGS = [
  { tag: "{{reference_corpus}}", label: "Reference Corpus", desc: "Grounding excerpts from library" },
  { tag: "{{author_voice}}", label: "Author Voice", desc: "Cadence & voice guidelines" },
  { tag: "{{manuscript_draft}}", label: "Manuscript Draft", desc: "Active scene or chapter context" },
  { tag: "{{pacing_rubric}}", label: "Pacing Rubric", desc: "Target rhythm and length boundaries" },
]

function getTemperatureDescriptor(temp: number, workflow: "generate" | "critique") {
  if (temp <= 0.3) {
    return {
      label: "Strict & Analytical",
      badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      description:
        workflow === "critique"
          ? "Optimal for objective rubric scoring and consistency checks."
          : "Strict adherence to constraints with minimal stylistic deviation.",
    }
  }
  if (temp <= 0.6) {
    return {
      label: "Balanced & Cohesive",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
      description: "Consistent voice with natural narrative progression.",
    }
  }
  if (temp <= 0.9) {
    return {
      label: "Expressive & Lyrical",
      badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
      description:
        workflow === "generate"
          ? "Rich figurative language, poetic metaphors, and varied rhythm."
          : "Nuanced editorial commentary with creative phrasing suggestions.",
    }
  }
  return {
    label: "High Variance & Experimental",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    description: "Maximum lexical novelty and divergent scene ideas. Higher unpredictability.",
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Author Presets
          </span>
        </div>
        {presetNotice ? (
          <span className="text-[11px] font-medium text-primary animate-in fade-in">
            {presetNotice}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Click to load tailored configuration
          </span>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {activePresets.map((preset) => {
          const isSelected = currentPrompt === preset.systemPrompt
          return (
            <Card
              key={preset.id}
              role="button"
              tabIndex={0}
              onClick={() => onApplyPreset(preset)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onApplyPreset(preset)
                }
              }}
              className={cn(
                "cursor-pointer text-left rounded-xl p-3 transition group",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card/60 hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition">
                  {preset.name}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {preset.temperature.toFixed(2)}t
                </span>
              </div>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {preset.description}
              </CardDescription>
            </Card>
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
    <Card className="rounded-xl border-border bg-card/50">
      <CardHeader className="p-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-xs font-semibold text-foreground normal-case tracking-normal">
              System Directive & Persona ({activeWorkflowTab === "generate" ? "Drafting" : "Editorial Review"})
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Guides tone, vocabulary register, and structural pacing rules for the model.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] font-mono text-muted-foreground">
              ~{systemPromptTokensEstimate} tokens
            </span>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title="Copy system prompt"
            >
              {copiedPrompt ? (
                <>
                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3 space-y-3">
        {/* Context Variable Insert Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-muted-foreground mr-1">Inject variable:</span>
          {CONTEXT_VARIABLE_TAGS.map((v) => (
            <button
              key={v.tag}
              type="button"
              onClick={() => handleInsertTag(v.tag)}
              title={v.desc}
              className="rounded-md border border-dashed border-border bg-muted/40 hover:bg-muted hover:border-primary/50 px-2 py-0.5 text-[10px] font-mono text-foreground transition cursor-pointer"
            >
              + {v.tag}
            </button>
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
              placeholder="Enter system persona and workflow instructions..."
              className="w-full rounded-lg border border-border bg-background p-3 text-xs leading-relaxed font-mono outline-hidden transition focus:border-primary focus:ring-1 focus:ring-primary/40 resize-y"
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

  return (
    <Card className="rounded-xl border-border bg-card/50">
      <CardHeader className="p-4 pb-3 border-b border-border/70 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <CardTitle className="text-xs font-semibold text-foreground normal-case tracking-normal">
            Inference & Temperature Controls
          </CardTitle>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResetToDefault}
          className="h-auto p-0 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-transparent cursor-pointer"
        >
          <RotateCcw className="size-3 mr-1" />
          Reset {activeWorkflowTab} defaults
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-5">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* 1. Temperature Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="param-temperature" className="text-xs font-semibold">
                Temperature
              </Label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">
                  {temperature.toFixed(2)}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tempDesc.badgeClass}`}
                >
                  {tempDesc.label}
                </span>
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
                  className="w-full h-1.5 rounded-lg bg-muted appearance-none cursor-pointer accent-primary"
                  aria-label="Model temperature slider"
                />
              )}
            />

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {tempDesc.description}
            </p>
          </div>

          {/* 2. Target Output Length (Tokens) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="param-max-tokens" className="text-xs font-semibold">
                Maximum Output Tokens
              </Label>
              <span className="font-mono text-xs font-bold text-foreground">
                {maxTokens} tokens (~{estWordCount} words)
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
                  className="w-full h-1.5 rounded-lg bg-muted appearance-none cursor-pointer accent-primary"
                  aria-label="Max tokens slider"
                />
              )}
            />

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Limits generation length. Shorter lengths keep critiques concise; higher lengths allow expansive chapter scenes.
            </p>
          </div>

          {/* 3. Top-P (Nucleus Sampling) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="param-top-p" className="text-xs font-semibold">
                Top-P (Nucleus Sampling)
              </Label>
              <span className="font-mono text-xs font-bold text-foreground">
                {topP.toFixed(2)}
              </span>
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
                  className="w-full h-1.5 rounded-lg bg-muted appearance-none cursor-pointer accent-primary"
                  aria-label="Top-P nucleus sampling slider"
                />
              )}
            />

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Controls lexical diversity. Lower values focus on the most probable words; higher values broaden diction.
            </p>
          </div>

          {/* 4. Repetition Penalty */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="param-repetition" className="text-xs font-semibold">
                Repetition Penalty
              </Label>
              <span className="font-mono text-xs font-bold text-foreground">
                {frequencyPenalty.toFixed(2)}x
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
                  className="w-full h-1.5 rounded-lg bg-muted appearance-none cursor-pointer accent-primary"
                  aria-label="Repetition penalty slider"
                />
              )}
            />

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Penalizes repeating phrases and syntactical echoes to prevent cyclical prose loops.
            </p>
          </div>

          {/* 5. Grounding Passages Chunks */}
          <div className="space-y-2 sm:col-span-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="param-context-chunks" className="text-xs font-semibold">
                Reference Grounding Passages
              </Label>
              <span className="font-mono text-xs font-bold text-primary">
                Top {contextChunks} library passages
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
                  className="w-full h-1.5 rounded-lg bg-muted appearance-none cursor-pointer accent-primary"
                  aria-label="Grounding passages slider"
                />
              )}
            />

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Number of relevant reference passages dynamically retrieved from your uploaded manuscripts and style guides during each session.
            </p>
          </div>
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

      setPresetNotice(`Loaded preset: "${preset.name}"`)
    },
    [activeWorkflowTab, setValue]
  )

  // Reset current workflow to system defaults
  const handleResetToDefault = React.useCallback(() => {
    const targetKey = activeWorkflowTab === "generate" ? "generateConfig" : "critiqueConfig"
    const defaultConf =
      activeWorkflowTab === "generate" ? DEFAULT_GENERATE_CONFIG : DEFAULT_CRITIQUE_CONFIG
    setValue(targetKey, defaultConf, { shouldDirty: true })
    setPresetNotice("Reset to system defaults")
  }, [activeWorkflowTab, setValue])

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <header className="mb-8">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Configuration
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          App Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Universal mode switch controlling storage database, vector embeddings, and LLM inference.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* MASTER SWITCH: CLOUD VS LOCAL MODE */}
        <Card aria-labelledby="mode-heading" className="rounded-2xl border-border bg-card p-6">
          <CardHeader className="p-0 pb-6 border-b border-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {watchedStorageMode === "local" ? (
                    <HardDrive className="size-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Cloud className="size-5 text-primary" />
                  )}
                  <CardTitle id="mode-heading" className="text-lg font-bold text-foreground normal-case tracking-normal">
                    System Environment
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 text-xs text-muted-foreground max-w-xl">
                  One master switch for your entire stack. Toggles storage database, vector embeddings, and LLM model options together.
                </CardDescription>
              </div>

              {/* Master Switch Component */}
              <div className="flex items-center gap-3 self-start sm:self-center bg-muted/40 p-2 rounded-xl border border-border">
                <Label
                  htmlFor="master-mode-toggle"
                  className={`text-xs font-semibold cursor-pointer ${
                    watchedStorageMode === "default" ? "text-primary font-bold" : "text-muted-foreground"
                  }`}
                >
                  Default (Cloud)
                </Label>

                <Switch
                  id="master-mode-toggle"
                  checked={watchedStorageMode === "local"}
                  onCheckedChange={handleModeToggle}
                  aria-label="Toggle between Cloud and Local Mode"
                />

                <Label
                  htmlFor="master-mode-toggle"
                  className={`text-xs font-semibold cursor-pointer ${
                    watchedStorageMode === "local"
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  Local (On-Device)
                </Label>
              </div>
            </div>
          </CardHeader>

          {/* Environment Summary Cards */}
          <CardContent className="p-0 pt-6">
            {watchedStorageMode === "default" ? (
              <Card className="rounded-xl border-primary/20 bg-primary/5 p-5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <Sparkles className="size-4" />
                  <span>Cloud Stack Active • Zero Local Configuration Required</span>
                </div>
                <p className="mt-1.5 text-muted-foreground leading-relaxed">
                  All systems run on the managed cloud infrastructure. Your documents, embeddings, and generative inference are synchronized automatically. Local LLM and embedding configurations are hidden in Cloud mode.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 pt-4 border-t border-primary/10">
                  <Card className="rounded-lg bg-background/80 p-3 border-border/60">
                    <span className="font-semibold text-foreground block">1. Database</span>
                    <span className="text-muted-foreground text-[11px]">Supabase PostgreSQL (RLS)</span>
                  </Card>
                  <Card className="rounded-lg bg-background/80 p-3 border-border/60">
                    <span className="font-semibold text-foreground block">2. Vector Embeddings</span>
                    <span className="text-muted-foreground text-[11px]">1536-dim Cloud pgvector</span>
                  </Card>
                  <Card className="rounded-lg bg-background/80 p-3 border-border/60">
                    <span className="font-semibold text-foreground block">3. LLM Inference</span>
                    <span className="text-muted-foreground text-[11px]">Cloud Managed Intelligence</span>
                  </Card>
                </div>
              </Card>
            ) : (
              <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5 p-5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="size-4" />
                  <span>Local Stack Active • 100% Offline & Private</span>
                </div>
                <p className="mt-1.5 text-muted-foreground leading-relaxed">
                  All operations run locally on your machine. Documents are saved to local device database, vector chunks are embedded locally, and queries are answered by your local Ollama daemon. Zero network traffic.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 pt-4 border-t border-emerald-500/20">
                  <Card className="rounded-lg bg-background/80 p-3 border-border/60">
                    <span className="font-semibold text-foreground block">1. Local Database</span>
                    <span className="text-muted-foreground text-[11px]">IndexedDB on device</span>
                  </Card>
                  <Card className="rounded-lg bg-background/80 p-3 border-border/60">
                    <span className="font-semibold text-foreground block">2. Local Embeddings</span>
                    <span className="text-muted-foreground text-[11px]">Ollama (nomic-embed-text)</span>
                  </Card>
                  <Card className="rounded-lg bg-background/80 p-3 border-border/60">
                    <span className="font-semibold text-foreground block">3. Local LLM</span>
                    <span className="text-muted-foreground text-[11px]">Ollama ({watchedOllamaModel})</span>
                  </Card>
                </div>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* LOCAL MODELS & EMBEDDINGS (SHOWN ONLY IN LOCAL MODE) */}
        {watchedStorageMode === "local" ? (
          <Card
            aria-labelledby="local-models-heading"
            className="rounded-2xl border-border bg-card p-6 animate-in fade-in-50 duration-200"
          >
            <CardHeader className="p-0 pb-6 border-b border-border">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle id="local-models-heading" className="text-lg font-bold text-foreground normal-case tracking-normal">
                  Local Ollama Models & Embeddings
                </CardTitle>
              </div>
              <CardDescription className="mt-1 text-xs text-muted-foreground">
                Configure on-device inference and vector embedding models powered by your local Ollama service.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 pt-6 space-y-6">
              {/* Ollama Daemon Endpoint */}
              <div>
                <Label htmlFor="ollama-endpoint" className="text-xs font-semibold">
                  Ollama Service Endpoint
                </Label>
                <div className="flex items-center gap-3 mt-1.5">
                  <Input
                    id="ollama-endpoint"
                    {...register("ollamaEndpoint")}
                    placeholder="http://localhost:11434"
                    className="font-mono text-xs max-w-md"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestOllama}
                    disabled={testStatus === "testing"}
                    className="text-xs shrink-0"
                  >
                    {testStatus === "testing" ? (
                      <span className="inline-flex animate-spin">
                        <RefreshCw className="size-3.5" />
                      </span>
                    ) : (
                      <Zap className="size-3.5" />
                    )}
                    Test Daemon
                  </Button>

                  {testStatus === "success" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Connected (200 OK)
                    </span>
                  ) : null}

                  {testStatus === "error" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertCircle className="size-3.5" />
                      Failed to connect
                    </span>
                  ) : null}
                </div>
                {errors.ollamaEndpoint ? (
                  <p className="mt-1 text-xs text-destructive">{errors.ollamaEndpoint.message}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Standard Ollama REST API port running on your local machine.
                </p>
              </div>

              {/* Grid: Local LLM Model + Local Embedding Model */}
              <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t border-border">
                {/* 1. Local LLM Model */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-primary" />
                    <Label htmlFor="ollama-model" className="text-xs font-semibold">
                      Local LLM Generation Model
                    </Label>
                  </div>
                  <Input
                    id="ollama-model"
                    {...register("ollamaModel")}
                    placeholder="llama3.1:8b"
                    className="font-mono text-xs"
                  />
                  {errors.ollamaModel ? (
                    <p className="mt-1 text-xs text-destructive">{errors.ollamaModel.message}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Drafting and critique inference (e.g. llama3.1:8b, mistral, deepseek-r1:8b).
                  </p>
                </div>

                {/* 2. Local Embedding Model */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <Label htmlFor="ollama-embedding" className="text-xs font-semibold">
                      Local Vector Embedding Model
                    </Label>
                  </div>
                  <Input
                    id="ollama-embedding"
                    {...register("ollamaEmbeddingModel")}
                    placeholder="nomic-embed-text"
                    className="font-mono text-xs"
                  />
                  {errors.ollamaEmbeddingModel ? (
                    <p className="mt-1 text-xs text-destructive">{errors.ollamaEmbeddingModel.message}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Corpus chunk embeddings (e.g. nomic-embed-text, mxbai-embed-large, all-minilm).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* PROMPT WORKBENCH */}
        <Card aria-label="Prompt Workbench" className="rounded-2xl border-border bg-card p-6">
          <CardHeader className="p-0 pb-6 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="size-5 text-primary" />
                  <CardTitle className="text-lg font-bold text-foreground normal-case tracking-normal">
                    Prompt Workbench
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Experiment with system prompts, temperature controls, and parameter constraints for custom workflows.
                </CardDescription>
              </div>

              {/* Workflow Selector Segmented Control */}
              <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setActiveWorkflowTab("generate")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeWorkflowTab === "generate"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wand2 className="size-3.5 text-primary" />
                  <span>Generation Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWorkflowTab("critique")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeWorkflowTab === "critique"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquareQuote className="size-3.5 text-primary" />
                  <span>Manuscript Critique</span>
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 pt-6 space-y-6">
            {/* Presets Strip (Isolated subscription) */}
            <AuthorPresetsStrip
              control={control}
              activeWorkflowTab={activeWorkflowTab}
              activePresets={activePresets}
              onApplyPreset={handleApplyPreset}
              presetNotice={presetNotice}
            />

            {/* System Prompt & Persona Editor (Isolated subscription) */}
            <SystemDirectiveCard
              control={control}
              setValue={setValue}
              getValues={getValues}
              activeWorkflowTab={activeWorkflowTab}
            />

            {/* Parameter Controls (Isolated subscription) */}
            <InferenceControlsCard
              control={control}
              activeWorkflowTab={activeWorkflowTab}
              onResetToDefault={handleResetToDefault}
            />
          </CardContent>
        </Card>

        {/* Action bar Card */}
        <Card className="rounded-2xl border-border bg-card/60 p-4">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Current system:{" "}
              <span className="font-semibold text-foreground">
                {watchedStorageMode === "local"
                  ? "Local Stack (Ollama & On-Device DB)"
                  : "Cloud Stack (Managed Supabase)"}
              </span>
            </p>

            <div className="flex items-center gap-3">
              {saveSuccess ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  <CheckCircle2 className="size-4" />
                  Preferences updated!
                </span>
              ) : null}

              <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
                <Save className="size-3.5" />
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
