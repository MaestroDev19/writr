import type { ReactNode } from "react"
import { ButtonLink } from "@/components/ui/button-link"

export function SurfaceGuide({
  title,
  lead,
  children,
  primaryHref,
  primaryLabel,
}: {
  title: string
  lead: string
  children: ReactNode
  primaryHref: string
  primaryLabel: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          {lead}
        </p>
      </div>
      <div className="flex flex-col gap-4 border border-border bg-card/80 p-5 text-sm leading-relaxed">
        {children}
      </div>
      <div>
        <ButtonLink href={primaryHref}>{primaryLabel}</ButtonLink>
      </div>
    </div>
  )
}
