"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button-link"
import { agentNav, workspaceNav } from "@/lib/nav"
import { cn } from "@/lib/utils"

export default function HomePage() {
  const quick = [
    workspaceNav.find((n) => n.href === "/library")!,
    ...agentNav.filter((n) => n.href === "/write" || n.href === "/review"),
  ]

  return (
    <AppShell
      title="Home"
      subtitle="Local author workspace - notes in, agents on drafts you attach"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-10 overflow-auto px-5 py-8 sm:px-8 lg:px-10">
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Pick up the work on this machine
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Library holds evidence. Write and Review attach a target draft, then
            call local tools. Plan, Analyse, Research, and Publish share the same
            shell when those agents land.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href="/library" size="sm" className="rounded-md">
              Open library
            </ButtonLink>
            <ButtonLink
              href="/write"
              size="sm"
              variant="outline"
              className="rounded-md"
            >
              Write workspace
            </ButtonLink>
            <ButtonLink
              href="/settings"
              size="sm"
              variant="outline"
              className="rounded-md"
            >
              Settings
            </ButtonLink>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {quick.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col gap-3 rounded-md border border-border bg-card p-5 transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <item.icon className="size-3.5" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{item.label}</span>
                {item.status === "soon" ? (
                  <Badge
                    variant="secondary"
                    className="ms-auto rounded-md px-2 py-0.5 tracking-normal normal-case"
                  >
                    Soon
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="ms-auto rounded-md bg-accent px-2 py-0.5 tracking-normal normal-case text-accent-foreground"
                  >
                    Live
                  </Badge>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {item.blurb}
              </p>
            </Link>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-lg font-semibold tracking-tight">
            All agents
          </h3>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
            {agentNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <item.icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <Badge className="rounded-md bg-muted px-2 py-0.5 tracking-normal normal-case text-muted-foreground">
                        {item.status === "soon" ? "Soon" : "Live"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.blurb}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-border bg-primary px-5 py-6 text-primary-foreground sm:px-7">
          <p className="font-mono text-[11px] tracking-wide text-primary-foreground/70 uppercase">
            Target vs library
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/90">
            You upload or paste the draft into Write or Review. Library notes are
            retrieved by tools. Notion import (MCP) lands in Library, never as a
            silent target.
          </p>
        </section>
      </div>
    </AppShell>
  )
}
