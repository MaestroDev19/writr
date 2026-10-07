import { z } from "zod"

import { GEMINI_MODEL_IDS } from "@/lib/model-providers"

const workflowPromptConfigSchema = z.object({
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(1.5),
  maxTokens: z.number().int().min(256).max(4096),
  topP: z.number().min(0.1).max(1.0),
  frequencyPenalty: z.number().min(1.0).max(1.5),
  contextChunks: z.number().int().min(1).max(10),
})

export const settingsFormSchema = z.object({
  geminiModel: z.enum(GEMINI_MODEL_IDS),
  generateConfig: workflowPromptConfigSchema,
  critiqueConfig: workflowPromptConfigSchema,
})

export type SettingsFormValues = z.infer<typeof settingsFormSchema>
