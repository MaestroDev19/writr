import { Sparkles, ArrowRight, Wand2 } from "lucide-react"

export default function GeneratePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Studio
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            <Sparkles className="size-3" />
            AI Writer
          </span>
        </div>
        <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">
          Content <span className="font-semibold text-primary">Generation</span>
        </h1>
        <p className="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Craft essays, manuscripts, and narrative drafts with intelligent context steering and multi-model synthesis.
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-900/30">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Wand2 className="size-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Narrative Studio</h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Start a chapter or section draft with voice presets, tone modulation, and structure outlines.
          </p>
          <div className="mt-6">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              New Draft
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-900/30">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Prompt Workbench</h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Experiment with system prompts, temperature controls, and parameter constraints for custom workflows.
          </p>
          <div className="mt-6">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 hover:border-primary/40 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 cursor-pointer"
            >
              Configure Model
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
