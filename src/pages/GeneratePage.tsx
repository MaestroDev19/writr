import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Sparkles,
  Sliders,
  ArrowRight,
  Settings,
  Copy,
  Check,
  HardDrive,
  Cloud,
  Layers,
  Wand2,
  RefreshCw,
  RotateCcw,
} from "lucide-react"

import { useSettings, DEFAULT_GENERATE_CONFIG } from "@/contexts/settings-context"
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

function getTemperatureBadge(temp: number) {
  if (temp <= 0.3) {
    return {
      label: "Strict & Analytical",
      badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    }
  }
  if (temp <= 0.6) {
    return {
      label: "Balanced & Cohesive",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    }
  }
  if (temp <= 0.9) {
    return {
      label: "Expressive & Lyrical",
      badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    }
  }
  return {
    label: "High Variance",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  }
}

const PROMPT_STARTERS = [
  "The bells of Saint-Germain rang three times into the dusk, but no one moved toward the square.",
  "Under the flickering arc lamps of the quay, Nicolas searched the water for the courier's skiff.",
  "The archives were colder than the street, smelling of vinegar, dry parchment, and damp wool.",
]

export default function GeneratePage() {
  const navigate = useNavigate()
  const { settings, isLocal, activeModelDisplayName } = useSettings()

  const config = settings.generateConfig || DEFAULT_GENERATE_CONFIG
  const tempDesc = getTemperatureBadge(config.temperature)

  const [inputPrompt, setInputPrompt] = React.useState(PROMPT_STARTERS[0])
  const [outputResult, setOutputResult] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [metrics, setMetrics] = React.useState<{
    tokens: number
    latencyMs: number
  } | null>(null)

  // Auto-dismiss copy state
  React.useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  const handleGenerate = () => {
    if (!inputPrompt.trim() || isGenerating) return
    setIsGenerating(true)

    const startTime = performance.now()

    window.setTimeout(() => {
      const generatedProse =
        config.temperature >= 0.8
          ? `${inputPrompt.trim()}\n\nThe sound did not ring so much as dissolve, falling like grit through the gray drizzle that had varnished the cobblestones since midday.\n\nFrom the narrow stoop of the apothecary, Nicolas watched the iron hands slip past the roman numeral without pausing. A cart rattled along the quay—dry hubs screaming on ungreased axles—carrying barrels of salted cod wrapped in tarpaulin. No one ran. In this quarter, news arrived not by messenger or herald, but by the gradual evaporation of rumor, leaving behind only the sediment of what everyone had already feared.`
          : `${inputPrompt.trim()}\n\nThe resonance hung low over the slate rooftops, dampened by river mist. Along the rue des Carmes, shopkeepers pulled their shutters inward and slid iron bolts into oak sills.\n\nNicolas remained beneath the eaves of the bookstore, his collar pulled high against the damp. He had three letters tucked into his wool coat, none of them signed, and forty minutes before the curfew lantern was raised above the bridge gate.`

      setOutputResult(generatedProse)
      setIsGenerating(false)
      setMetrics({
        tokens: Math.round(generatedProse.split(/\s+/).length * 1.3),
        latencyMs: Math.round(performance.now() - startTime),
      })
    }, 650)
  }

  const handleCopy = async () => {
    if (!outputResult) return
    try {
      await navigator.clipboard.writeText(outputResult)
      setCopied(true)
    } catch {
      // fallback
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Studio
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            <Sparkles className="size-3" />
            AI Writer
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Content <span className="font-semibold text-primary">Generation</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Craft essays, manuscripts, and narrative drafts with intelligent context steering and multi-model synthesis.
        </p>
      </div>

      {/* Actual Prompt Workbench Card */}
      <Card className="rounded-2xl border-border bg-card">
        <CardHeader className="pb-6 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Sparkles className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold normal-case tracking-normal">
                  Prompt Workbench
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Experiment with system personas, model temperature controls, and parameter constraints for active generation.
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
                Configure Parameters
                <ArrowRight className="size-3.5" />
              </Button>
            </CardAction>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Active Model & Generation Parameters Strip */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Card className="p-3 bg-muted/40 border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                {isLocal ? (
                  <HardDrive className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Cloud className="size-3.5 text-primary" />
                )}
                <span className="text-[11px] font-medium">Inference Engine</span>
              </div>
              <span className="text-xs font-semibold text-foreground block truncate">
                {activeModelDisplayName}
              </span>
            </Card>

            <Card className="p-3 bg-muted/40 border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-muted-foreground">Temperature</span>
                <span className={`rounded-full border px-1.5 py-0.2 text-[9px] font-medium ${tempDesc.badgeClass}`}>
                  {config.temperature.toFixed(2)}t
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground block truncate">
                {tempDesc.label}
              </span>
            </Card>

            <Card className="p-3 bg-muted/40 border-border">
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Output Budget
              </span>
              <span className="text-xs font-semibold text-foreground block">
                {config.maxTokens} tokens
              </span>
            </Card>

            <Card className="p-3 bg-muted/40 border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Layers className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-medium">Grounding Chunks</span>
              </div>
              <span className="text-xs font-semibold text-foreground block">
                {config.contextChunks} passages
              </span>
            </Card>
          </div>

          {/* Active System Persona Banner */}
          <Card className="p-4 bg-card/60 border-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active System Directive & Persona
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/settings")}
                className="h-auto p-0 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-transparent cursor-pointer"
              >
                Edit in Settings
              </Button>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-mono bg-background/60 p-2.5 rounded-lg border border-border/60">
              {config.systemPrompt}
            </p>
          </Card>

          {/* Interactive Draft Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Narrative Prompt & Scene Starter
              </span>
              <span className="text-[11px] text-muted-foreground">
                Try a starter prompt below
              </span>
            </div>

            <textarea
              rows={3}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Enter opening sentence, scene beat, or dramatic question..."
              className="w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed font-mono outline-hidden transition focus:border-primary focus:ring-1 focus:ring-primary/40 resize-y"
            />


          </div>

          {/* Action Button */}
          <div className="flex justify-between gap-2">
            <div>
              <Link to="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-medium cursor-pointer"
                >
                  <HardDrive className="size-3.5" />
                  Add more files
                </Button>
              </Link>

            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                onClick={() => setInputPrompt("")}
                variant="secondary"
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Reset Prompt
              </Button>

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !inputPrompt.trim()}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Generating Scene...
                  </>
                ) : (
                  <>
                    <Wand2 className="size-3.5" />
                    Synthesize Scene
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Generated Result Display */}
          {outputResult ? (
            <Card className="rounded-xl border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Generated Manuscript Excerpt
                  </span>
                  {metrics ? (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      ({metrics.tokens} tokens • {metrics.latencyMs}ms)
                    </span>
                  ) : null}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 px-2 text-[11px] gap-1 cursor-pointer bg-background"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs text-foreground whitespace-pre-line leading-relaxed font-serif bg-background/80 p-4 rounded-lg border border-border/60">
                {outputResult}
              </div>
            </Card>
          ) : null}
        </CardContent>

        <CardFooter className="border-t border-border pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Model parameters are synced with your global App Settings.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings")}
            className="h-auto p-0 text-xs text-primary hover:underline cursor-pointer"
          >
            <Settings className="size-3.5 mr-1" />
            Open Full Settings Workbench
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
