import { tool } from "langchain"
import { z } from "zod"

/**
 * Library search for the desktop agents.
 * The model may supply `query` only. userId and projectId arrive on
 * createAgent's context at invoke time, not as tool arguments.
 */

export const agentContextSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1),
})

export type AgentContext = z.infer<typeof agentContextSchema>

export type ProjectSearch = (input: { userId: string; projectId: string; query: string }) => Promise<string>

const NO_NOTES = "No matching notes found."

export function searchProjectTool(search: ProjectSearch) {
  return tool(
    async ({ query }, config) => {
      const context = agentContextSchema.safeParse(config.context)
      if (!context.success) return NO_NOTES
      const text = (await search({ ...context.data, query })).trim()
      return text.length > 0 ? text : NO_NOTES
    },
    {
      name: "search_project",
      description: "Search this project's library notes before inventing continuity, voice, or facts.",
      schema: z.object({
        query: z.string().describe("What to look for in the library"),
      }),
    },
  )
}
