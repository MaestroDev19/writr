import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { AgentId } from "@/lib/agents/prompts"

const cache = new Map<string, string>()

/**
 * Operating skill for one agent, plus the shared harness and document-kind notes.
 * This is not the system prompt. The prompt stays a separate content block.
 * Sidecar only: the files live on disk under desktop/skills.
 */
export function loadAgentSkill(agent: AgentId): string {
  if (typeof window !== "undefined") {
    throw new Error("Agent skills are read in the Node sidecar, not the WebView.")
  }
  const skill = stripFrontmatter(readSkillFile(`${agent}/SKILL.md`))
  const harness = readSkillFile("references/harness-contract.md").trim()
  const documents = readSkillFile("references/story-documents.md").trim()
  return `${skill}\n\n${harness}\n\n${documents}`
}

function readSkillFile(relative: string): string {
  const hit = cache.get(relative)
  if (hit) return hit
  const file = path.join(skillsRoot(), relative)
  const text = readFileSync(file, "utf8")
  cache.set(relative, text)
  return text
}

function skillsRoot(): string {
  const fromModule = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../skills")
  const candidates = [fromModule, path.resolve(process.cwd(), "skills"), path.resolve(process.cwd(), "desktop", "skills")]
  const root = candidates.find((dir) => existsSync(path.join(dir, "write", "SKILL.md")))
  if (root) return root
  throw new Error("Could not find the agent skills directory.")
}

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown.trim()
  const end = markdown.indexOf("\n---", 3)
  if (end === -1) return markdown.trim()
  return markdown.slice(end + 4).trim()
}
