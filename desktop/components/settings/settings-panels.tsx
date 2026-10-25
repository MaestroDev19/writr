"use client"

import { Blocks, FolderOpen } from "lucide-react"
import { useChatSettings } from "@/components/chat-settings-provider"
import { StatusPill } from "@/components/status-pill"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CREATIVITY_PRESETS,
  temperatureFor,
} from "@/lib/chat-settings"
import { EMBED_MODEL, RECOMMENDED_CHAT_MODEL, openOllamaInstallDocs } from "@/lib/setup"
import { cn } from "@/lib/utils"

const CHAT_TIERS = [
  { ram: "4–8 GB", model: RECOMMENDED_CHAT_MODEL, note: "Lightweight & fast (1.3 GB download)" },
  { ram: "8–16 GB", model: "qwen3.5:4b", note: "Default for most authors" },
  { ram: "16 GB+", model: "llama3.2:3b", note: "Balanced writing quality" },
  { ram: "32 GB+", model: "qwen3.5:9b", note: "More headroom" },
] as const

export function SettingsPanels() {
  const {
    ollamaOk,
    chatModels,
    selectedModel,
    creativity,
    setSelectedModel,
    setCreativity,
  } = useChatSettings()

  const writeTemperature = temperatureFor("write", creativity)
  const groundedTemperature = temperatureFor("critique", creativity)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 overflow-auto px-5 py-8 sm:px-8">
      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              Appearance
            </h2>
            <p className="text-sm text-muted-foreground">
              Light, dark, or match the system. Toggle quickly with{" "}
              <KbdGroup className="inline-flex align-middle">
                <Kbd>Ctrl</Kbd>
                <Kbd>Shift</Kbd>
                <Kbd>L</Kbd>
              </KbdGroup>
              .
            </p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold tracking-tight">
            Ollama
          </h2>
          {ollamaOk === null ? (
            <StatusPill label="Checking..." tone="busy" />
          ) : (
            <StatusPill
              label={ollamaOk ? "Reachable" : "Unreachable"}
              tone={ollamaOk ? "ok" : "error"}
            />
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Embeddings stay on <code className="text-xs">{EMBED_MODEL}</code>.
          Agents call the chat model below.
        </p>
        {ollamaOk === false ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit rounded-md"
            onClick={() => void openOllamaInstallDocs()}
          >
            Open install
          </Button>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold tracking-tight">
            Chat model
          </h2>
          {selectedModel ? (
            <StatusPill label={`In use · ${selectedModel}`} tone="ok" />
          ) : (
            <StatusPill
              label={chatModels.length > 1 ? "Choose one" : "None installed"}
              tone={chatModels.length > 1 ? "busy" : "muted"}
            />
          )}
        </div>

        {ollamaOk === false ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ollama is not reachable, so the installed models cannot be listed.
            {selectedModel ? ` Last choice: ${selectedModel}.` : null}
          </p>
        ) : null}

        {ollamaOk === null ? (
          <p className="text-sm text-muted-foreground">Checking which models are installed.</p>
        ) : null}

        {ollamaOk === true && chatModels.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              No chat model is installed. Pull one in Ollama and it will show
              up here. The embed model is not used for agents.
            </p>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {CHAT_TIERS.map((tier) => (
                <li
                  key={tier.model}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
                >
                  <span className="font-medium">{tier.model}</span>
                  <span className="text-xs text-muted-foreground">
                    {tier.ram} · {tier.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {ollamaOk === true && chatModels.length === 1 && selectedModel ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            One chat model is installed, so agents use{" "}
            <span className="font-medium text-foreground">{selectedModel}</span>.
          </p>
        ) : null}

        {ollamaOk === true && chatModels.length > 1 ? (
          <Field>
            <FieldLabel htmlFor="chat-model">Model agents use</FieldLabel>
            <Select
              value={selectedModel ?? undefined}
              onValueChange={(value) => {
                if (typeof value === "string") setSelectedModel(value)
              }}
            >
              <SelectTrigger id="chat-model" className="w-full max-w-sm">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {chatModels.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {chatModels.length} chat models are installed. Embeddings stay on{" "}
              {EMBED_MODEL}.
            </FieldDescription>
          </Field>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base font-semibold tracking-tight">
            Creativity
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            How far Write may move from the document. Review, Story Bible,
            Research, and the Revision Planner stay at {groundedTemperature} or
            below so scores and citations do not drift.
          </p>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Creativity</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {CREATIVITY_PRESETS.map((preset) => {
              const checked = creativity === preset.id
              return (
                <label
                  key={preset.id}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-3 text-sm transition-colors",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30",
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/60"
                  )}
                >
                  <input
                    type="radio"
                    name="creativity"
                    value={preset.id}
                    checked={checked}
                    onChange={() => setCreativity(preset.id)}
                    className="sr-only"
                  />
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {preset.detail}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Write temperature {writeTemperature}. Other agents {groundedTemperature}.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold tracking-tight">
            Connections
          </h2>
          <Badge
            variant="secondary"
            className="rounded-md px-2 py-0.5 tracking-normal normal-case"
          >
            Soon
          </Badge>
        </div>
        <ul className="flex flex-col gap-3">
          <li className="flex items-start gap-3 rounded-md border border-dashed border-border px-4 py-4">
            <Blocks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Notion via MCP</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Trusted MCP servers import into Library notes. Agents do not
                silently fetch Notion as the Write or Review target.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 rounded-md border border-dashed border-border px-4 py-4">
            <FolderOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Project folder</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Path badge and Open in Explorer for the local project root.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <ButtonLink href="/home" variant="outline" className="w-fit rounded-md">
        Back to home
      </ButtonLink>
    </div>
  )
}
