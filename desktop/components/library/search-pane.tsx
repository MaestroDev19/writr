"use client"

import { useState, type FormEvent } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { LibraryNote, SearchHit } from "@/types/library"

export function SearchPane({
  notes,
  ollamaOk,
  onSearch,
}: {
  notes: LibraryNote[]
  ollamaOk: boolean
  onSearch: (query: string) => Promise<SearchHit[]>
}) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    if (!ollamaOk) {
      setHits([])
      setError("Ollama unavailable.")
      return
    }
    if (notes.length === 0) {
      setHits([])
      setError("Add a note first.")
      return
    }

    setSearching(true)
    setError(null)
    try {
      const results = await onSearch(q)
      setHits(results)
      if (results.length === 0) setError("No matches.")
    } catch {
      setHits([])
      setError("Search failed.")
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border-b border-border p-5 sm:px-6"
      >
        <FieldGroup className="gap-3">
          <Field orientation="horizontal" className="gap-2">
            <FieldLabel htmlFor="library-search" className="sr-only">
              Search notes
            </FieldLabel>
            <Input
              id="library-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search local notes…"
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              size="sm"
              className="shrink-0"
              disabled={searching || !query.trim()}
            >
              {searching ? "Searching…" : "Search"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <div className="min-h-0 flex-1" role="region" aria-live="polite">
        {hits === null ? (
          <Empty className="min-h-48 border-0 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-md">
                <Search />
              </EmptyMedia>
              <EmptyTitle>Search the library</EmptyTitle>
              <EmptyDescription>
                Hybrid retrieve over notes on this machine. No agent chrome
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : hits.length === 0 ? (
          <Empty className="min-h-48 border-0 p-6">
            <EmptyHeader>
              <EmptyTitle>{error ?? "No matches"}</EmptyTitle>
              <EmptyDescription>
                {error === "Add a note first."
                  ? "Use Add notes above, then search again."
                  : error === "Ollama unavailable."
                    ? "Start Ollama and retry."
                    : "Try another query."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="h-full">
            <ul className="flex flex-col divide-y divide-border">
              {hits.map((hit) => (
                <li key={hit.id} className="flex flex-col gap-1.5 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {hit.noteTitle}
                    </p>
                    <span className="shrink-0 text-[0.65rem] tabular-nums text-muted-foreground">
                      #{hit.ordinal}
                      {hit.score != null ? ` · ${hit.score.toFixed(2)}` : ""}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {hit.snippet}
                  </p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
