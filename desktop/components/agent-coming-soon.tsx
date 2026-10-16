"use client"

import type { LucideIcon } from "lucide-react"
import { BookOpen, FileUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button-link"

export function AgentComingSoon({
  title,
  lead,
  icon: Icon,
  bullets,
}: {
  title: string
  lead: string
  icon: LucideIcon
  bullets: string[]
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {title}
            </h2>
            <Badge variant="secondary" className="rounded-md tracking-normal normal-case">
              Coming soon
            </Badge>
          </div>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {lead}
          </p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
        {bullets.map((item) => (
          <li key={item} className="px-5 py-4 text-sm leading-relaxed">
            {item}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/library" size="sm" className="rounded-md">
          <BookOpen data-icon="inline-start" />
          Open library
        </ButtonLink>
        <ButtonLink
          href="/write"
          size="sm"
          variant="outline"
          className="rounded-md"
        >
          <FileUp data-icon="inline-start" />
          See Write target flow
        </ButtonLink>
      </div>
    </div>
  )
}
