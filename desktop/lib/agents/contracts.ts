import { z } from "zod"

import type { AgentId } from "@/lib/agents/prompts"
import { ContractError } from "@/lib/agents/errors"

export type ContractResult = { ok: true } | { ok: false; code: string; message: string }

const researchSchema = z.object({
  source: z.string().nullable(),
  summary: z.string(),
  citation: z.string().nullable(),
  filed: z.boolean(),
})

const critiqueSchema = z.object({
  recommendations: z.array(
    z.object({
      category: z.string().min(1),
      severity: z.enum(["high", "medium", "low"]),
      issue: z.string().min(1),
      revised_example: z.string().min(1),
    }),
  ),
})

const bibleSchema = z.object({
  proposals: z.array(
    z.object({
      kind: z.enum(["fact", "character", "event", "thread", "link"]),
      entity: z.string(),
      value: z.string(),
      evidence: z.string(),
      position: z.string(),
      status: z.enum(["proposal", "accepted"]),
    }),
  ),
  conflict: z.string().nullable(),
  error: z.enum(["no evidence"]).nullable(),
})

const plannerSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().min(1),
      finding_id: z.string(),
      priority: z.enum(["high", "medium", "low", "critical"]),
      depends_on: z.array(z.string()),
      effort: z.enum(["small", "medium", "large"]),
    }),
  ),
})

export function checkContract(agent: AgentId, output: unknown): ContractResult {
  try {
    assertContract(agent, output)
    return { ok: true }
  } catch (error) {
    if (error instanceof ContractError) return { ok: false, code: error.code, message: error.message }
    return { ok: false, code: "invalid_output", message: "The agent output could not be checked." }
  }
}

export function assertContract(agent: AgentId, output: unknown): void {
  if (agent === "write") {
    assertWrite(output)
    return
  }
  const body = asObject(output)
  if (agent === "research") assertResearch(body)
  else if (agent === "critique") assertCritique(body)
  else if (agent === "story-bible") assertBible(body)
  else assertPlanner(body)
}

function assertWrite(output: unknown): void {
  if (typeof output !== "string" || output.trim().length === 0) {
    throw new ContractError("empty_artifact", "Write returned no artifact.")
  }
  const trimmed = output.trim()
  if (trimmed.startsWith("{") && trimmed.includes('"recommendations"')) {
    throw new ContractError("critique_as_product", "Write returned a critique instead of an artifact.")
  }
}

function assertResearch(body: unknown): void {
  const parsed = researchSchema.safeParse(body)
  if (!parsed.success) throw new ContractError("invalid_output", "Research did not return a sourced note.")
  if (parsed.data.filed && !parsed.data.source?.trim()) {
    throw new ContractError("missing_source", "Research filed a note with no source.")
  }
  if (!parsed.data.filed && parsed.data.source) {
    throw new ContractError("unfiled_source", "Research named a source but did not file the note.")
  }
}

function assertCritique(body: unknown): void {
  const parsed = critiqueSchema.safeParse(body)
  if (!parsed.success) throw new ContractError("finding_without_evidence", "A critique finding is missing its issue.")
}

function assertBible(body: unknown): void {
  const parsed = bibleSchema.safeParse(body)
  if (!parsed.success) throw new ContractError("invalid_output", "Story Bible did not return proposals.")
  if (parsed.data.proposals.some((proposal) => proposal.status === "accepted")) {
    throw new ContractError("canon_accepted", "Story Bible accepted canon on the agent turn.")
  }
  if (parsed.data.proposals.some((proposal) => proposal.evidence.trim().length === 0)) {
    throw new ContractError("unsourced_proposal", "Story Bible filed a proposal with no evidence.")
  }
  if (parsed.data.error === "no evidence" && parsed.data.proposals.length > 0) {
    throw new ContractError("unsourced_proposal", "Story Bible filed a proposal after reporting no evidence.")
  }
}

function assertPlanner(body: unknown): void {
  const parsed = plannerSchema.safeParse(body)
  if (!parsed.success) throw new ContractError("invalid_output", "Revision Planner did not return tasks.")
  if (parsed.data.tasks.some((task) => task.finding_id.trim().length === 0)) {
    throw new ContractError("task_without_finding", "A revision task has no finding.")
  }
}

function asObject(output: unknown): unknown {
  if (typeof output === "string") {
    try {
      return JSON.parse(output) as unknown
    } catch {
      throw new ContractError("invalid_output", "The agent did not return JSON.")
    }
  }
  return output
}
