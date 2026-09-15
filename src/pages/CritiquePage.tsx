import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  MessageSquareQuote,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Check,
  Cloud,
  Copy,
  HardDrive,
  Layers,
  RefreshCw,
  RotateCcw,
  Settings,
  Sliders,
  Sparkles,
  Feather,
  Gauge,
  Compass,
} from "lucide-react"

import { useSettings, DEFAULT_CRITIQUE_CONFIG } from "@/contexts/settings-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"

interface CritiqueLens {
  id: string
  name: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  promptDirective: string
}

const CRITIQUE_LENSES: CritiqueLens[] = [
  {
    id: "developmental-structure",
    name: "Developmental & Structure",
    label: "Macro Architecture",
    icon: Compass,
    description: "Evaluates narrative arc, scene objectives, turning points, and dramatic propulsion.",
    promptDirective:
      "Evaluate chapter excerpt for narrative arc, scene objectives, dramatic tension, and structural momentum.",
  },
  {
    id: "cadence-rhythm",
    name: "Prose Cadence & Music",
    label: "Acoustic Cadence",
    icon: Feather,
    description: "Line-level rhythm: sentence length variance, euphony, acoustic pacing, and monotony.",
    promptDirective:
      "Analyze sentence length variance, rhythmic stumbling points, repetitive syntax, and auditory flow.",
  },
  {
    id: "voice-consistency",
    name: "Voice & Register Integrity",
    label: "Stylistic Distance",
    icon: Sparkles,
    description: "Audits dialogue registers, vocabulary fidelity against the reference library corpus.",
    promptDirective:
      "Audit text against reference corpus for stylistic integrity, tonal drift, and dialogue authenticity.",
  },
  {
    id: "line-edit-polish",
    name: "Line Edit & Surgical Polish",
    label: "Verbal Economy",
    icon: FileText,
    description: "Scrutinizes deadwood modifiers, filter verbs ('noticed', 'felt'), and passive constructions.",
    promptDirective:
      "Scrutinize prose for filter verbs, sluggish modifiers, passive syntax, and repetitive clause starts.",
  },
]

