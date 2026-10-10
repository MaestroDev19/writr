import * as React from "react"
import { Link } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  MessageSquareQuote,
  CheckCircle2,
  FileText,
  ArrowRight,
  Check,
  Copy,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Feather,
  Compass,
  BookOpen,
  AlertCircle,
} from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { critiqueAgentMutation } from "@/api"
import { MAX_AGENT_CONTENT_CHARS } from "@/api/limits"
import { getApiErrorMessage } from "@/lib/axios"
import { agentContentTooLong } from "@/lib/agent-content"
import { critiquePromptBuilder } from "@/lib/user_prompt_builder"
import { logError, sha256Hex } from "@/lib/log"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { cn } from "cn"

const CRITIQUE_LENS_IDS = [
  "developmental-structure",
  "cadence-rhythm",
  "voice-consistency",
  "line-edit-polish",
] as const

const critiqueFormSchema = z.object({
  manuscript: z.string().trim().min(1, "Paste text first"),
  lensId: z.enum(CRITIQUE_LENS_IDS),
})

type CritiqueFormValues = z.infer<typeof critiqueFormSchema>

interface CritiqueLens {
  id: (typeof CRITIQUE_LENS_IDS)[number]
  name: string
  short: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const CRITIQUE_LENSES: CritiqueLens[] = [
  {
    id: "developmental-structure",
    name: "Structure",
    short: "Organization",
    icon: Compass,
    description: "Order, gaps, and how sections hang together in any story doc or script.",
  },
  {
    id: "cadence-rhythm",
    name: "Flow",
    short: "Readability",
    icon: Feather,
    description: "Clarity, pacing, and how easy the text is to follow aloud or on the page.",
  },
  {
    id: "voice-consistency",
    name: "Voice",
    short: "Tone match",
    icon: Sparkles,
    description: "Tone, character voice, and consistency with your notes across docs.",
  },
  {
    id: "line-edit-polish",
    name: "Line polish",
    short: "Wording",
    icon: FileText,
    description: "Tighten wording, cut filler, and clean lines in prose or scripts.",
  },
]

function critiqueRequest(lens: CritiqueLens, manuscript: string) {
  return {
    userInput: `Review with focus on ${lens.name}. Prefer concrete, local fixes.`,
    fileContent: manuscript,
    lens: `${lens.name}. ${lens.description}`,
  }
}

const SAMPLE_MANUSCRIPTS = [
  {
    title: "Sample A",
    text: "He walked quickly into the cold room and sat down heavily on the old wooden chair, wondering what to say next. Outside, the rain was falling hard on the cobblestones. He felt that something was wrong with the meeting, and he noticed three strangers lingering under the bookstore eaves.",
  },
  {
    title: "Sample B",
    text: "The silence between them tasted of iron filings and wet limestone. For four months, Nicolas had carried the sealed ledger inside his oilcloth vest without breaking the wax seal, yet Claire looked through him as if the paper were already transparent.",
  },
]

interface CritiqueReport {
  scoreOverall: number
  pacingScore: number
  voiceScore: number
  frictionScore: number
  pacingSummary: string
  voiceSummary: string
  frictionSummary: string
  recommendations: Array<{
    category: string
    severity: "high" | "medium" | "low"
    issue: string
    revisedExample: string
  }>
  notesUsed: string
}

function parseCritiqueAgentResponse(
  raw: string,
  lensName: string
): CritiqueReport {
  const trimmed = raw.trim()
  try {
    const parsed = JSON.parse(trimmed) as {
      score_overall?: number
      pacing_score?: number
      voice_score?: number
      friction_score?: number
      pacing_summary?: string
      voice_summary?: string
      friction_summary?: string
      recommendations?: Array<{
        category?: string
        severity?: "high" | "medium" | "low"
        issue?: string
        revised_example?: string
      }>
      report_text?: string
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed.score_overall != null || parsed.recommendations?.length)
    ) {
      return {
        scoreOverall: parsed.score_overall ?? 0,
        pacingScore: parsed.pacing_score ?? 0,
        voiceScore: parsed.voice_score ?? 0,
        frictionScore: parsed.friction_score ?? 0,
        pacingSummary: parsed.pacing_summary ?? "Pace and clarity from your Review focus.",
        voiceSummary: parsed.voice_summary ?? "Voice checked against your notes.",
        frictionSummary: parsed.friction_summary ?? "Friction points called out below.",
        recommendations: (parsed.recommendations ?? []).map((r) => ({
          category: r.category ?? lensName,
          severity: r.severity ?? "medium",
          issue: r.issue ?? "",
          revisedExample: r.revised_example ?? "",
        })),
        notesUsed:
          typeof parsed.report_text === "string" && parsed.report_text
            ? parsed.report_text.slice(0, 160)
            : "Grounded in your notes library when matches were found.",
      }
    }
  } catch {
    // Prose / TOON response — surface as one suggestion block.
  }

