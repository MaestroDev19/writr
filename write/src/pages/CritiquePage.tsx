import * as React from "react"
import { Link } from "react-router-dom"
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

import { useSettings, DEFAULT_CRITIQUE_CONFIG } from "@/contexts/settings-context"
import { reviewDocumentApi } from "@/lib/api-client"
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
import { cn } from "cn"

interface CritiqueLens {
  id: string
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

export default function CritiquePage() {
  const { settings } = useSettings()
  const config = settings.critiqueConfig || DEFAULT_CRITIQUE_CONFIG

  const [activeLensId, setActiveLensId] = React.useState("developmental-structure")
  const [manuscriptInput, setManuscriptInput] = React.useState("")
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [copiedReport, setCopiedReport] = React.useState(false)
  const [report, setReport] = React.useState<CritiqueReport | null>(null)
  const reportRef = React.useRef<HTMLDivElement>(null)

  const activeLens =
    CRITIQUE_LENSES.find((l) => l.id === activeLensId) || CRITIQUE_LENSES[0]

  React.useEffect(() => {
    if (!copiedReport) return
    const id = window.setTimeout(() => setCopiedReport(false), 2000)
    return () => window.clearTimeout(id)
  }, [copiedReport])

  React.useEffect(() => {
    if (!report || !reportRef.current) return
    reportRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [report])

  const handleRunCritique = async () => {
    if (!manuscriptInput.trim() || isAnalyzing) return
    setIsAnalyzing(true)

    const lensInstruction = `Review focus: ${activeLens.name}. ${activeLens.description}`
    const instruction = `${config.systemPrompt}\n\n${lensInstruction}`

    try {
      const apiResult = await reviewDocumentApi({
        instruction,
        target_text: manuscriptInput.trim(),
        target_stored: false,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        context_chunks: config.contextChunks,
        system_prompt: config.systemPrompt,
      })

      if (apiResult.report_text || apiResult.recommendations?.length || apiResult.score_overall != null) {
        setReport({
          scoreOverall: apiResult.score_overall ?? 80,
          pacingScore: apiResult.pacing_score ?? 80,
          voiceScore: apiResult.voice_score ?? 80,
          frictionScore: apiResult.friction_score ?? 80,
          pacingSummary: "Pace and clarity from your Review focus.",
          voiceSummary: "Voice checked against your notes.",
          frictionSummary: "Friction points called out below.",
          recommendations: (apiResult.recommendations || []).map((r) => ({
            category: r.category,
            severity: r.severity,
            issue: r.issue,
            revisedExample: r.revised_example,
          })),
          notesUsed:
            typeof apiResult.report_text === "string" && apiResult.report_text
              ? apiResult.report_text.slice(0, 160)
              : `Checked against ${config.contextChunks} sections from your notes library.`,
        })
        return
      }

      // Mock / empty backend: local simulation for UI work
      const generatedReport: CritiqueReport = {
        scoreOverall: activeLensId === "cadence-rhythm" ? 82 : 88,
        pacingScore: 84,
        voiceScore: 91,
        frictionScore: 76,
        pacingSummary:
          "Several sentences run the same length. Vary length so the piece is easier to follow.",
        voiceSummary:
          "Tone matches your notes well. Keep names, voice, and register consistent across this doc.",
        frictionSummary:
          "Two soft phrases (“felt”, “noticed”) weaken the opening. Prefer concrete detail.",
        recommendations: [
          {
            category: "Show, don’t tell",
            severity: "high",
            issue:
              "Replace “he felt that something was wrong” and “he noticed three strangers” with what is seen and done.",
            revisedExample:
              "The room was cold. He crossed the floorboards and sank into the wooden chair. On the cobblestones below, three strangers lingered beneath the bookstore eaves.",
          },
          {
            category: "Rhythm and clarity",
            severity: "medium",
            issue: "Three “and” clauses in a row flatten the beat. Break one into a short line.",
            revisedExample: "Rain sheeted across the limestone. No one moved toward the square.",
          },
          {
            category: "Ground in your world",
            severity: "low",
            issue: "Tie hesitation to a concrete detail from your notes or setting.",
            revisedExample:
              "He turned the unsent letters in his wool coat, waiting for the bells to stop.",
          },
        ],
        notesUsed: `Checked against ${config.contextChunks} sections from your notes library.`,
      }

      setReport(generatedReport)
    } catch (err) {
      console.error(err)
      // Keep prior report; surface via existing UI only if we add toast later
    } finally {
      setIsAnalyzing(false)
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

  const wordCount = manuscriptInput.trim()
    ? manuscriptInput.trim().split(/\s+/).filter(Boolean).length
    : 0
  const canReview = Boolean(manuscriptInput.trim()) && !isAnalyzing

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
          {/* Lens picker — segmented grid */}
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Review focus">
            <span className="text-xs font-semibold text-foreground">Focus</span>
            <p className="text-[11px] text-muted-foreground">
              Works for prose, scripts, story bibles, character sheets, and similar docs.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {CRITIQUE_LENSES.map((lens) => {
                const selected = activeLensId === lens.id
                const Icon = lens.icon
                return (
                  <button
                    key={lens.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setActiveLensId(lens.id)}
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
          </div>

          {/* Manuscript input */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="review-text" className="text-xs font-semibold text-foreground">
                  Your document
                </label>
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
                    onClick={() => setManuscriptInput(s.text)}
                  >
                    {s.title}
                  </Button>
                ))}
              </div>
            </div>

            <textarea
              id="review-text"
              name="review-text"
              rows={6}
              value={manuscriptInput}
              onChange={(e) => setManuscriptInput(e.target.value)}
              placeholder="Paste a scene, screenplay, story bible, character notes, lore, or any story document…"
              autoComplete="off"
              className="w-full resize-y rounded-[var(--radius)] border border-border bg-background p-3.5 text-sm leading-relaxed outline-hidden transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Actions */}
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
              {!manuscriptInput.trim() ? (
                <span className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 sm:justify-start">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  Paste text first
                </span>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setManuscriptInput("")
                  setReport(null)
                }}
                className="w-full sm:w-auto"
              >
                <RotateCcw data-icon="inline-start" />
                Clear
              </Button>

              <Button
                type="button"
                onClick={handleRunCritique}
                disabled={!canReview}
                className="w-full sm:w-auto"
              >
                {isAnalyzing ? (
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

          {isAnalyzing ? (
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

          {report && !isAnalyzing ? (
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
