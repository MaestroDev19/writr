import type { AgentId } from "@/lib/agents/prompts"
import type { FailureClass } from "@/lib/agents/errors"

/**
 * One local line per turn. Tool names and error codes only.
 * The manuscript, notes, and MCP environment never go in this record.
 * LangSmith tracing stays off unless the author later opts in; it would send the turn off the machine.
 */

export type TurnTrace = {
  ts: string
  mode: AgentId
  model: string
  tools: string[]
  failures: string[]
  class: FailureClass | "ok"
  code: string | null
  retries: number
  latencyMs: number
}

export function turnTrace(input: Omit<TurnTrace, "ts"> & { ts?: string }): TurnTrace {
  return {
    ts: input.ts ?? new Date().toISOString(),
    mode: input.mode,
    model: input.model,
    tools: input.tools,
    failures: input.failures,
    class: input.class,
    code: input.code,
    retries: input.retries,
    latencyMs: input.latencyMs,
  }
}

export function turnTraceLine(trace: TurnTrace): string {
  return JSON.stringify(trace)
}
