import type { ReactNode } from "react"
import {
  BookOpen,
  FileSearch,
  Kanban,
  MessageSquareQuote,
  Microscope,
  Send,
  Settings,
  Sparkles,
} from "lucide-react"

const destinations = [
  {
    label: "Library",
    detail: "Notes you add or import stay on this machine",
    icon: BookOpen,
  },
  {
    label: "Write",
    detail: "Attach a draft; the agent revises with local search",
    icon: Sparkles,
  },
  {
    label: "Review",
    detail: "Attach a draft; the agent scores with evidence",
    icon: MessageSquareQuote,
  },
  {
    label: "Plan",
    detail: "Scenes and threads on boards, structure without chat",
    icon: Kanban,
  },
  {
    label: "Analyse",
    detail: "Findings by category with evidence drill-down",
    icon: Microscope,
  },
  {
    label: "Research",
    detail: "Layered research on top of Library notes",
    icon: FileSearch,
  },
  {
    label: "Publish",
    detail: "Synopsis and query, separate from the working draft",
    icon: Send,
  },
  {
    label: "Settings",
    detail: "Ollama, chat models, later Notion via MCP",
    icon: Settings,
  },
] as const

export function AuthShell({
  children,
  headline,
  support,
}: {
  children: ReactNode
  headline: string
  support: string
}) {
  return (
    <div
      dir="ltr"
      className="grid min-h-[100dvh] w-full bg-background lg:grid-cols-[minmax(22rem,1.1fr)_minmax(22rem,0.9fr)]"
    >
      <aside className="relative hidden min-w-0 overflow-hidden border-e border-border lg:flex lg:flex-col lg:gap-8 lg:px-10 lg:py-10 xl:px-14 xl:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_12%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_52%),linear-gradient(165deg,var(--background),var(--muted))]"
        />

        <div className="relative z-10 flex min-w-0 flex-col gap-6">
          <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            Writr
          </p>

          <div className="flex max-w-[30rem] flex-col gap-3">
            <h2 className="font-heading text-balance text-2xl font-medium leading-[1.15] tracking-tight text-foreground xl:text-[1.85rem]">
              {headline}
            </h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {support}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            After you sign in
          </p>
          <ul className="flex max-h-full min-h-0 max-w-[30rem] flex-col overflow-auto rounded-md border border-border/80 bg-background/75 backdrop-blur-sm">
            {destinations.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-3 border-b border-border/70 px-3.5 py-2.5 last:border-b-0"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <item.icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 max-w-[30rem] font-mono text-xs leading-relaxed text-muted-foreground">
          Notes in. Drafts out. Review when you need it.
        </p>
      </aside>

      <main className="flex min-w-0 flex-col justify-center bg-background px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
        <div className="mb-8 lg:hidden">
          <p className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Writr
          </p>
          <p className="mt-2 max-w-[28rem] text-sm leading-relaxed text-muted-foreground">
            {headline}
          </p>
        </div>
        <div className="mx-auto w-full min-w-0 max-w-[24rem]">{children}</div>
      </main>
    </div>
  )
}