  return {
    scoreOverall: 0,
    pacingScore: 0,
    voiceScore: 0,
    frictionScore: 0,
    pacingSummary: "See suggestions below.",
    voiceSummary: "See suggestions below.",
    frictionSummary: "See suggestions below.",
    recommendations: [
      {
        category: lensName,
        severity: "medium",
        issue: trimmed || "No feedback returned.",
        revisedExample: "Apply the note above to a local passage, then re-run Review.",
      },
    ],
    notesUsed: "Writr Review response",
  }
}

function ScoreMeter({
  label,
  score,
  summary,
  tone,
}: {
  label: string
  score: number
  summary: string
  tone: "emerald" | "primary" | "amber"
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
        : "border-primary/30 bg-primary/5 text-primary"

  const barClass =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-primary"

  return (
    <div className={cn("flex flex-col gap-2 rounded-[var(--radius)] border p-4", toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-sm font-bold tabular-nums">{score}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-background/60"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} score`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", barClass)}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{summary}</p>
    </div>
  )
}

function ManuscriptField({
  control,
  register,
  setValue,
  disabled,
  error,
}: {
  control: Control<CritiqueFormValues>
  register: ReturnType<typeof useForm<CritiqueFormValues>>["register"]
  setValue: UseFormSetValue<CritiqueFormValues>
  disabled: boolean
  error?: string
}) {
  const manuscript = useWatch({ control, name: "manuscript" }) ?? ""
  const wordCount = manuscript.trim()
    ? manuscript.trim().split(/\s+/).filter(Boolean).length
    : 0

  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FieldLabel
            htmlFor="review-text"
            className="text-xs font-semibold normal-case tracking-normal"
          >
            Your document
          </FieldLabel>
          <Badge variant="outline" className="tabular-nums">
            {wordCount} words
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Try a sample:</span>
          {SAMPLE_MANUSCRIPTS.map((s) => (
            <Button
              key={s.title}
              type="button"
              variant="outline"
              size="xs"
              disabled={disabled}
              onClick={() =>
                setValue("manuscript", s.text, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              {s.title}
            </Button>
          ))}
        </div>
      </div>

      <textarea
        id="review-text"
        rows={6}
        disabled={disabled}
        placeholder="Paste a scene, screenplay, story bible, character notes, lore, or any story document…"
        autoComplete="off"
        aria-invalid={Boolean(error) || undefined}
        className="w-full resize-y rounded-[var(--radius)] border border-border bg-background p-3.5 text-sm leading-relaxed outline-hidden transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        {...register("manuscript")}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function ReviewActions({
  control,
  busy,
  onClear,
}: {
  control: Control<CritiqueFormValues>
  busy: boolean
  onClear: () => void
}) {
  const manuscript = useWatch({ control, name: "manuscript" }) ?? ""
  const lensId = useWatch({ control, name: "lensId" }) ?? "developmental-structure"
  const activeLens =
    CRITIQUE_LENSES.find((lens) => lens.id === lensId) || CRITIQUE_LENSES[0]

  const contentTooLong = React.useMemo(() => {
    const draft = manuscript.trim()
    if (!draft) return false
    try {
      return agentContentTooLong(critiquePromptBuilder(critiqueRequest(activeLens, draft)))
    } catch {
      return false
    }
  }, [activeLens, manuscript])

  const canReview = !busy && !contentTooLong

  return (
    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button
        variant="outline"
        size="sm"
        render={<Link to="/dashboard#notes" />}
        className="w-full sm:w-auto"
      >
        <BookOpen data-icon="inline-start" />
        Add notes
      </Button>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {contentTooLong ? (
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 sm:max-w-xs sm:justify-start">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            Document and focus must stay under {MAX_AGENT_CONTENT_CHARS.toLocaleString()}{" "}
            characters.
          </span>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="w-full sm:w-auto"
          disabled={busy}
        >
          <RotateCcw data-icon="inline-start" />
          Clear
        </Button>

        <Button type="submit" disabled={!canReview} className="w-full sm:w-auto">
          {busy ? (
            <>
              <RefreshCw data-icon="inline-start" className="animate-spin" />
              Reviewing…
            </>
          ) : (
            <>
              <MessageSquareQuote data-icon="inline-start" />
              Get {activeLens.name.toLowerCase()} feedback
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default function CritiquePage() {
  const { user } = useAuth()

  const [copiedReport, setCopiedReport] = React.useState(false)
  const [report, setReport] = React.useState<CritiqueReport | null>(null)
  const reportRef = React.useRef<HTMLDivElement>(null)

  const critiqueMutation = useMutation({ ...critiqueAgentMutation })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { isSubmitting, errors },
  } = useForm<CritiqueFormValues>({
    resolver: zodResolver(critiqueFormSchema),
    defaultValues: {
      manuscript: "",
      lensId: "developmental-structure",
    },
    mode: "onSubmit",
  })

  const busy = isSubmitting || critiqueMutation.isPending
  const lensId = useWatch({ control, name: "lensId" }) ?? "developmental-structure"
  const activeLens =
    CRITIQUE_LENSES.find((l) => l.id === lensId) || CRITIQUE_LENSES[0]

  React.useEffect(() => {
    if (!copiedReport) return
    const id = window.setTimeout(() => setCopiedReport(false), 2000)
    return () => window.clearTimeout(id)
  }, [copiedReport])

  React.useEffect(() => {
    if (!report || !reportRef.current) return
    reportRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [report])

  const onSubmit = async (data: CritiqueFormValues) => {
    clearErrors("root.serverError")

    const lens =
      CRITIQUE_LENSES.find((l) => l.id === data.lensId) || CRITIQUE_LENSES[0]

    try {
      const content = critiquePromptBuilder(critiqueRequest(lens, data.manuscript))
      const { response } = await critiqueMutation.mutateAsync(content)
      setReport(parseCritiqueAgentResponse(response, lens.name))
    } catch (err) {
      const failedRequestId =
        err &&
        typeof err === "object" &&
        "requestId" in err &&
        typeof err.requestId === "string"
          ? err.requestId
          : undefined
      logError({
        operation: "critique_analyze",
        user_id: user?.id,
        request_id: failedRequestId,
        manuscript_sha256: await sha256Hex(data.manuscript),
        error_type: err instanceof Error ? err.name : "CritiqueError",
        error_message: err instanceof Error ? err.message : "critique_failed",
      })
      setError("root.serverError", {
        type: "server",
        message: getApiErrorMessage(err, "Review failed — please retry"),
      })
    }
  }

  const handleCopyReport = async () => {
    if (!report) return
    const formatted = `## Review (${activeLens.name})\nOverall: ${report.scoreOverall}/100\n- Pace: ${report.pacingScore}\n- Voice: ${report.voiceScore}\n- Clarity: ${report.frictionScore}\n\n### Suggestions\n${report.recommendations.map((r) => `- [${r.category}] ${r.issue}\n  Try: "${r.revisedExample}"`).join("\n")}`

    try {
      await navigator.clipboard.writeText(formatted)
      setCopiedReport(true)
    } catch {
      setCopiedReport(true)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Review your writing
        </h1>
        <p className="max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
          Paste a scene, script, story bible, character sheet, or other story doc. Pick a focus. Get clear feedback grounded in your notes.
        </p>
      </header>

      <Card className="rounded-[var(--radius-xl)] border-border bg-card shadow-xs">
        <CardHeader className="gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                <MessageSquareQuote className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold normal-case tracking-normal text-pretty">
                  What should we look at?
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Focus adapts to scenes, scripts, bibles, character notes, and other docs.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/settings" />}
              className="self-start text-muted-foreground"
            >
              <Settings data-icon="inline-start" />
              Settings
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 pt-5">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-6"
            noValidate
          >
            <FieldGroup className="gap-6">
              <Controller
                control={control}
                name="lensId"
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid || undefined}
                    role="radiogroup"
                    aria-label="Review focus"
                  >
                    <FieldLabel className="text-xs font-semibold normal-case tracking-normal">
                      Focus
                    </FieldLabel>
                    <p className="text-[11px] text-muted-foreground">
                      Works for prose, scripts, story bibles, character sheets, and similar docs.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {CRITIQUE_LENSES.map((lens) => {
                        const selected = field.value === lens.id
                        const Icon = lens.icon
                        return (
                          <button
                            key={lens.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={busy}
                            onClick={() =>
                              field.onChange(lens.id)
                            }
                            className={cn(
                              "flex min-h-[4.5rem] flex-col items-start gap-1 rounded-[var(--radius)] border p-3 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                            )}
                          >
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Icon
                                className={cn(
                                  "size-3.5",
                                  selected ? "text-primary" : "text-muted-foreground"
                                )}
                                aria-hidden="true"
                              />
                              {lens.name}
                            </span>
                            <span className="text-[11px] leading-snug text-muted-foreground">
                              {lens.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </Field>
                )}
              />

              {errors.root?.serverError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 text-xs font-medium text-amber-700 dark:text-amber-400"
                >
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errors.root.serverError.message}</span>
                </div>
              ) : null}

              <ManuscriptField
                control={control}
                register={register}
                setValue={setValue}
                disabled={busy}
                error={errors.manuscript?.message}
              />
            </FieldGroup>

            {/* Actions */}
            <ReviewActions
              control={control}
              busy={busy}
              onClear={() => {
                reset({ manuscript: "", lensId })
                setReport(null)
                clearErrors()
              }}
            />
          </form>

          {busy ? (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-3 rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <RefreshCw className="size-4 animate-spin text-primary" aria-hidden="true" />
                Reading your document and notes…
              </div>
              <div className="flex flex-col gap-2" aria-hidden="true">
                <div className="h-3 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-primary/15" />
                <div className="h-3 w-full animate-pulse rounded-[var(--radius-sm)] bg-primary/10" />
                <div className="h-3 w-5/6 animate-pulse rounded-[var(--radius-sm)] bg-primary/10" />
              </div>
            </div>
          ) : null}

          {report && !busy ? (
            <div
              ref={reportRef}
              className="flex scroll-mt-24 flex-col gap-4 border-t border-border pt-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Feedback · {activeLens.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">{report.notesUsed}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    Overall {report.scoreOverall}
                  </Badge>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyReport}>
                    {copiedReport ? (
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

              <div className="grid gap-3 sm:grid-cols-3">
                <ScoreMeter
                  label="Pace"
                  score={report.pacingScore}
                  summary={report.pacingSummary}
                  tone="emerald"
                />
                <ScoreMeter
                  label="Voice"
                  score={report.voiceScore}
                  summary={report.voiceSummary}
                  tone="primary"
                />
                <ScoreMeter
                  label="Clarity"
                  score={report.frictionScore}
                  summary={report.frictionSummary}
                  tone="amber"
                />
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Suggestions
                </h3>

                <ul className="flex flex-col gap-3">
                  {report.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-background/80 p-3.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{rec.category}</span>
                        <Badge
                          variant={rec.severity === "high" ? "destructive" : "secondary"}
                        >
                          {rec.severity === "high"
                            ? "High impact"
                            : rec.severity === "medium"
                              ? "Worth fixing"
                              : "Polish"}
                        </Badge>
                      </div>
                      <p className="leading-relaxed text-muted-foreground">{rec.issue}</p>
                      <blockquote className="rounded-[var(--radius-sm)] border border-border/60 bg-muted/40 p-2.5 leading-relaxed text-foreground">
                        <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Try this
                        </span>
                        “{rec.revisedExample}”
                      </blockquote>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-col items-start justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>Want different feedback style?</span>
          <Button
            variant="link"
            size="sm"
            render={<Link to="/settings" />}
            className="h-auto p-0"
          >
            Open Settings
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