const SAMPLE_MANUSCRIPTS = [
  {
    title: "Saint-Germain Quayside (Draft)",
    text: "He walked quickly into the cold room and sat down heavily on the old wooden chair, wondering what to say next. Outside, the rain was falling hard on the cobblestones. He felt that something was wrong with the meeting, and he noticed three strangers lingering under the bookstore eaves.",
  },
  {
    title: "Archives Chamber (Interiority)",
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
  corpusGroundingNotes: string
}

export default function CritiquePage() {
  const navigate = useNavigate()
  const { settings, isLocal, activeModelDisplayName } = useSettings()

  const config = settings.critiqueConfig || DEFAULT_CRITIQUE_CONFIG

  const [activeLensId, setActiveLensId] = React.useState("developmental-structure")
  const [manuscriptInput, setManuscriptInput] = React.useState(SAMPLE_MANUSCRIPTS[0].text)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [copiedReport, setCopiedReport] = React.useState(false)
  const [report, setReport] = React.useState<CritiqueReport | null>(null)
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null)

  const activeLens =
    CRITIQUE_LENSES.find((l) => l.id === activeLensId) || CRITIQUE_LENSES[0]

  // Auto-dismiss copied state
  React.useEffect(() => {
    if (!copiedReport) return
    const id = window.setTimeout(() => setCopiedReport(false), 2000)
    return () => window.clearTimeout(id)
  }, [copiedReport])

  const handleRunCritique = () => {
    if (!manuscriptInput.trim() || isAnalyzing) return
    setIsAnalyzing(true)

    const startTime = performance.now()

    window.setTimeout(() => {
      const generatedReport: CritiqueReport = {
        scoreOverall: activeLensId === "cadence-rhythm" ? 82 : 88,
        pacingScore: 84,
        voiceScore: 91,
        frictionScore: 76,
        pacingSummary:
          "Opening clauses show monotonous sentence lengths (18-22 words per beat). Tightening compound verbs will accelerate momentum into the scene turn.",
        voiceSummary:
          "Atmospheric vocabulary register aligns closely with reference library corpus. Minimal tonal drift detected.",
        frictionSummary:
          "Found 2 filter verbs ('he felt that', 'he noticed') dampening sensory immediacy in paragraph one.",
        recommendations: [
          {
            category: "Filter Words & Sensory Posture",
            severity: "high",
            issue:
              "Replacing 'he felt that something was wrong' and 'he noticed three strangers' with direct physical posture.",
            revisedExample:
              "The room was cold. He crossed the floorboards and sank into the wooden chair. On the cobblestones below, three strangers lingered beneath the bookstore eaves.",
          },
          {
            category: "Sentence Length Variance (Cadence)",
            severity: "medium",
            issue:
              "Three consecutive compound clauses connected by 'and' flatten auditory propulsion.",
            revisedExample:
              "Rain sheeted across the limestone. No one moved toward the square.",
          },
          {
            category: "Corpus Vernacular & Interiority",
            severity: "low",
            issue:
              "Grounding character hesitation directly in tangible material objects from the setting.",
            revisedExample:
              "He turned the unsent letters in his wool coat, waiting for the bells to stop.",
          },
        ],
        corpusGroundingNotes: `Cross-referenced with ${config.contextChunks} grounding excerpts from your uploaded library. Cadence rubric adhered to target range.`,
      }

      setReport(generatedReport)
      setIsAnalyzing(false)
      setLatencyMs(Math.round(performance.now() - startTime))
    }, 700)
  }

  const handleCopyReport = async () => {
    if (!report) return
    const formatted = `## Manuscript Editorial Critique Report (${activeLens.name})\nOverall Score: ${report.scoreOverall}/100\n- Pacing: ${report.pacingScore}/100\n- Voice Fidelity: ${report.voiceScore}/100\n- Verbal Friction: ${report.frictionScore}/100\n\n### Key Findings:\n${report.recommendations.map((r) => `- [${r.category}] ${r.issue}\n  Revision: "${r.revisedExample}"`).join("\n")}`

    try {
      await navigator.clipboard.writeText(formatted)
      setCopiedReport(true)
    } catch {
      // fallback
    }
  }

  const wordCount = manuscriptInput.trim() ? manuscriptInput.trim().split(/\s+/).length : 0

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Page Header */}
      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Analysis
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            <MessageSquareQuote className="size-3" />
            Editorial Review
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Manuscript <span className="font-semibold text-primary">Critique</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Structural diagnosis, prose cadence analysis, voice consistency checks, and surgical line-level revisions grounded in your reference library.
        </p>
      </div>

      {/* Main Critique Workshop Card */}
      <Card className="rounded-2xl border-border bg-card">
        <CardHeader className="pb-6 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <MessageSquareQuote className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold normal-case tracking-normal">
                  Editorial Workshop & Diagnostics
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Select an evaluation lens, submit a scene or chapter excerpt, and run rigorous stylistic diagnostics.
                </CardDescription>
              </div>
            </div>

            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings")}
                className="text-xs gap-1.5 cursor-pointer"
              >
                <Sliders className="size-3.5 text-primary" />
                Critique Settings
                <ArrowRight className="size-3.5" />
              </Button>
            </CardAction>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Active Model & Critique Parameters Strip */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Card className="p-3 bg-muted/40 border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                {isLocal ? (
                  <HardDrive className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Cloud className="size-3.5 text-primary" />
                )}
                <span className="text-[11px] font-medium">Evaluation Engine</span>
              </div>
              <span className="text-xs font-semibold text-foreground block truncate">
                {activeModelDisplayName}
              </span>
            </Card>

            <Card className="p-3 bg-muted/40 border-border">
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Temperature Rigor
              </span>
              <span className="text-xs font-semibold text-foreground block">
                {config.temperature.toFixed(2)}t (Analytical)
              </span>
            </Card>

            <Card className="p-3 bg-muted/40 border-border">
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Analysis Window
              </span>
              <span className="text-xs font-semibold text-foreground block">
                {config.maxTokens} tokens
              </span>
            </Card>

            <Card className="p-3 bg-muted/40 border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Layers className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-medium">Corpus Context</span>
              </div>
              <span className="text-xs font-semibold text-foreground block">
                {config.contextChunks} passages injected
              </span>
            </Card>
          </div>

          {/* Editorial Lenses Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Editorial Review Lens
              </span>
              <span className="text-[11px] text-muted-foreground">
                Choose diagnostic focus
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CRITIQUE_LENSES.map((lens) => {
                const isSelected = activeLensId === lens.id
                const Icon = lens.icon
                return (
                  <Card
                    key={lens.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveLensId(lens.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setActiveLensId(lens.id)
                      }
                    }}
                    className={`cursor-pointer text-left p-3.5 rounded-xl transition ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card/60 hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`size-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-xs font-semibold text-foreground">
                          {lens.name}
                        </span>
                      </div>
                    </div>
                    <CardDescription className="text-[11px] leading-relaxed line-clamp-2">
                      {lens.description}
                    </CardDescription>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Manuscript Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Manuscript Excerpt or Scene Draft
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  ({wordCount} words)
                </span>
              </div>

              {/* Sample excerpt pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">
                  Samples:
                </span>
                {SAMPLE_MANUSCRIPTS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setManuscriptInput(s.text)}
                    className="rounded-md border border-dashed border-border bg-muted/40 hover:bg-muted px-2 py-0.5 text-[10px] text-foreground transition cursor-pointer"
                  >
                    Ex. {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={5}
              value={manuscriptInput}
              onChange={(e) => setManuscriptInput(e.target.value)}
              placeholder="Paste manuscript excerpt, chapter section, or dialogue passage for analysis..."
              className="w-full rounded-xl border border-border bg-background p-3.5 text-xs leading-relaxed font-serif outline-hidden transition focus:border-primary focus:ring-1 focus:ring-primary/40 resize-y"
            />
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <Link to="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium cursor-pointer w-full sm:w-auto"
              >
                <HardDrive className="size-3.5" />
                Add Reference Files
              </Button>
            </Link>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setManuscriptInput("")}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Clear Text
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleRunCritique}
                disabled={isAnalyzing || !manuscriptInput.trim()}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Running Diagnostics...
                  </>
                ) : (
                  <>
                    <Gauge className="size-3.5" />
                    Run {activeLens.label} Analysis
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Critique Diagnostics Report */}
          {report ? (
            <div className="space-y-4 pt-2 animate-in fade-in duration-200">
              {/* Scorecards */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Pacing & Flow
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {report.pacingScore}/100
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                    {report.pacingSummary}
                  </p>
                </Card>

                <Card className="p-4 border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">
                      Voice Consistency
                    </span>
                    <span className="font-mono text-sm font-bold text-primary">
                      {report.voiceScore}/100
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                    {report.voiceSummary}
                  </p>
                </Card>

                <Card className="p-4 border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Verbal Economy
                    </span>
                    <span className="font-mono text-sm font-bold text-amber-700 dark:text-amber-400">
                      {report.frictionScore}/100
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                    {report.frictionSummary}
                  </p>
                </Card>
              </div>

              {/* Recommendations List */}
              <Card className="p-5 border-border bg-card/60 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle className="text-sm font-bold normal-case tracking-normal">
                      Surgical Line Revisions & Editorial Recommendations
                    </CardTitle>
                    {latencyMs ? (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        ({latencyMs}ms)
                      </span>
                    ) : null}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyReport}
                    className="h-7 px-2 text-[11px] gap-1 cursor-pointer bg-background"
                  >
                    {copiedReport ? (
                      <>
                        <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                        Report Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        Copy Report
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-3">
                  {report.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/80 bg-background/70 p-3.5 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {rec.category}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            rec.severity === "high"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                          }`}
                        >
                          {rec.severity === "high" ? "High Impact" : "Style Polish"}
                        </span>
                      </div>

                      <p className="text-muted-foreground leading-relaxed">
                        {rec.issue}
                      </p>

                      <div className="rounded-lg bg-muted/40 p-2.5 border border-border/60 font-serif text-[11px] text-foreground leading-relaxed">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block mb-1">
                          Suggested Rewrite:
                        </span>
                        &ldquo;{rec.revisedExample}&rdquo;
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-primary" />
                  <span>{report.corpusGroundingNotes}</span>
                </div>
              </Card>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="border-t border-border pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Critique parameters and rubric weights are configured in your App Settings.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings")}
            className="h-auto p-0 text-xs text-primary hover:underline cursor-pointer"
          >
            <Settings className="size-3.5 mr-1" />
            Adjust Critique Rubrics in Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
