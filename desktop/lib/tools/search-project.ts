import { tool } from "langchain"
import { z } from "zod"
import { VectorStore } from "../vector-store"
/**
 * Library search for the desktop agents.
 * The model may supply `query` only. userId arrives on
 * createAgent's context at invoke time, not as a tool argument.
 */

export const agentContextSchema = z.object({
  userId: z.string().min(1).optional(),
})

export type AgentContext = z.infer<typeof agentContextSchema>

export type ProjectSearch = (input: { userId?: string; query: string }) => Promise<string>
export type LibrarySearch = ProjectSearch

const NO_NOTES = "No matching notes found."

export const defaultVectorSearch: ProjectSearch = async ({ userId, query }) => {
  const retriever = new VectorStore(userId).asRetriever()

  const results = await retriever.invoke(query)
  if (results.length === 0) return NO_NOTES
  return results
    .map((r) => `[Source: ${r.metadata.documentName} (chunk ${r.metadata.chunkIndex + 1})]\n${r.pageContent}`)
    .join("\n\n")
}

export function searchProjectTool(search?: ProjectSearch) {
  const searchFn = search ?? defaultVectorSearch
  return tool(
    async ({ query }, config) => {
      const context = agentContextSchema.safeParse(config.context)
      const userId = context.success ? context.data.userId : undefined
      const text = (await searchFn({ userId, query })).trim()
      return text.length > 0 ? text : NO_NOTES
    },
    {
      name: "search_project",
      description: "Search the library notes before inventing continuity, voice, or facts.",
      schema: z.object({
        query: z.string().describe("What to look for in the library"),
      }),
    },
  )
}
