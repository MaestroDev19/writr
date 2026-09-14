import { MessageSquareQuote, CheckCircle2, AlertTriangle, FileText } from "lucide-react"

export default function CritiquePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Analysis
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            <MessageSquareQuote className="size-3" />
            Editorial Review
          </span>
        </div>
        <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">
          Manuscript <span className="font-semibold text-primary">Critique</span>
        </h1>
        <p className="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Automated structural critique, prose cadence analysis, consistency checking, and developmental feedback.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-base font-semibold">Critique Rubrics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span className="text-xs font-semibold">Pacing & Flow</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Sentence length variation score: 94/100. Strong rhythm with dynamic transitions across paragraphs.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4" />
              <span className="text-xs font-semibold">Tone Consistency</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              3 detected shifts from lyrical narrative to colloquial exposition in chapter sections.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <FileText className="size-4" />
              <span className="text-xs font-semibold">Theme Tracking</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Key motifs identified: memory, architecture, temporal dislocation. 12 cross-references indexed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
